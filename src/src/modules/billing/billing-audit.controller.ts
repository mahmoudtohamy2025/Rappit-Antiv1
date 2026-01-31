import {
    Controller,
    Get,
    Query,
    UseGuards,
    Logger,
    ParseIntPipe,
    DefaultValuePipe,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiBearerAuth,
    ApiResponse,
    ApiQuery,
} from '@nestjs/swagger';
import { BillingAuditService } from './billing-audit.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { OrganizationId } from '@common/decorators/organization.decorator';

/**
 * BillingAuditController (BILL-05)
 * 
 * Admin-only endpoints for viewing billing audit logs.
 * 
 * CRITICAL:
 * - READ-ONLY: No update/delete endpoints
 * - ADMIN-ONLY: Only admins can view audit logs
 * - Logs are immutable for compliance
 */
@ApiTags('Billing Audit')
@Controller('billing/audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class BillingAuditController {
    private readonly logger = new Logger(BillingAuditController.name);

    constructor(private auditService: BillingAuditService) { }

    /**
     * GET /billing/audit
     * 
     * List all billing audit logs for the organization
     * Access: ADMIN only
     */
    @Get()
    @Roles('ADMIN')
    @ApiOperation({
        summary: 'Get billing audit logs',
        description: 'List all billing audit events for the organization with pagination',
    })
    @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
    @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20, max: 100)' })
    @ApiResponse({ status: 200, description: 'Audit logs retrieved successfully' })
    @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
    async findAll(
        @OrganizationId() organizationId: string,
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    ) {
        this.logger.log(`Admin querying audit logs for org ${organizationId}`);

        return this.auditService.findByOrganization(organizationId, { page, limit });
    }

    /**
     * GET /billing/audit/range
     * 
     * Query audit logs by date range
     * Access: ADMIN only
     */
    @Get('range')
    @Roles('ADMIN')
    @ApiOperation({
        summary: 'Get audit logs by date range',
        description: 'Query billing audit logs within a specific date range',
    })
    @ApiQuery({ name: 'startDate', required: true, type: String, description: 'Start date (ISO 8601)' })
    @ApiQuery({ name: 'endDate', required: true, type: String, description: 'End date (ISO 8601)' })
    @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
    @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20, max: 100)' })
    @ApiResponse({ status: 200, description: 'Audit logs retrieved successfully' })
    @ApiResponse({ status: 400, description: 'Bad Request - Invalid date format' })
    @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
    async findByDateRange(
        @OrganizationId() organizationId: string,
        @Query('startDate') startDateStr: string,
        @Query('endDate') endDateStr: string,
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    ) {
        const startDate = new Date(startDateStr);
        const endDate = new Date(endDateStr);

        this.logger.log(
            `Admin querying audit logs for org ${organizationId} from ${startDateStr} to ${endDateStr}`,
        );

        return this.auditService.findByDateRange(
            organizationId,
            { startDate, endDate },
            { page, limit },
        );
    }

    /**
     * GET /billing/audit/latest
     * 
     * Get latest billing events
     * Access: ADMIN only
     */
    @Get('latest')
    @Roles('ADMIN')
    @ApiOperation({
        summary: 'Get latest billing events',
        description: 'Retrieve the most recent billing audit events',
    })
    @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of events (default: 10, max: 50)' })
    @ApiResponse({ status: 200, description: 'Latest events retrieved successfully' })
    @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
    async getLatest(
        @OrganizationId() organizationId: string,
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    ) {
        return this.auditService.getLatestEvents(organizationId, limit);
    }

    /**
     * GET /billing/audit/by-action
     * 
     * Filter audit logs by action type
     * Access: ADMIN only
     */
    @Get('by-action')
    @Roles('ADMIN')
    @ApiOperation({
        summary: 'Get audit logs by action type',
        description: 'Filter billing audit logs by specific action type',
    })
    @ApiQuery({ name: 'action', required: true, type: String, description: 'Action type (e.g., subscription.created)' })
    @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
    @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20, max: 100)' })
    @ApiResponse({ status: 200, description: 'Audit logs retrieved successfully' })
    @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
    async findByAction(
        @OrganizationId() organizationId: string,
        @Query('action') action: string,
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    ) {
        this.logger.log(`Admin querying audit logs for action ${action} in org ${organizationId}`);

        return this.auditService.findByAction(organizationId, action, { page, limit });
    }
}
