/**
 * Warehouse Service Unit Tests
 * Phase B: Write Tests First
 * 
 * Tests for GAP-01: Warehouse CRUD
 * Target: 25 unit tests
 */

import { WarehouseService } from '../../src/modules/warehouses/warehouse.service';
import { PrismaService } from '../../src/common/database/prisma.service';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';

describe('WarehouseService', () => {
    let service: WarehouseService;
    let prisma: jest.Mocked<PrismaService>;

    const mockOrganizationId = 'org-123';
    const mockUserId = 'user-123';

    const mockWarehouse = {
        id: 'wh-123',
        organizationId: mockOrganizationId,
        name: 'مستودع الرياض',
        code: 'WH-RIYADH',
        address: {
            street: 'شارع العليا',
            city: 'الرياض',
            country: 'السعودية',
            postalCode: '12345',
        },
        capacity: 10000,
        contactName: 'أحمد محمد',
        contactPhone: '+966501234567',
        contactEmail: 'ahmed@example.com',
        isActive: true,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    beforeEach(() => {
        prisma = {
            warehouse: {
                create: jest.fn(),
                findMany: jest.fn(),
                findFirst: jest.fn(),
                findUnique: jest.fn(),
                update: jest.fn(),
                updateMany: jest.fn(),
                delete: jest.fn(),
                count: jest.fn(),
            },
            inventoryReservation: {
                count: jest.fn(),
            },
            inventoryLevel: {
                count: jest.fn(),
                aggregate: jest.fn(),
            },
            $transaction: jest.fn((fn) => fn(prisma)),
        } as any;

        service = new WarehouseService(prisma);
    });

    // ========================================
    // CREATE WAREHOUSE TESTS
    // ========================================

    describe('createWarehouse', () => {
        it('should create a warehouse successfully', async () => {
            const dto = {
                name: 'مستودع الرياض',
                code: 'WH-RIYADH',
                address: {
                    street: 'شارع العليا',
                    city: 'الرياض',
                    country: 'السعودية',
                },
                capacity: 10000,
            };

            prisma.warehouse.findFirst.mockResolvedValue(null);
            prisma.warehouse.create.mockResolvedValue(mockWarehouse);

            const result = await service.createWarehouse(mockOrganizationId, dto);

            expect(result).toEqual(mockWarehouse);
            expect(prisma.warehouse.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    organizationId: mockOrganizationId,
                    name: dto.name,
                    code: dto.code,
                }),
            });
        });

        it('should auto-generate code if not provided', async () => {
            const dto = {
                name: 'مستودع جدة',
            };

            prisma.warehouse.findFirst.mockResolvedValue(null);
            prisma.warehouse.count.mockResolvedValue(5);
            prisma.warehouse.create.mockResolvedValue({
                ...mockWarehouse,
                name: 'مستودع جدة',
                code: 'WH-006',
            });

            await service.createWarehouse(mockOrganizationId, dto);

            expect(prisma.warehouse.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    code: expect.stringMatching(/^WH-/),
                }),
            });
        });

        it('should throw error for duplicate warehouse name', async () => {
            const dto = {
                name: 'مستودع الرياض',
            };

            prisma.warehouse.findFirst.mockResolvedValue(mockWarehouse);

            await expect(
                service.createWarehouse(mockOrganizationId, dto)
            ).rejects.toThrow(BadRequestException);
        });

        it('should throw error for duplicate warehouse code', async () => {
            const dto = {
                name: 'مستودع جديد',
                code: 'WH-RIYADH',
            };

            prisma.warehouse.findFirst
                .mockResolvedValueOnce(null) // name check
                .mockResolvedValueOnce(mockWarehouse); // code check

            await expect(
                service.createWarehouse(mockOrganizationId, dto)
            ).rejects.toThrow(BadRequestException);
        });

        it('should set first warehouse as default', async () => {
            const dto = { name: 'First Warehouse' };

            prisma.warehouse.findFirst.mockResolvedValue(null);
            prisma.warehouse.count.mockResolvedValue(0);
            prisma.warehouse.create.mockResolvedValue({
                ...mockWarehouse,
                isDefault: true,
            });

            const result = await service.createWarehouse(mockOrganizationId, dto);

            expect(prisma.warehouse.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    isDefault: true,
                }),
            });
        });
    });

    // ========================================
    // GET WAREHOUSES TESTS
    // ========================================

    describe('getWarehouses', () => {
        it('should return warehouses for organization', async () => {
            const warehouses = [mockWarehouse];
            prisma.warehouse.findMany.mockResolvedValue(warehouses);
            prisma.warehouse.count.mockResolvedValue(1);

            const result = await service.getWarehouses(mockOrganizationId, {});

            expect(result.data).toEqual(warehouses);
            expect(result.meta.total).toBe(1);
        });

        it('should filter by active status', async () => {
            prisma.warehouse.findMany.mockResolvedValue([mockWarehouse]);
            prisma.warehouse.count.mockResolvedValue(1);

            await service.getWarehouses(mockOrganizationId, { isActive: true });

            expect(prisma.warehouse.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        isActive: true,
                    }),
                })
            );
        });

        it('should support pagination', async () => {
            prisma.warehouse.findMany.mockResolvedValue([mockWarehouse]);
            prisma.warehouse.count.mockResolvedValue(25);

            const result = await service.getWarehouses(mockOrganizationId, {
                page: 2,
                pageSize: 10,
            });

            expect(prisma.warehouse.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    skip: 10,
                    take: 10,
                })
            );
            expect(result.meta.page).toBe(2);
            expect(result.meta.pageSize).toBe(10);
        });

        it('should search by name', async () => {
            prisma.warehouse.findMany.mockResolvedValue([mockWarehouse]);
            prisma.warehouse.count.mockResolvedValue(1);

            await service.getWarehouses(mockOrganizationId, { search: 'الرياض' });

            expect(prisma.warehouse.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        OR: expect.arrayContaining([
                            expect.objectContaining({
                                name: expect.objectContaining({ contains: 'الرياض' }),
                            }),
                        ]),
                    }),
                })
            );
        });

        it('should enforce organization isolation', async () => {
            const otherOrgId = 'other-org';
            prisma.warehouse.findMany.mockResolvedValue([]);
            prisma.warehouse.count.mockResolvedValue(0);

            await service.getWarehouses(otherOrgId, {});

            expect(prisma.warehouse.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        organizationId: otherOrgId,
                    }),
                })
            );
        });
    });

    // ========================================
    // GET WAREHOUSE BY ID TESTS
    // ========================================

    describe('getWarehouseById', () => {
        it('should return warehouse by id', async () => {
            prisma.warehouse.findFirst.mockResolvedValue(mockWarehouse);

            const result = await service.getWarehouseById(mockOrganizationId, 'wh-123');

            expect(result).toEqual(mockWarehouse);
        });

        it('should throw NotFoundException for non-existent warehouse', async () => {
            prisma.warehouse.findFirst.mockResolvedValue(null);

            await expect(
                service.getWarehouseById(mockOrganizationId, 'non-existent')
            ).rejects.toThrow(NotFoundException);
        });

        it('should include stats when requested', async () => {
            prisma.warehouse.findFirst.mockResolvedValue(mockWarehouse);
            prisma.inventoryLevel.aggregate.mockResolvedValue({
                _sum: { available: 1000, reserved: 200 },
                _count: { id: 50 },
            });

            const result = await service.getWarehouseById(
                mockOrganizationId,
                'wh-123',
                { includeStats: true }
            );

            expect(result).toHaveProperty('stats');
        });
    });

    // ========================================
    // UPDATE WAREHOUSE TESTS
    // ========================================

    describe('updateWarehouse', () => {
        it('should update warehouse successfully', async () => {
            const updateDto = { name: 'مستودع جدة المحدث' };

            prisma.warehouse.findFirst
                .mockResolvedValueOnce(mockWarehouse) // exists check
                .mockResolvedValueOnce(null); // duplicate name check
            prisma.warehouse.update.mockResolvedValue({
                ...mockWarehouse,
                name: updateDto.name,
            });

            const result = await service.updateWarehouse(
                mockOrganizationId,
                'wh-123',
                updateDto
            );

            expect(result.name).toBe(updateDto.name);
        });

        it('should throw error for duplicate name on update', async () => {
            const updateDto = { name: 'Existing Name' };

            prisma.warehouse.findFirst
                .mockResolvedValueOnce(mockWarehouse) // exists check
                .mockResolvedValueOnce({ ...mockWarehouse, id: 'other-wh' }); // duplicate check

            await expect(
                service.updateWarehouse(mockOrganizationId, 'wh-123', updateDto)
            ).rejects.toThrow(BadRequestException);
        });

        it('should throw NotFoundException for non-existent warehouse', async () => {
            prisma.warehouse.findFirst.mockResolvedValue(null);

            await expect(
                service.updateWarehouse(mockOrganizationId, 'non-existent', { name: 'test' })
            ).rejects.toThrow(NotFoundException);
        });

        it('should update address fields', async () => {
            const updateDto = {
                address: {
                    street: 'شارع جديد',
                    city: 'جدة',
                },
            };

            prisma.warehouse.findFirst.mockResolvedValue(mockWarehouse);
            prisma.warehouse.update.mockResolvedValue({
                ...mockWarehouse,
                address: updateDto.address,
            });

            await service.updateWarehouse(mockOrganizationId, 'wh-123', updateDto);

            expect(prisma.warehouse.update).toHaveBeenCalledWith({
                where: { id: 'wh-123' },
                data: expect.objectContaining({
                    address: updateDto.address,
                }),
            });
        });
    });

    // ========================================
    // DELETE WAREHOUSE TESTS
    // ========================================

    describe('deleteWarehouse', () => {
        it('should delete empty warehouse successfully', async () => {
            prisma.warehouse.findFirst.mockResolvedValue(mockWarehouse);
            prisma.inventoryReservation.count.mockResolvedValue(0);
            prisma.inventoryLevel.count.mockResolvedValue(0);
            prisma.warehouse.delete.mockResolvedValue(mockWarehouse);

            await service.deleteWarehouse(mockOrganizationId, 'wh-123');

            expect(prisma.warehouse.delete).toHaveBeenCalledWith({
                where: { id: 'wh-123' },
            });
        });

        it('should throw error for warehouse with active reservations', async () => {
            prisma.warehouse.findFirst.mockResolvedValue(mockWarehouse);
            prisma.inventoryReservation.count.mockResolvedValue(5);

            await expect(
                service.deleteWarehouse(mockOrganizationId, 'wh-123')
            ).rejects.toThrow(BadRequestException);
        });

        it('should soft-delete warehouse with inventory (no reservations)', async () => {
            prisma.warehouse.findFirst.mockResolvedValue(mockWarehouse);
            prisma.inventoryReservation.count.mockResolvedValue(0);
            prisma.inventoryLevel.count.mockResolvedValue(10);
            prisma.warehouse.update.mockResolvedValue({
                ...mockWarehouse,
                isActive: false,
            });

            await service.deleteWarehouse(mockOrganizationId, 'wh-123');

            expect(prisma.warehouse.update).toHaveBeenCalledWith({
                where: { id: 'wh-123' },
                data: { isActive: false },
            });
        });

        it('should throw NotFoundException for non-existent warehouse', async () => {
            prisma.warehouse.findFirst.mockResolvedValue(null);

            await expect(
                service.deleteWarehouse(mockOrganizationId, 'non-existent')
            ).rejects.toThrow(NotFoundException);
        });

        it('should prevent deleting default warehouse if others exist', async () => {
            const defaultWarehouse = { ...mockWarehouse, isDefault: true };
            prisma.warehouse.findFirst.mockResolvedValue(defaultWarehouse);
            prisma.warehouse.count.mockResolvedValue(3);

            await expect(
                service.deleteWarehouse(mockOrganizationId, 'wh-123')
            ).rejects.toThrow(BadRequestException);
        });
    });

    // ========================================
    // SET DEFAULT WAREHOUSE TESTS
    // ========================================

    describe('setDefaultWarehouse', () => {
        it('should set warehouse as default', async () => {
            prisma.warehouse.findFirst.mockResolvedValue(mockWarehouse);
            prisma.warehouse.updateMany.mockResolvedValue({ count: 1 });
            prisma.warehouse.update.mockResolvedValue({
                ...mockWarehouse,
                isDefault: true,
            });

            const result = await service.setDefaultWarehouse(
                mockOrganizationId,
                'wh-123'
            );

            expect(result.isDefault).toBe(true);
            expect(prisma.warehouse.updateMany).toHaveBeenCalledWith({
                where: { organizationId: mockOrganizationId, isDefault: true },
                data: { isDefault: false },
            });
        });

        it('should throw NotFoundException for non-existent warehouse', async () => {
            prisma.warehouse.findFirst.mockResolvedValue(null);

            await expect(
                service.setDefaultWarehouse(mockOrganizationId, 'non-existent')
            ).rejects.toThrow(NotFoundException);
        });
    });

    // ========================================
    // WAREHOUSE STATS TESTS
    // ========================================

    describe('getWarehouseStats', () => {
        it('should return correct inventory stats', async () => {
            prisma.warehouse.findFirst.mockResolvedValue(mockWarehouse);
            prisma.inventoryLevel.aggregate.mockResolvedValue({
                _sum: { available: 5000, reserved: 1000, damaged: 50 },
            });
            prisma.inventoryLevel.count
                .mockResolvedValueOnce(100) // total items
                .mockResolvedValueOnce(15); // low stock items

            const result = await service.getWarehouseStats(
                mockOrganizationId,
                'wh-123'
            );

            expect(result).toEqual({
                totalItems: 100,
                totalQuantity: 5000,
                reservedQuantity: 1000,
                damagedQuantity: 50,
                lowStockItems: 15,
            });
        });

        it('should return zeros for empty warehouse', async () => {
            prisma.warehouse.findFirst.mockResolvedValue(mockWarehouse);
            prisma.inventoryLevel.aggregate.mockResolvedValue({
                _sum: { available: null, reserved: null, damaged: null },
            });
            prisma.inventoryLevel.count.mockResolvedValue(0);

            const result = await service.getWarehouseStats(
                mockOrganizationId,
                'wh-123'
            );

            expect(result.totalItems).toBe(0);
            expect(result.totalQuantity).toBe(0);
        });
    });
});
