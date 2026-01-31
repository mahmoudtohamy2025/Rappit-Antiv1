import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
  BadRequestException,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@common/database/prisma.service';
import { RateLimitService, RATE_LIMIT_CONFIGS } from '@common/rate-limit';
import { StripeService } from '../billing/stripe.service';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

export interface JwtPayload {
  sub: string; // userId
  orgId: string; // organizationId
  role: string; // role in that organization
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private rateLimitService: RateLimitService,
    private stripeService: StripeService, // BILL-06: Stripe customer creation
  ) { }

  /**
   * Register new user and create their organization
   * User becomes ADMIN of the new organization
   */
  async register(dto: RegisterDto) {
    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // Create user + organization + membership in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create organization with 14-day trial (BILL-04)
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 14);

      const organization = await tx.organization.create({
        data: {
          name: dto.organizationName,
          subscriptionStatus: 'TRIAL',
          trialEndsAt,
          billingEmail: dto.email, // Use registration email as billing email
        },
      });

      // Create user
      const user = await tx.user.create({
        data: {
          email: dto.email,
          password: passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          isActive: true,
        },
      });

      // Create membership with ADMIN role
      const membership = await tx.userOrganization.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          role: 'ADMIN',
        },
      });

      return { user, organization, membership };
    });

    this.logger.log(
      `New user registered: ${result.user.email} for organization: ${result.organization.name}`,
    );

    // BILL-06: Create Stripe customer (non-blocking)
    // Errors are logged but do NOT block registration
    const stripeCustomerId = await this.stripeService.createCustomer(
      result.organization.id,
      result.organization.name,
      dto.email,
    );

    // Store stripeCustomerId if creation succeeded
    if (stripeCustomerId) {
      await this.prisma.organization.update({
        where: { id: result.organization.id },
        data: { stripeCustomerId },
      });
      this.logger.log(`Stripe customer ${stripeCustomerId} linked to org ${result.organization.id}`);
    }

    // Generate JWT with organization context
    const token = this.generateToken(
      result.user.id,
      result.organization.id,
      'ADMIN',
    );

    return {
      access_token: token,
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
      },
      organization: {
        id: result.organization.id,
        name: result.organization.name,
        role: 'ADMIN',
      },
    };
  }

  /**
   * Login user to a specific organization
   * If organizationId not provided, uses the first organization the user belongs to
   * 
   * SEC-02: Includes account lockout protection
   * - Checks if account is locked before attempting login
   * - Records failed login attempts
   * - Clears failed attempts on successful login
   */
  async login(dto: LoginDto) {
    const email = dto.email.toLowerCase();

    // SEC-02: Check if account is locked
    const lockStatus = await this.rateLimitService.isAccountLocked(email);
    if (lockStatus.locked) {
      this.logger.warn(`Login attempt for locked account: ${email}`);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          message: `Account temporarily locked due to too many failed login attempts. Please try again after ${lockStatus.retryAfterSeconds} seconds.`,
          retryAfter: lockStatus.retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // SEC-02: Check per-email rate limit
    const emailRateLimit = await this.rateLimitService.checkRateLimit(
      RATE_LIMIT_CONFIGS.AUTH_EMAIL,
      email,
    );
    if (!emailRateLimit.allowed) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          message: `Too many login attempts for this email. Please try again after ${emailRateLimit.retryAfterSeconds} seconds.`,
          retryAfter: emailRateLimit.retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Find user with all their organization memberships
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: {
        userOrganizations: {
          include: {
            organization: true,
          },
        },
      },
    });

    if (!user) {
      // SEC-02: Record failed attempt (don't reveal if email exists)
      await this.rateLimitService.recordFailedLogin(email);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is active
    if (!user.isActive) {
      await this.rateLimitService.recordFailedLogin(email);
      throw new UnauthorizedException('User account is inactive');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      // SEC-02: Record failed attempt
      const failedAttempts = await this.rateLimitService.recordFailedLogin(email);
      const remainingAttempts = RATE_LIMIT_CONFIGS.ACCOUNT_LOCKOUT.limit - failedAttempts;

      if (remainingAttempts <= 3 && remainingAttempts > 0) {
        this.logger.warn(
          `Failed login for ${email}: ${remainingAttempts} attempts remaining before lockout`,
        );
      }

      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user has any organization memberships
    if (user.userOrganizations.length === 0) {
      throw new UnauthorizedException('User does not belong to any organization');
    }

    // Determine which organization to login to
    let selectedMembership = user.userOrganizations[0];

    if (dto.organizationId) {
      // User specified an organization
      selectedMembership = user.userOrganizations.find(
        (m) => m.organizationId === dto.organizationId,
      );

      if (!selectedMembership) {
        throw new UnauthorizedException(
          'User does not have access to the specified organization',
        );
      }
    }

    // Check if organization is active
    if (!selectedMembership.organization) {
      throw new UnauthorizedException('Organization not found');
    }

    // SEC-02: Clear failed login attempts on successful login
    await this.rateLimitService.clearFailedLogins(email);

    // Last login timestamp tracking removed (field doesn't exist in schema)

    // Generate JWT with organization context
    const token = this.generateToken(
      user.id,
      selectedMembership.organizationId,
      selectedMembership.role,
    );

    this.logger.log(
      `User logged in: ${user.email} to organization: ${selectedMembership.organization.name}`,
    );

    return {
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      organization: {
        id: selectedMembership.organization.id,
        name: selectedMembership.organization.name,
        role: selectedMembership.role,
      },
      // Include all organizations the user has access to
      availableOrganizations: user.userOrganizations.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        role: m.role,
      })),
    };
  }

  /**
   * Get current user information with organization context
   */
  async getMe(userId: string, organizationId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userOrganizations: {
          include: {
            organization: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Find current organization membership
    const currentMembership = user.userOrganizations.find(
      (m) => m.organizationId === organizationId,
    );

    if (!currentMembership) {
      throw new UnauthorizedException('Access to organization denied');
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isActive: user.isActive,
      },
      currentOrganization: {
        id: currentMembership.organization.id,
        name: currentMembership.organization.name,
        role: currentMembership.role,
      },
      availableOrganizations: user.userOrganizations.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        role: m.role,
      })),
    };
  }

  /**
   * Accept invite and set password
   */
  async acceptInvite(token: string, dto: any) {
    if (!token) throw new BadRequestException('Token required');

    const user = await this.prisma.user.findUnique({
      where: { inviteToken: token }
    });

    if (!user) {
      throw new NotFoundException('Invalid token');
    }

    if (user.isActive) {
      throw new ConflictException('User already active');
    }

    if (user.inviteExpiresAt && user.inviteExpiresAt < new Date()) {
      throw new BadRequestException('Token expired');
    }

    const passwordHash = await bcrypt.hash(dto.password || 'Test@123', 10);

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: passwordHash,
        isActive: true,
        inviteToken: null,
        inviteExpiresAt: null
      },
      include: {
        userOrganizations: true
      }
    });

    // Generate access token for immediate login after accepting invite
    let accessToken = null;
    if (updatedUser.userOrganizations.length > 0) {
      const membership = updatedUser.userOrganizations[0];
      accessToken = this.generateToken(updatedUser.id, membership.organizationId, membership.role);
    }

    return { message: 'Invite accepted successfully', id: updatedUser.id, accessToken };
  }

  /**
   * Generate JWT token with user + organization context
   */
  private generateToken(
    userId: string,
    organizationId: string,
    role: string,
  ): string {
    const payload: JwtPayload = {
      sub: userId,
      orgId: organizationId,
      role: role,
    };

    return this.jwtService.sign(payload);
  }

  /**
   * Validate user exists and is active (used by JWT strategy)
   */
  async validateUser(userId: string, organizationId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userOrganizations: {
          where: { organizationId },
          include: {
            organization: true,
          },
        },
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    if (user.userOrganizations.length === 0) {
      throw new UnauthorizedException('User does not have access to organization');
    }

    const membership = user.userOrganizations[0];

    return {
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      organizationId: membership.organizationId,
      role: membership.role,
    };
  }
}
