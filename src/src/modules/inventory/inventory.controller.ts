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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';
import { AdjustInventoryDto } from './dto/adjust-inventory.dto';
import { PaginationDto } from '@common/dto/pagination.dto';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { SubscriptionGuard } from '@common/guards/subscription.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { OrganizationId } from '@common/decorators/organization.decorator';
import { RequiresActiveSubscription } from '@common/decorators/subscription.decorator';
import { CurrentUser, CurrentUserPayload } from '@common/decorators/current-user.decorator';

/**
 * Inventory Controller - REST API for Inventory Management
 * 
 * RBAC Permissions (AUTH-01):
 * - View inventory: OPERATOR, MANAGER, ADMIN
 * - Create/Edit: MANAGER, ADMIN
 * - Adjust stock: OPERATOR, MANAGER, ADMIN
 * - Delete: ADMIN only
 * 
 * Subscription Status (BILL-03):
 * - SUSPENDED/CANCELLED: Read-only (GET allowed, POST/PATCH/DELETE blocked)
 * - TRIAL/ACTIVE/PAST_DUE: Full access
 */
@ApiTags('Inventory')
@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard, SubscriptionGuard)
@ApiBearerAuth()
@RequiresActiveSubscription()
export class InventoryController {
  constructor(private inventoryService: InventoryService) { }

  /**
   * Create inventory item
   * Access: MANAGER, ADMIN
   */
  @Post()
  @Roles('MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Create inventory item' })
  async create(
    @OrganizationId() organizationId: string,
    @Body() dto: CreateInventoryItemDto,
  ) {
    return this.inventoryService.create(organizationId, dto);
  }

  /**
   * Get all inventory items
   * Access: OPERATOR, MANAGER, ADMIN
   */
  @Get()
  @Roles('OPERATOR', 'MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Get all inventory items' })
  async findAll(
    @OrganizationId() organizationId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.inventoryService.findAll(organizationId, pagination);
  }

  /**
   * Get low stock items
   * Access: OPERATOR, MANAGER, ADMIN
   */
  @Get('low-stock')
  @Roles('OPERATOR', 'MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Get low stock items' })
  async getLowStock(@OrganizationId() organizationId: string) {
    return this.inventoryService.getLowStockItems(organizationId);
  }

  /**
   * Get inventory item by ID
   * Access: OPERATOR, MANAGER, ADMIN
   */
  @Get(':id')
  @Roles('OPERATOR', 'MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Get inventory item by ID' })
  async findOne(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
  ) {
    return this.inventoryService.findOne(organizationId, id);
  }

  /**
   * Update inventory item
   * Access: MANAGER, ADMIN
   */
  @Patch(':id')
  @Roles('MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Update inventory item' })
  async update(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateInventoryItemDto,
  ) {
    return this.inventoryService.update(organizationId, id, dto);
  }

  /**
   * Adjust inventory quantity
   * Access: OPERATOR, MANAGER, ADMIN
   */
  @Post(':id/adjust')
  @Roles('OPERATOR', 'MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Adjust inventory quantity' })
  async adjust(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
    @Body() dto: AdjustInventoryDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.inventoryService.adjust(organizationId, id, dto, user.userId);
  }

  /**
   * Delete inventory item
   * Access: ADMIN only
   */
  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete inventory item' })
  async delete(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
  ) {
    return this.inventoryService.delete(organizationId, id);
  }
}

