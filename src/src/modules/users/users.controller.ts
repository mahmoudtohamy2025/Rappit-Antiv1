import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import {
  CurrentUser,
  CurrentUserPayload,
} from '@common/decorators/current-user.decorator';
import { CurrentOrganization } from '@common/decorators/organization.decorator';
import { RateLimit } from '@common/rate-limit/rate-limit.decorator';
import { RateLimitType, RateLimitGuard } from '@common/rate-limit/rate-limit.guard';

/**
 * Users Controller - REST API for User Management
 * 
 * RBAC Permissions (AUTH-01):
 * - All user operations: ADMIN only
 */
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  /**
   * Get all users in current organization
   * GET /users
   * Access: ADMIN only
   */
  @Get()
  @Roles('ADMIN')
  findAll(@CurrentOrganization() organizationId: string) {
    return this.usersService.findAll(organizationId);
  }

  /**
   * Get specific user in current organization
   * GET /users/:id
   * Access: ADMIN only
   */
  @Get(':id')
  @Roles('ADMIN')
  findOne(
    @Param('id') id: string,
    @CurrentOrganization() organizationId: string,
  ) {
    return this.usersService.findOne(id, organizationId);
  }

  /**
   * Invite/Add user to organization (ADMIN only)
   * POST /users
   */
  @Post()
  @Roles('ADMIN')
  create(
    @Body() createUserDto: CreateUserDto,
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.usersService.create(createUserDto, organizationId, user.role);
  }

  /**
   * Alias for create - Invite user
   * POST /users/invite
   */
  @Post('invite')
  @Roles('ADMIN')
  invite(
    @Body() createUserDto: CreateUserDto,
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.usersService.create(createUserDto, organizationId, user.role);
  }

  /**
   * Update user's role (ADMIN only)
   * PATCH /users/:id
   */
  @Patch(':id')
  @Roles('ADMIN')
  update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.usersService.updateRole(
      id,
      organizationId,
      updateUserDto.role,
      user.role,
    );
  }

  /**
   * Remove user from organization (ADMIN only)
   * DELETE /users/:id
   */
  @Delete(':id')
  @Roles('ADMIN')
  remove(
    @Param('id') id: string,
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.usersService.remove(id, organizationId, user.role);
  }

  /**
   * Resend invite
   * POST /users/:id/resend-invite
   * Rate limited to 3 per hour per user (GAP-22)
   */
  @Post(':id/resend-invite')
  @Roles('ADMIN')
  @RateLimit(RateLimitType.RESEND_INVITE)
  @UseGuards(RateLimitGuard)
  resendInvite(
    @Param('id') id: string,
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.usersService.resendInvite(id, organizationId, user.role);
  }
}
