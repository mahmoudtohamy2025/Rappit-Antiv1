/**
 * Currency Controller
 * GAP-20: Multi-Currency Support Implementation
 * 
 * RESTful API endpoints for currency management
 */

import {
    Controller,
    Get,
    Patch,
    Body,
    UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrencyService, UpdateCurrencySettingsDto } from './currency.service';

interface AuthUser {
    userId: string;
    organizationId: string;
    role: string;
}

@ApiTags('Currency')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class CurrencyController {
    constructor(private readonly currencyService: CurrencyService) { }

    /**
     * Get all available currencies
     */
    @Get('currencies')
    @ApiOperation({ summary: 'Get all available currencies' })
    getCurrencies() {
        return this.currencyService.getAvailableCurrencies();
    }

    /**
     * Get organization currency settings
     */
    @Get('organizations/current/currency')
    @ApiOperation({ summary: 'Get organization currency settings' })
    getOrgCurrencySettings(@CurrentUser() user: AuthUser) {
        return this.currencyService.getOrgCurrencySettings(user.organizationId);
    }

    /**
     * Update organization currency settings
     */
    @Patch('organizations/current/currency')
    @Roles('ADMIN')
    @ApiOperation({ summary: 'Update organization currency settings' })
    updateCurrencySettings(
        @CurrentUser() user: AuthUser,
        @Body() dto: UpdateCurrencySettingsDto,
    ) {
        return this.currencyService.updateCurrencySettings(user.organizationId, dto);
    }
}
