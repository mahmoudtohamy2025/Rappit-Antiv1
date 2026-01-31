/**
 * Organization Settings Controller
 * GAP-10: Organization Settings Implementation
 * 
 * RESTful API endpoints for organization settings
 */

import {
    Controller,
    Get,
    Patch,
    Body,
    Query,
    UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
    OrganizationSettingsService,
    UpdateOrganizationDto,
    UpdateSettingsDto,
} from './organization-settings.service';

interface AuthUser {
    userId: string;
    organizationId: string;
    role: string;
}

@ApiTags('Organizations')
@ApiBearerAuth()
@Controller('organizations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrganizationSettingsController {
    constructor(private readonly orgSettingsService: OrganizationSettingsService) { }

    /**
     * Get current organization profile
     */
    @Get('current')
    @ApiOperation({ summary: 'Get current organization profile' })
    @ApiQuery({ name: 'includeStats', required: false, type: Boolean })
    getCurrentOrganization(
        @CurrentUser() user: AuthUser,
        @Query('includeStats') includeStats?: string,
    ) {
        return this.orgSettingsService.getCurrentOrganization(user.organizationId, {
            includeStats: includeStats === 'true',
        });
    }

    /**
     * Update organization profile
     */
    @Patch('current')
    @Roles('ADMIN')
    @ApiOperation({ summary: 'Update organization profile' })
    updateOrganization(
        @CurrentUser() user: AuthUser,
        @Body() dto: UpdateOrganizationDto,
    ) {
        return this.orgSettingsService.updateOrganization(user.organizationId, dto);
    }

    /**
     * Get organization statistics
     */
    @Get('current/stats')
    @ApiOperation({ summary: 'Get organization statistics' })
    getStats(@CurrentUser() user: AuthUser) {
        return this.orgSettingsService.getStats(user.organizationId);
    }

    /**
     * Get organization settings
     */
    @Get('current/settings')
    @ApiOperation({ summary: 'Get organization settings' })
    getSettings(@CurrentUser() user: AuthUser) {
        return this.orgSettingsService.getSettings(user.organizationId);
    }

    /**
     * Update organization settings
     */
    @Patch('current/settings')
    @Roles('ADMIN')
    @ApiOperation({ summary: 'Update organization settings' })
    updateSettings(
        @CurrentUser() user: AuthUser,
        @Body() dto: UpdateSettingsDto,
    ) {
        return this.orgSettingsService.updateSettings(user.organizationId, dto);
    }
}
