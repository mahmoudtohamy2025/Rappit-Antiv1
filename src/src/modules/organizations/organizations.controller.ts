import {
  Controller,
  Get,
  Body,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import {
  CurrentUser,
  CurrentUserPayload,
} from '@common/decorators/current-user.decorator';
import { CurrentOrganization } from '@common/decorators/organization.decorator';

/**
 * Organizations Controller - REST API for Organization Management
 * 
 * RBAC Permissions (AUTH-01):
 * - View organization: OPERATOR, MANAGER, ADMIN
 * - Edit settings: ADMIN only
 */
@Controller('organizations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrganizationsController {
  constructor(
    private readonly organizationsService: OrganizationsService,
  ) { }

  /**
   * Get current organization
   * GET /organizations/current
   * Access: OPERATOR, MANAGER, ADMIN
   */
  @Get('current')
  @Roles('OPERATOR', 'MANAGER', 'ADMIN')
  findCurrent(@CurrentOrganization() organizationId: string) {
    return this.organizationsService.findOne(organizationId);
  }

  /**
   * Get organization statistics
   * GET /organizations/current/stats
   * Access: OPERATOR, MANAGER, ADMIN
   */
  @Get('current/stats')
  @Roles('OPERATOR', 'MANAGER', 'ADMIN')
  getStats(@CurrentOrganization() organizationId: string) {
    return this.organizationsService.getStats(organizationId);
  }

  /**
   * Update current organization (ADMIN only)
   * PATCH /organizations/current
   * Access: ADMIN only
   */
  @Patch('current')
  @Roles('ADMIN')
  update(
    @CurrentOrganization() organizationId: string,
    @Body() updateOrganizationDto: UpdateOrganizationDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.organizationsService.update(
      organizationId,
      updateOrganizationDto,
      user.role,
    );
  }
}

