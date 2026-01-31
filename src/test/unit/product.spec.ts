/**
 * Product Service Unit Tests
 * Phase B: Write Tests First (TDD)
 * 
 * Tests for GAP-02: Product/SKU CRUD
 * Target: 30 unit tests
 */

import { ProductService } from '../../src/modules/products/product.service';
import { PrismaService } from '../../src/common/database/prisma.service';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';

describe('ProductService', () => {
    let service: ProductService;
    let prisma: jest.Mocked<PrismaService>;

    const mockOrganizationId = 'org-123';
    const mockWarehouseId = 'wh-123';

    const mockProduct = {
        id: 'prod-123',
        organizationId: mockOrganizationId,
        name: 'منتج اختباري',
        description: 'وصف المنتج الاختباري',
        category: 'إلكترونيات',
        metadata: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        skus: [{
            id: 'sku-123',
            sku: 'SKU-001',
            barcode: '1234567890',
            metadata: null,
        }],
    };

    const mockSku = {
        id: 'sku-123',
        organizationId: mockOrganizationId,
        productId: 'prod-123',
        sku: 'SKU-001',
        barcode: '1234567890',
        price: 100,
        cost: 50,
        minStock: 10,
        maxStock: 1000,
        images: [],
        metadata: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    const mockInventoryLevel = {
        warehouseId: mockWarehouseId,
        available: 100,
        reserved: 20,
        damaged: 5,
        warehouse: {
            name: 'مستودع الرياض',
        },
    };

    beforeEach(() => {
        prisma = {
            product: {
                create: jest.fn(),
                findMany: jest.fn(),
                findFirst: jest.fn(),
                findUnique: jest.fn(),
                update: jest.fn(),
                delete: jest.fn(),
                count: jest.fn(),
            },
            sKU: {
                create: jest.fn(),
                findFirst: jest.fn(),
                findMany: jest.fn(),
                update: jest.fn(),
            },
            inventoryLevel: {
                findMany: jest.fn(),
                aggregate: jest.fn(),
                count: jest.fn(),
            },
            inventoryReservation: {
                count: jest.fn(),
            },
            inventoryAdjustment: {
                findMany: jest.fn(),
            },
            $transaction: jest.fn((fn) => fn(prisma)),
        } as any;

        service = new ProductService(prisma);
    });

    // ========================================
    // CREATE PRODUCT TESTS
    // ========================================

    describe('createProduct', () => {
        it('should create a product successfully', async () => {
            const dto = {
                name: 'منتج جديد',
                sku: 'SKU-NEW-001',
                description: 'وصف المنتج',
                category: 'إلكترونيات',
            };

            prisma.sKU.findFirst.mockResolvedValue(null);
            prisma.product.create.mockResolvedValue({
                ...mockProduct,
                name: dto.name,
            });
            prisma.sKU.create.mockResolvedValue({
                ...mockSku,
                sku: dto.sku,
            });

            const result = await service.createProduct(mockOrganizationId, dto);

            expect(result).toBeDefined();
            expect(prisma.product.create).toHaveBeenCalled();
        });

        it('should throw error for duplicate SKU', async () => {
            const dto = {
                name: 'منتج جديد',
                sku: 'SKU-001',
            };

            prisma.sKU.findFirst.mockResolvedValue(mockSku);

            await expect(
                service.createProduct(mockOrganizationId, dto)
            ).rejects.toThrow(BadRequestException);
        });

        it('should create product with initial stock', async () => {
            const dto = {
                name: 'منتج جديد',
                sku: 'SKU-NEW-002',
                initialStock: {
                    warehouseId: mockWarehouseId,
                    quantity: 50,
                },
            };

            prisma.sKU.findFirst.mockResolvedValue(null);
            prisma.product.create.mockResolvedValue(mockProduct);
            prisma.sKU.create.mockResolvedValue(mockSku);
            prisma.inventoryLevel.create = jest.fn().mockResolvedValue({});

            await service.createProduct(mockOrganizationId, dto);

            expect(prisma.inventoryLevel?.create || prisma.$transaction).toHaveBeenCalled();
        });

        it('should auto-generate SKU if not provided', async () => {
            const dto = {
                name: 'منتج بدون SKU',
            };

            prisma.sKU.findFirst.mockResolvedValue(null);
            prisma.sKU.count = jest.fn().mockResolvedValue(5);
            prisma.product.create.mockResolvedValue(mockProduct);
            prisma.sKU.create.mockResolvedValue({
                ...mockSku,
                sku: 'PRD-006',
            });

            await service.createProduct(mockOrganizationId, dto);

            expect(prisma.sKU.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        sku: expect.stringMatching(/^PRD-/),
                    }),
                })
            );
        });
    });

    // ========================================
    // GET PRODUCTS TESTS
    // ========================================

    describe('getProducts', () => {
        it('should return products with pagination', async () => {
            prisma.product.findMany.mockResolvedValue([mockProduct]);
            prisma.product.count.mockResolvedValue(1);

            const result = await service.getProducts(mockOrganizationId, {
                page: 1,
                pageSize: 25,
            });

            expect(result.data).toHaveLength(1);
            expect(result.meta.total).toBe(1);
            expect(result.meta.page).toBe(1);
        });

        it('should filter by category', async () => {
            prisma.product.findMany.mockResolvedValue([mockProduct]);
            prisma.product.count.mockResolvedValue(1);

            await service.getProducts(mockOrganizationId, {
                category: 'إلكترونيات',
            });

            expect(prisma.product.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        category: 'إلكترونيات',
                    }),
                })
            );
        });

        it('should filter by stock level (low)', async () => {
            prisma.product.findMany.mockResolvedValue([mockProduct]);
            prisma.product.count.mockResolvedValue(1);

            await service.getProducts(mockOrganizationId, {
                stockLevel: 'low',
            });

            // Should include inventory level filter
            expect(prisma.product.findMany).toHaveBeenCalled();
        });

        it('should filter by warehouse', async () => {
            prisma.product.findMany.mockResolvedValue([mockProduct]);
            prisma.product.count.mockResolvedValue(1);

            await service.getProducts(mockOrganizationId, {
                warehouseId: mockWarehouseId,
            });

            expect(prisma.product.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        skus: expect.objectContaining({
                            some: expect.objectContaining({
                                inventoryLevels: expect.anything(),
                            }),
                        }),
                    }),
                })
            );
        });

        it('should search by name or SKU', async () => {
            prisma.product.findMany.mockResolvedValue([mockProduct]);
            prisma.product.count.mockResolvedValue(1);

            await service.getProducts(mockOrganizationId, {
                search: 'اختبار',
            });

            expect(prisma.product.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        OR: expect.arrayContaining([
                            expect.objectContaining({
                                name: expect.objectContaining({ contains: 'اختبار' }),
                            }),
                        ]),
                    }),
                })
            );
        });

        it('should enforce organization isolation', async () => {
            const otherOrgId = 'other-org';
            prisma.product.findMany.mockResolvedValue([]);
            prisma.product.count.mockResolvedValue(0);

            await service.getProducts(otherOrgId, {});

            expect(prisma.product.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        organizationId: otherOrgId,
                    }),
                })
            );
        });
    });

    // ========================================
    // GET PRODUCT BY ID TESTS
    // ========================================

    describe('getProductById', () => {
        it('should return product by id', async () => {
            prisma.product.findFirst.mockResolvedValue(mockProduct);
            prisma.inventoryLevel.findMany.mockResolvedValue([mockInventoryLevel]);

            const result = await service.getProductById(mockOrganizationId, 'prod-123');

            expect(result).toEqual(expect.objectContaining({
                id: 'prod-123',
                name: mockProduct.name,
            }));
        });

        it('should throw NotFoundException for non-existent product', async () => {
            prisma.product.findFirst.mockResolvedValue(null);

            await expect(
                service.getProductById(mockOrganizationId, 'non-existent')
            ).rejects.toThrow(NotFoundException);
        });

        it('should include stock by warehouse', async () => {
            const mockProductWithStock = {
                ...mockProduct,
                skus: [{
                    ...mockProduct.skus[0],
                    inventoryLevels: [mockInventoryLevel]
                }]
            };
            prisma.product.findFirst.mockResolvedValue(mockProductWithStock as any);
            // prisma.inventoryLevel.findMany.mockResolvedValue([mockInventoryLevel]); // Not needed as service uses include scope

            const result = await service.getProductById(mockOrganizationId, 'prod-123');

            expect(result.stockByWarehouse).toBeDefined();
            expect(result.stockByWarehouse).toHaveLength(1);
        });
    });

    // ========================================
    // UPDATE PRODUCT TESTS
    // ========================================

    describe('updateProduct', () => {
        it('should update product successfully', async () => {
            const updateDto = { name: 'اسم محدث' };

            prisma.product.findFirst.mockResolvedValue(mockProduct);
            prisma.product.update.mockResolvedValue({
                ...mockProduct,
                name: updateDto.name,
            });

            const result = await service.updateProduct(
                mockOrganizationId,
                'prod-123',
                updateDto
            );

            expect(result.name).toBe(updateDto.name);
        });

        it('should throw error if updating to duplicate SKU', async () => {
            const updateDto = { sku: 'SKU-EXISTS' };

            prisma.product.findFirst.mockResolvedValue(mockProduct);
            prisma.sKU.findFirst.mockResolvedValue({ ...mockSku, id: 'other-sku' });

            await expect(
                service.updateProduct(mockOrganizationId, 'prod-123', updateDto)
            ).rejects.toThrow(BadRequestException);
        });

        it('should allow partial update', async () => {
            const updateDto = { description: 'وصف جديد' };

            prisma.product.findFirst.mockResolvedValue(mockProduct);
            prisma.product.update.mockResolvedValue({
                ...mockProduct,
                description: updateDto.description,
            });

            const result = await service.updateProduct(
                mockOrganizationId,
                'prod-123',
                updateDto
            );

            expect(result.description).toBe(updateDto.description);
            expect(result.name).toBe(mockProduct.name); // unchanged
        });
    });

    // ========================================
    // DELETE PRODUCT TESTS
    // ========================================

    describe('deleteProduct', () => {
        it('should delete product with no reservations', async () => {
            prisma.product.findFirst.mockResolvedValue(mockProduct);
            prisma.inventoryReservation.count.mockResolvedValue(0);
            prisma.product.delete.mockResolvedValue(mockProduct);

            await service.deleteProduct(mockOrganizationId, 'prod-123');

            expect(prisma.product.delete).toHaveBeenCalledWith({
                where: { id: 'prod-123' },
            });
        });

        it('should throw error for product with active reservations', async () => {
            prisma.product.findFirst.mockResolvedValue(mockProduct);
            prisma.inventoryReservation.count.mockResolvedValue(5);

            await expect(
                service.deleteProduct(mockOrganizationId, 'prod-123')
            ).rejects.toThrow(BadRequestException);
        });

        it('should soft delete (deactivate) when has inventory', async () => {
            prisma.product.findFirst.mockResolvedValue(mockProduct);
            prisma.inventoryReservation.count.mockResolvedValue(0);
            prisma.inventoryLevel.count.mockResolvedValue(10);
            prisma.product.update.mockResolvedValue({
                ...mockProduct,
                isActive: false,
            });

            await service.deleteProduct(mockOrganizationId, 'prod-123');

            expect(prisma.product.update).toHaveBeenCalledWith({
                where: { id: 'prod-123' },
                data: {
                    metadata: {
                        isActive: false,
                    },
                },
            });
        });
    });

    // ========================================
    // GET PRODUCT HISTORY TESTS
    // ========================================

    describe('getProductHistory', () => {
        it('should return stock change history', async () => {
            const mockHistory = [
                {
                    id: 'adj-1',
                    type: 'IN',
                    quantity: 50,
                    reason: 'استلام شحنة',
                    createdAt: new Date(),
                },
            ];

            prisma.product.findFirst.mockResolvedValue(mockProduct);
            prisma.inventoryAdjustment.findMany.mockResolvedValue(mockHistory);

            const result = await service.getProductHistory(
                mockOrganizationId,
                'prod-123'
            );

            expect(result).toHaveLength(1);
            expect(result[0].type).toBe('IN');
        });
    });

    // ========================================
    // GET CATEGORIES TESTS
    // ========================================

    describe('getCategories', () => {
        it('should return unique categories', async () => {
            prisma.product.findMany.mockResolvedValue([
                { category: 'إلكترونيات' },
                { category: 'ملابس' },
                { category: 'إلكترونيات' }, // duplicate
            ]);

            const result = await service.getCategories(mockOrganizationId);

            expect(result).toEqual(['إلكترونيات', 'ملابس']);
        });
    });

    // ========================================
    // GET PRODUCT STOCK TESTS
    // ========================================

    describe('getProductStock', () => {
        it('should aggregate stock across warehouses', async () => {
            prisma.product.findFirst.mockResolvedValue(mockProduct);
            prisma.inventoryLevel.aggregate.mockResolvedValue({
                _sum: {
                    available: 200,
                    reserved: 30,
                    damaged: 10,
                },
            });

            const result = await service.getProductStock(mockOrganizationId, 'prod-123');

            expect(result.totalAvailable).toBe(200);
            expect(result.totalReserved).toBe(30);
        });
    });

    // ========================================
    // VALIDATION TESTS
    // ========================================

    describe('validateProduct', () => {
        it('should validate minStock < maxStock', async () => {
            const dto = {
                name: 'منتج',
                sku: 'SKU-001',
                minStock: 100,
                maxStock: 50, // invalid: min > max
            };

            await expect(
                service.createProduct(mockOrganizationId, dto)
            ).rejects.toThrow(BadRequestException);
        });
    });

    // ========================================
    // STOCK STATUS TESTS
    // ========================================

    describe('calculateStockStatus', () => {
        it('should return LOW for stock below minStock', () => {
            const status = service.calculateStockStatus(5, 10, 100);
            expect(status).toBe('LOW');
        });

        it('should return OUT for zero stock', () => {
            const status = service.calculateStockStatus(0, 10, 100);
            expect(status).toBe('OUT');
        });

        it('should return NORMAL for stock above minStock', () => {
            const status = service.calculateStockStatus(50, 10, 100);
            expect(status).toBe('NORMAL');
        });
    });
});
