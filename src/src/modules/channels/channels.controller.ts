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
import { ChannelsService } from './channels.service';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { SubscriptionGuard } from '@common/guards/subscription.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { OrganizationId } from '@common/decorators/organization.decorator';
import { RequiresActiveSubscription } from '@common/decorators/subscription.decorator';

/**
 * Channels Controller - REST API for Sales Channel Management
 * 
 * RBAC Permissions (AUTH-01):
 * - View channels: OPERATOR, MANAGER, ADMIN
 * - Connect/Disconnect: ADMIN only
 * - Configure settings: ADMIN only
 * - Trigger sync: MANAGER, ADMIN
 * 
 * Subscription Status (BILL-03):
 * - SUSPENDED/CANCELLED: Read-only (GET allowed, POST/PATCH/DELETE blocked)
 * - TRIAL/ACTIVE/PAST_DUE: Full access
 */
@ApiTags('Channels')
@Controller('channels')
@UseGuards(JwtAuthGuard, RolesGuard, SubscriptionGuard)
@ApiBearerAuth()
@RequiresActiveSubscription()
export class ChannelsController {
  constructor(private channelsService: ChannelsService) { }

  /**
   * Create a new sales channel (connect)
   * Access: ADMIN only
   */
  @Post()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create a new sales channel' })
  async create(
    @OrganizationId() organizationId: string,
    @Body() dto: CreateChannelDto,
  ) {
    return this.channelsService.create(organizationId, dto);
  }

  /**
   * Get all channels
   * Access: OPERATOR, MANAGER, ADMIN
   */
  @Get()
  @Roles('OPERATOR', 'MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Get all channels' })
  async findAll(@OrganizationId() organizationId: string) {
    return this.channelsService.findAll(organizationId);
  }

  /**
   * Get channel by ID
   * Access: OPERATOR, MANAGER, ADMIN
   */
  @Get(':id')
  @Roles('OPERATOR', 'MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Get channel by ID' })
  async findOne(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
  ) {
    return this.channelsService.findOne(organizationId, id);
  }

  /**
   * Update channel configuration
   * Access: ADMIN only
   */
  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update channel' })
  async update(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateChannelDto,
  ) {
    return this.channelsService.update(organizationId, id, dto);
  }

  /**
   * Delete (disconnect) channel
   * Access: ADMIN only
   */
  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete channel' })
  async delete(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
  ) {
    return this.channelsService.delete(organizationId, id);
  }

  /**
   * Test channel connection / Trigger sync
   * Access: MANAGER, ADMIN
   */
  @Post(':id/test')
  @Roles('MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Test channel connection' })
  async testConnection(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
  ) {
    return this.channelsService.testConnection(organizationId, id);
  }
}

