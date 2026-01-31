import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Query,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { Public } from '@common/decorators/public.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RateLimit, RateLimitType, RateLimitGuard } from '@common/rate-limit';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  /**
   * Register new user and organization
   * POST /auth/register
   * 
   * Rate limited: 5 requests per 15 minutes per IP
   */
  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit(RateLimitType.AUTH_IP)
  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  /**
   * Accept invite
   * POST /auth/accept-invite
   */
  @Public()
  @Post('accept-invite')
  async acceptInvite(@Body() body: any, @Query('token') token: string) {
    return this.authService.acceptInvite(token, body);
  }

  /**
   * Login user to an organization
   * POST /auth/login
   * 
   * Rate limited: 
   * - 5 requests per 15 min per IP (SEC-02)
   * - 10 requests per 15 min per email (SEC-02)
   * - Account lockout after 10 failed attempts (SEC-02)
   */
  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit(RateLimitType.AUTH_IP)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  /**
   * Get current user information
   * GET /auth/me
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@CurrentUser() user: any) {
    return this.authService.getMe(user.userId, user.organizationId);
  }
}

