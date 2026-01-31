/**
 * Currency Service Unit Tests
 * Phase B: Write Tests First (TDD)
 * 
 * Tests for GAP-20: Multi-Currency Support
 * Target: 15 unit tests
 */

import { CurrencyService, Currency, CURRENCIES } from '../../src/modules/currency/currency.service';
import { PrismaService } from '../../src/common/database/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('CurrencyService', () => {
    let service: CurrencyService;
    let prisma: jest.Mocked<PrismaService>;

    const mockOrganizationId = 'org-123';

    const mockOrganization = {
        id: mockOrganizationId,
        name: 'شركة اختبار',
        defaultCurrency: 'SAR',
        supportedCurrencies: ['SAR', 'EGP'],
    };

    beforeEach(() => {
        prisma = {
            organization: {
                findUnique: jest.fn(),
                update: jest.fn(),
            },
        } as any;

        service = new CurrencyService(prisma);
    });

    // ========================================
    // GET AVAILABLE CURRENCIES TESTS
    // ========================================

    describe('getAvailableCurrencies', () => {
        it('should return all 5 currencies', () => {
            const result = service.getAvailableCurrencies();

            expect(result).toHaveLength(5);
            expect(result.map(c => c.code)).toEqual(['EGP', 'SAR', 'AED', 'USD', 'EUR']);
        });
    });

    // ========================================
    // GET CURRENCY BY CODE TESTS
    // ========================================

    describe('getCurrencyByCode', () => {
        it('should return currency details for valid code', () => {
            const result = service.getCurrencyByCode('SAR');

            expect(result).toBeDefined();
            expect(result.code).toBe('SAR');
            expect(result.symbol).toBe('ر.س');
            expect(result.nameAr).toBe('الريال السعودي');
        });

        it('should throw NotFoundException for invalid code', () => {
            expect(() => service.getCurrencyByCode('INVALID')).toThrow(NotFoundException);
        });
    });

    // ========================================
    // GET ORG CURRENCY SETTINGS TESTS
    // ========================================

    describe('getOrgCurrencySettings', () => {
        it('should return org currency settings', async () => {
            prisma.organization.findUnique.mockResolvedValue(mockOrganization);

            const result = await service.getOrgCurrencySettings(mockOrganizationId);

            expect(result.defaultCurrency).toBe('SAR');
            expect(result.supportedCurrencies).toEqual(['SAR', 'EGP']);
        });
    });

    // ========================================
    // UPDATE CURRENCY SETTINGS TESTS
    // ========================================

    describe('updateCurrencySettings', () => {
        it('should update default currency', async () => {
            prisma.organization.findUnique.mockResolvedValue(mockOrganization);
            prisma.organization.update.mockResolvedValue({
                ...mockOrganization,
                defaultCurrency: 'EGP',
                supportedCurrencies: ['SAR', 'EGP'],
            });

            const result = await service.updateCurrencySettings(mockOrganizationId, {
                defaultCurrency: 'EGP',
            });

            expect(result.defaultCurrency).toBe('EGP');
        });

        it('should validate currency code', async () => {
            prisma.organization.findUnique.mockResolvedValue(mockOrganization);

            await expect(
                service.updateCurrencySettings(mockOrganizationId, {
                    defaultCurrency: 'INVALID',
                })
            ).rejects.toThrow(BadRequestException);
        });

        it('should add supported currencies', async () => {
            prisma.organization.findUnique.mockResolvedValue(mockOrganization);
            prisma.organization.update.mockResolvedValue({
                ...mockOrganization,
                supportedCurrencies: ['SAR', 'EGP', 'USD'],
            });

            const result = await service.updateCurrencySettings(mockOrganizationId, {
                supportedCurrencies: ['SAR', 'EGP', 'USD'],
            });

            expect(result.supportedCurrencies).toContain('USD');
        });

        it('should remove currency from supported', async () => {
            prisma.organization.findUnique.mockResolvedValue(mockOrganization);
            prisma.organization.update.mockResolvedValue({
                ...mockOrganization,
                defaultCurrency: 'SAR',
                supportedCurrencies: ['SAR'],
            });

            const result = await service.updateCurrencySettings(mockOrganizationId, {
                supportedCurrencies: ['SAR'],
            });

            expect(result.supportedCurrencies).not.toContain('EGP');
        });

        it('should not allow removing default from supported', async () => {
            prisma.organization.findUnique.mockResolvedValue(mockOrganization);

            await expect(
                service.updateCurrencySettings(mockOrganizationId, {
                    supportedCurrencies: ['EGP'], // Missing SAR which is default
                })
            ).rejects.toThrow(BadRequestException);
        });
    });

    // ========================================
    // FORMAT PRICE TESTS
    // ========================================

    describe('formatPrice', () => {
        it('should format with symbol after (Arabic currencies)', () => {
            const result = service.formatPrice(1234.56, 'SAR');

            expect(result.formatted).toBe('1,234.56 ر.س');
        });

        it('should format with symbol before (USD)', () => {
            const result = service.formatPrice(1234.56, 'USD');

            expect(result.formatted).toBe('$1,234.56');
        });

        it('should handle decimal places correctly', () => {
            const result = service.formatPrice(1234.5, 'SAR');

            expect(result.formatted).toBe('1,234.50 ر.س');
        });

        it('should handle large numbers with commas', () => {
            const result = service.formatPrice(1234567.89, 'EGP');

            expect(result.formatted).toBe('1,234,567.89 ج.م');
        });
    });

    // ========================================
    // PARSE FORMATTED PRICE TESTS
    // ========================================

    describe('parseFormattedPrice', () => {
        it('should extract raw value from formatted price', () => {
            const result = service.parseFormattedPrice('1,234.56 ر.س');

            expect(result).toBe(1234.56);
        });
    });

    // ========================================
    // VALIDATE CURRENCY CODE TESTS
    // ========================================

    describe('validateCurrencyCode', () => {
        it('should return true for valid codes', () => {
            expect(service.validateCurrencyCode('SAR')).toBe(true);
            expect(service.validateCurrencyCode('EGP')).toBe(true);
            expect(service.validateCurrencyCode('USD')).toBe(true);
        });

        it('should return false for invalid codes', () => {
            expect(service.validateCurrencyCode('INVALID')).toBe(false);
            expect(service.validateCurrencyCode('')).toBe(false);
        });
    });
});
