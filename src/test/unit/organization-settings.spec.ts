/**
 * Organization Settings Unit Tests
 * Phase B: Write Tests First (TDD)
 * 
 * Tests for GAP-10: Organization Settings
 * Target: 18 unit tests
 */

import { OrganizationSettingsService } from '../../src/modules/organizations/organization-settings.service';
import { PrismaService } from '../../src/common/database/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('OrganizationSettingsService', () => {
    let service: OrganizationSettingsService;
    let prisma: jest.Mocked<PrismaService>;

    const mockOrganizationId = 'org-123';

    const mockOrganization = {
        id: mockOrganizationId,
        name: 'شركة اختبار',
        logo: null,
        timezone: 'Asia/Riyadh',
        isActive: true,
        settings: {
            notifications: {
                emailEnabled: true,
                lowStockAlerts: true,
                orderAlerts: true,
                weeklyReport: false,
            },
            general: {
                dateFormat: 'DD/MM/YYYY',
                language: 'ar',
            },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    const mockCounts = {
        users: 5,
        warehouses: 3,
        products: 150,
        orders: { total: 1000, thisMonth: 45, pending: 12 },
        inventory: { totalItems: 500, lowStock: 8, outOfStock: 2 },
    };

    beforeEach(() => {
        prisma = {
            organization: {
                findUnique: jest.fn(),
                update: jest.fn(),
            },
            userOrganization: {
                count: jest.fn(),
            },
            warehouse: {
                count: jest.fn(),
            },
            product: {
                count: jest.fn(),
            },
            order: {
                count: jest.fn(),
            },
            inventoryLevel: {
                count: jest.fn(),
                aggregate: jest.fn(),
            },
        } as any;

        service = new OrganizationSettingsService(prisma);
    });

    // ========================================
    // GET CURRENT ORGANIZATION TESTS
    // ========================================

    describe('getCurrentOrganization', () => {
        it('should return org profile', async () => {
            prisma.organization.findUnique.mockResolvedValue(mockOrganization);

            const result = await service.getCurrentOrganization(mockOrganizationId);

            expect(result).toBeDefined();
            expect(result.id).toBe(mockOrganizationId);
            expect(result.name).toBe('شركة اختبار');
        });

        it('should include computed stats', async () => {
            prisma.organization.findUnique.mockResolvedValue(mockOrganization);
            prisma.userOrganization.count.mockResolvedValue(5);
            prisma.warehouse.count.mockResolvedValue(3);
            prisma.product.count.mockResolvedValue(150);
            prisma.order.count.mockResolvedValue(1000);

            const result = await service.getCurrentOrganization(mockOrganizationId, { includeStats: true });

            expect(result.usersCount).toBe(5);
            expect(result.warehousesCount).toBe(3);
        });
    });

    // ========================================
    // UPDATE ORGANIZATION TESTS
    // ========================================

    describe('updateOrganization', () => {
        it('should update name', async () => {
            prisma.organization.findUnique.mockResolvedValue(mockOrganization);
            prisma.organization.update.mockResolvedValue({
                ...mockOrganization,
                name: 'اسم جديد',
            });

            const result = await service.updateOrganization(mockOrganizationId, {
                name: 'اسم جديد',
            });

            expect(result.name).toBe('اسم جديد');
        });

        it('should update logo', async () => {
            prisma.organization.findUnique.mockResolvedValue(mockOrganization);
            prisma.organization.update.mockResolvedValue({
                ...mockOrganization,
                logo: 'https://example.com/logo.png',
            });

            const result = await service.updateOrganization(mockOrganizationId, {
                logo: 'https://example.com/logo.png',
            });

            expect(result.logo).toBe('https://example.com/logo.png');
        });

        it('should update timezone', async () => {
            prisma.organization.findUnique.mockResolvedValue(mockOrganization);
            prisma.organization.update.mockResolvedValue({
                ...mockOrganization,
                timezone: 'Africa/Cairo',
            });

            const result = await service.updateOrganization(mockOrganizationId, {
                timezone: 'Africa/Cairo',
            });

            expect(result.timezone).toBe('Africa/Cairo');
        });

        it('should validate timezone', async () => {
            prisma.organization.findUnique.mockResolvedValue(mockOrganization);

            await expect(
                service.updateOrganization(mockOrganizationId, {
                    timezone: 'Invalid/Timezone',
                })
            ).rejects.toThrow(BadRequestException);
        });
    });

    // ========================================
    // GET SETTINGS TESTS
    // ========================================

    describe('getSettings', () => {
        it('should return settings', async () => {
            prisma.organization.findUnique.mockResolvedValue(mockOrganization);

            const result = await service.getSettings(mockOrganizationId);

            expect(result.notifications).toBeDefined();
            expect(result.notifications.emailEnabled).toBe(true);
        });

        it('should return defaults if settings is null', async () => {
            prisma.organization.findUnique.mockResolvedValue({
                ...mockOrganization,
                settings: null,
            });

            const result = await service.getSettings(mockOrganizationId);

            expect(result.notifications).toBeDefined();
            expect(result.notifications.emailEnabled).toBe(true); // default
            expect(result.general.language).toBe('ar'); // default
        });
    });

    // ========================================
    // UPDATE SETTINGS TESTS
    // ========================================

    describe('updateSettings', () => {
        it('should update notification settings', async () => {
            prisma.organization.findUnique.mockResolvedValue(mockOrganization);
            prisma.organization.update.mockResolvedValue({
                ...mockOrganization,
                settings: {
                    ...mockOrganization.settings,
                    notifications: {
                        ...mockOrganization.settings.notifications,
                        weeklyReport: true,
                    },
                },
            });

            const result = await service.updateSettings(mockOrganizationId, {
                notifications: { weeklyReport: true },
            });

            expect(result.notifications.weeklyReport).toBe(true);
        });

        it('should update general settings', async () => {
            prisma.organization.findUnique.mockResolvedValue(mockOrganization);
            prisma.organization.update.mockResolvedValue({
                ...mockOrganization,
                settings: {
                    ...mockOrganization.settings,
                    general: {
                        ...mockOrganization.settings.general,
                        dateFormat: 'YYYY-MM-DD',
                    },
                },
            });

            const result = await service.updateSettings(mockOrganizationId, {
                general: { dateFormat: 'YYYY-MM-DD' },
            });

            expect(result.general.dateFormat).toBe('YYYY-MM-DD');
        });

        it('should allow partial update', async () => {
            prisma.organization.findUnique.mockResolvedValue(mockOrganization);
            prisma.organization.update.mockResolvedValue({
                ...mockOrganization,
                settings: {
                    ...mockOrganization.settings,
                    notifications: {
                        ...mockOrganization.settings.notifications,
                        lowStockAlerts: false,
                    },
                },
            });

            const result = await service.updateSettings(mockOrganizationId, {
                notifications: { lowStockAlerts: false },
            });

            // Other settings should remain unchanged
            expect(result.notifications.emailEnabled).toBe(true);
            expect(result.notifications.lowStockAlerts).toBe(false);
        });
    });

    // ========================================
    // GET STATS TESTS
    // ========================================

    describe('getStats', () => {
        beforeEach(() => {
            prisma.organization.findUnique.mockResolvedValue(mockOrganization);
        });

        it('should return user count', async () => {
            prisma.userOrganization.count.mockResolvedValue(5);
            prisma.warehouse.count.mockResolvedValue(0);
            prisma.product.count.mockResolvedValue(0);
            prisma.order.count.mockResolvedValue(0);
            prisma.inventoryLevel.count.mockResolvedValue(0);

            const result = await service.getStats(mockOrganizationId);

            expect(result.users).toBe(5);
        });

        it('should return warehouse count', async () => {
            prisma.userOrganization.count.mockResolvedValue(0);
            prisma.warehouse.count.mockResolvedValue(3);
            prisma.product.count.mockResolvedValue(0);
            prisma.order.count.mockResolvedValue(0);
            prisma.inventoryLevel.count.mockResolvedValue(0);

            const result = await service.getStats(mockOrganizationId);

            expect(result.warehouses).toBe(3);
        });

        it('should return product count', async () => {
            prisma.userOrganization.count.mockResolvedValue(0);
            prisma.warehouse.count.mockResolvedValue(0);
            prisma.product.count.mockResolvedValue(150);
            prisma.order.count.mockResolvedValue(0);
            prisma.inventoryLevel.count.mockResolvedValue(0);

            const result = await service.getStats(mockOrganizationId);

            expect(result.products).toBe(150);
        });

        it('should return order counts (total, thisMonth, pending)', async () => {
            prisma.userOrganization.count.mockResolvedValue(0);
            prisma.warehouse.count.mockResolvedValue(0);
            prisma.product.count.mockResolvedValue(0);
            prisma.order.count
                .mockResolvedValueOnce(1000) // total
                .mockResolvedValueOnce(45)   // thisMonth
                .mockResolvedValueOnce(12);  // pending
            prisma.inventoryLevel.count.mockResolvedValue(0);

            const result = await service.getStats(mockOrganizationId);

            expect(result.orders.total).toBe(1000);
            expect(result.orders.thisMonth).toBe(45);
            expect(result.orders.pending).toBe(12);
        });

        it('should return inventory stats (total, low, out)', async () => {
            prisma.userOrganization.count.mockResolvedValue(0);
            prisma.warehouse.count.mockResolvedValue(0);
            prisma.product.count.mockResolvedValue(0);
            prisma.order.count.mockResolvedValue(0);
            prisma.inventoryLevel.count
                .mockResolvedValueOnce(500) // total
                .mockResolvedValueOnce(8)   // low stock
                .mockResolvedValueOnce(2);  // out of stock

            const result = await service.getStats(mockOrganizationId);

            expect(result.inventory.totalItems).toBe(500);
            expect(result.inventory.lowStock).toBe(8);
            expect(result.inventory.outOfStock).toBe(2);
        });
    });

    // ========================================
    // TIMEZONE VALIDATION TESTS
    // ========================================

    describe('validateTimezone', () => {
        it('should accept valid timezone', () => {
            expect(service.validateTimezone('Asia/Riyadh')).toBe(true);
            expect(service.validateTimezone('Africa/Cairo')).toBe(true);
            expect(service.validateTimezone('Europe/London')).toBe(true);
        });

        it('should reject invalid timezone', () => {
            expect(service.validateTimezone('Invalid/Zone')).toBe(false);
            expect(service.validateTimezone('')).toBe(false);
        });
    });
});
