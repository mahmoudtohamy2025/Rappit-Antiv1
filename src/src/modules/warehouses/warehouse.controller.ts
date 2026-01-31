/**
 * Warehouse Controller
 * GAP-01: Warehouse CRUD Implementation
 * 
 * RESTful API endpoints for warehouse management
 */

import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { WarehouseService, CreateWarehouseDto, UpdateWarehouseDto } from './warehouse.service';

interface AuthUser {
    userId: string;
    organizationId: string;
    role: string;
}

@ApiTags('Warehouses')
@ApiBearerAuth()
@Controller('warehouses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WarehouseController {
    constructor(private readonly warehouseService: WarehouseService) { }

    /**
     * Create a new warehouse
     */
    @Post()
    @Roles('ADMIN', 'MANAGER')
    @ApiOperation({ summary: 'Create a new warehouse' })
    async createWarehouse(
        @CurrentUser() user: AuthUser,
        @Body() dto: CreateWarehouseDto,
    ) {
        return this.warehouseService.createWarehouse(user.organizationId, dto);
    }

    /**
     * Get all warehouses
     */
    @Get()
    @ApiOperation({ summary: 'Get all warehouses' })
    @ApiQuery({ name: 'search', required: false })
    @ApiQuery({ name: 'isActive', required: false, type: Boolean })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'pageSize', required: false, type: Number })
    async getWarehouses(
        @CurrentUser() user: AuthUser,
        @Query('search') search?: string,
        @Query('isActive') isActive?: string,
        @Query('page') page?: string,
        @Query('pageSize') pageSize?: string,
    ) {
        return this.warehouseService.getWarehouses(user.organizationId, {
            search,
            isActive: isActive !== undefined ? isActive === 'true' : undefined,
            page: page ? parseInt(page, 10) : undefined,
            pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
        });
    }

    /**
     * Get warehouse by ID
     */
    @Get(':id')
    @ApiOperation({ summary: 'Get warehouse by ID' })
    @ApiQuery({ name: 'includeStats', required: false, type: Boolean })
    async getWarehouseById(
        @CurrentUser() user: AuthUser,
        @Param('id') id: string,
        @Query('includeStats') includeStats?: string,
    ) {
        return this.warehouseService.getWarehouseById(
            user.organizationId,
            id,
            { includeStats: includeStats === 'true' },
        );
    }

    /**
     * Get warehouse stats
     */
    @Get(':id/stats')
    @ApiOperation({ summary: 'Get warehouse inventory stats' })
    async getWarehouseStats(
        @CurrentUser() user: AuthUser,
        @Param('id') id: string,
    ) {
        return this.warehouseService.getWarehouseStats(user.organizationId, id);
    }

    /**
     * Update warehouse
     */
    @Patch(':id')
    @Roles('ADMIN', 'MANAGER')
    @ApiOperation({ summary: 'Update warehouse' })
    async updateWarehouse(
        @CurrentUser() user: AuthUser,
        @Param('id') id: string,
        @Body() dto: UpdateWarehouseDto,
    ) {
        return this.warehouseService.updateWarehouse(user.organizationId, id, dto);
    }

    /**
     * Delete warehouse
     */
    @Delete(':id')
    @Roles('ADMIN')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete warehouse' })
    async deleteWarehouse(
        @CurrentUser() user: AuthUser,
        @Param('id') id: string,
    ) {
        await this.warehouseService.deleteWarehouse(user.organizationId, id);
    }

    /**
     * Set warehouse as default
     */
    @Post(':id/set-default')
    @Roles('ADMIN')
    @ApiOperation({ summary: 'Set warehouse as default' })
    async setDefaultWarehouse(
        @CurrentUser() user: AuthUser,
        @Param('id') id: string,
    ) {
        return this.warehouseService.setDefaultWarehouse(user.organizationId, id);
    }

    /**
     * Get default warehouse
     */
    @Get('default')
    @ApiOperation({ summary: 'Get default warehouse' })
    async getDefaultWarehouse(@CurrentUser() user: AuthUser) {
        return this.warehouseService.getDefaultWarehouse(user.organizationId);
    }
}
