/**
 * Currency Service
 * GAP-20: Multi-Currency Support Implementation
 * 
 * Provides currency definitions, formatting, and organization settings
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';

// ============================================================
// CURRENCY DEFINITIONS
// ============================================================

export interface Currency {
    code: string;
    symbol: string;
    nameAr: string;
    nameEn: string;
    decimalPlaces: number;
    symbolPosition: 'before' | 'after';
}

export const CURRENCIES: Currency[] = [
    {
        code: 'EGP',
        symbol: 'ج.م',
        nameAr: 'الجنيه المصري',
        nameEn: 'Egyptian Pound',
        decimalPlaces: 2,
        symbolPosition: 'after',
    },
    {
        code: 'SAR',
        symbol: 'ر.س',
        nameAr: 'الريال السعودي',
        nameEn: 'Saudi Riyal',
        decimalPlaces: 2,
        symbolPosition: 'after',
    },
    {
        code: 'AED',
        symbol: 'د.إ',
        nameAr: 'الدرهم الإماراتي',
        nameEn: 'UAE Dirham',
        decimalPlaces: 2,
        symbolPosition: 'after',
    },
    {
        code: 'USD',
        symbol: '$',
        nameAr: 'الدولار الأمريكي',
        nameEn: 'US Dollar',
        decimalPlaces: 2,
        symbolPosition: 'before',
    },
    {
        code: 'EUR',
        symbol: '€',
        nameAr: 'اليورو',
        nameEn: 'Euro',
        decimalPlaces: 2,
        symbolPosition: 'before',
    },
];

// ============================================================
// DTOs
// ============================================================

export interface OrgCurrencySettings {
    defaultCurrency: string;
    supportedCurrencies: string[];
    defaultCurrencyDetails: Currency;
}

export interface UpdateCurrencySettingsDto {
    defaultCurrency?: string;
    supportedCurrencies?: string[];
}

export interface FormattedPrice {
    raw: number;
    formatted: string;
    currency: Currency;
}

// ============================================================
// SERVICE
// ============================================================

@Injectable()
export class CurrencyService {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Get all available currencies
     */
    getAvailableCurrencies(): Currency[] {
        return CURRENCIES;
    }

    /**
     * Get currency by code
     */
    getCurrencyByCode(code: string): Currency {
        const currency = CURRENCIES.find(c => c.code === code.toUpperCase());
        if (!currency) {
            throw new NotFoundException(`العملة غير موجودة: ${code}`);
        }
        return currency;
    }

    /**
     * Validate currency code
     */
    validateCurrencyCode(code: string): boolean {
        if (!code) return false;
        return CURRENCIES.some(c => c.code === code.toUpperCase());
    }

    /**
     * Get organization currency settings
     */
    async getOrgCurrencySettings(organizationId: string): Promise<OrgCurrencySettings> {
        const org = await this.prisma.organization.findUnique({
            where: { id: organizationId },
            select: {
                defaultCurrency: true,
                supportedCurrencies: true,
            },
        });

        if (!org) {
            throw new NotFoundException('المؤسسة غير موجودة');
        }

        // Handle legacy orgs without currency settings
        const defaultCurrency = (org as any).defaultCurrency || 'SAR';
        const supportedCurrencies = (org as any).supportedCurrencies || ['SAR'];

        return {
            defaultCurrency,
            supportedCurrencies,
            defaultCurrencyDetails: this.getCurrencyByCode(defaultCurrency),
        };
    }

    /**
     * Update organization currency settings
     */
    async updateCurrencySettings(
        organizationId: string,
        dto: UpdateCurrencySettingsDto,
    ): Promise<OrgCurrencySettings> {
        // Get current settings
        const org = await this.prisma.organization.findUnique({
            where: { id: organizationId },
        });

        if (!org) {
            throw new NotFoundException('المؤسسة غير موجودة');
        }

        const currentDefault = (org as any).defaultCurrency || 'SAR';
        const currentSupported = (org as any).supportedCurrencies || ['SAR'];

        // Validate new default currency
        if (dto.defaultCurrency) {
            if (!this.validateCurrencyCode(dto.defaultCurrency)) {
                throw new BadRequestException(`رمز العملة غير صالح: ${dto.defaultCurrency}`);
            }
        }

        // Validate supported currencies
        if (dto.supportedCurrencies) {
            for (const code of dto.supportedCurrencies) {
                if (!this.validateCurrencyCode(code)) {
                    throw new BadRequestException(`رمز العملة غير صالح: ${code}`);
                }
            }
        }

        // Determine final values
        const newDefault = dto.defaultCurrency || currentDefault;
        const newSupported = dto.supportedCurrencies || currentSupported;

        // Ensure default is in supported
        if (!newSupported.includes(newDefault)) {
            throw new BadRequestException('العملة الافتراضية يجب أن تكون ضمن العملات المدعومة');
        }

        // Update organization
        const updated = await this.prisma.organization.update({
            where: { id: organizationId },
            data: {
                defaultCurrency: newDefault,
                supportedCurrencies: newSupported,
            } as any,
            select: {
                defaultCurrency: true,
                supportedCurrencies: true,
            },
        });

        return {
            defaultCurrency: (updated as any).defaultCurrency,
            supportedCurrencies: (updated as any).supportedCurrencies,
            defaultCurrencyDetails: this.getCurrencyByCode((updated as any).defaultCurrency),
        };
    }

    /**
     * Format a price with currency symbol
     */
    formatPrice(amount: number, currencyCode: string): FormattedPrice {
        const currency = this.getCurrencyByCode(currencyCode);

        // Format number with commas and decimal places
        const formattedNumber = amount.toLocaleString('en-US', {
            minimumFractionDigits: currency.decimalPlaces,
            maximumFractionDigits: currency.decimalPlaces,
        });

        // Apply symbol position
        const formatted = currency.symbolPosition === 'before'
            ? `${currency.symbol}${formattedNumber}`
            : `${formattedNumber} ${currency.symbol}`;

        return {
            raw: amount,
            formatted,
            currency,
        };
    }

    /**
     * Parse a formatted price string to raw number
     */
    parseFormattedPrice(formattedPrice: string): number {
        // Remove all non-numeric characters except decimal point
        const cleanedString = formattedPrice
            .replace(/[^\d.,-]/g, '')
            .replace(/,/g, '');

        return parseFloat(cleanedString);
    }
}
