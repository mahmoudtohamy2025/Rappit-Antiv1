import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ShippingService } from './shipping.service';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { UpdateShipmentStatusDto } from './dto/update-shipment-status.dto';
import { ProcessReturnDto } from './dto/process-return.dto';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { OrganizationId } from '@common/decorators/organization.decorator';

/**
 * Shipping Controller - REST API for Shipment Management
 * 
 * RBAC Permissions (AUTH-01):
 * - View shipments: OPERATOR, MANAGER, ADMIN
 * - Create shipment: OPERATOR, MANAGER, ADMIN
 * - Track/Reprint label: OPERATOR, MANAGER, ADMIN
 * - Cancel shipment: MANAGER, ADMIN
 * - Process returns: MANAGER, ADMIN
 */
@ApiTags('Shipping')
@Controller('shipments')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ShippingController {
  constructor(private shippingService: ShippingService) { }

  /**
   * Create shipment and generate label
   * Access: OPERATOR, MANAGER, ADMIN
   */
  @Post()
  @Roles('OPERATOR', 'MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Create shipment and generate label' })
  async create(
    @OrganizationId() organizationId: string,
    @Body() dto: CreateShipmentDto,
  ) {
    return this.shippingService.createShipment(organizationId, dto);
  }

  /**
   * Process customer return (RMA)
   * Access: MANAGER, ADMIN
   */
  @Post('returns')
  @Roles('MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Process customer return' })
  async processReturn(
    @OrganizationId() organizationId: string,
    @Body() dto: ProcessReturnDto,
  ) {
    return this.shippingService.processReturn(organizationId, dto);
  }

  /**
   * Get all shipments
   * Access: OPERATOR, MANAGER, ADMIN
   */
  @Get()
  @Roles('OPERATOR', 'MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Get all shipments' })
  async findAll(@OrganizationId() organizationId: string) {
    return this.shippingService.findAll(organizationId);
  }

  /**
   * Get shipment details
   * Access: OPERATOR, MANAGER, ADMIN
   */
  @Get(':id')
  @Roles('OPERATOR', 'MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Get shipment details' })
  async findOne(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
  ) {
    return this.shippingService.findOne(organizationId, id);
  }

  /**
   * Update shipment status
   * Access: OPERATOR, MANAGER, ADMIN
   */
  @Patch(':id/status')
  @Roles('OPERATOR', 'MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Update shipment status' })
  async updateStatus(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateShipmentStatusDto,
  ) {
    return this.shippingService.updateStatus(organizationId, id, dto);
  }

  /**
   * Track shipment
   * Access: OPERATOR, MANAGER, ADMIN
   */
  @Get(':id/track')
  @Roles('OPERATOR', 'MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Track shipment' })
  async track(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
  ) {
    return this.shippingService.trackShipment(organizationId, id);
  }

  /**
   * Get shipping label (reprint)
   * Access: OPERATOR, MANAGER, ADMIN
   */
  @Get(':id/label')
  @Roles('OPERATOR', 'MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Get shipping label' })
  async getLabel(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
  ) {
    return this.shippingService.getLabel(organizationId, id);
  }

  /**
   * Cancel shipment
   * Access: MANAGER, ADMIN
   */
  @Delete(':id')
  @Roles('MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Cancel shipment' })
  async cancel(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
  ) {
    return this.shippingService.cancelShipment(organizationId, id);
  }
}

