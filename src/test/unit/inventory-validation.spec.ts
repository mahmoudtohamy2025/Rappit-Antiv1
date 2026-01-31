/**
 * Inventory Validation Service Unit Tests (INV-04)
 * 
 * Step A: Write Tests BEFORE Implementation
 * 
 * Tests cover:
 * - SKU format validation
 * - Quantity validation
 * - Warehouse validation
 * - Cross-org isolation
 * - Edge cases
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import {
    InventoryValidationService,
    InventoryValidationInput,
    ValidationResult,
} from '../../src/modules/inventory/inventory-validation.service';
import { PrismaService } from '../../src/common/database/prisma.service';

describe('InventoryValidationService', () => {
    let service: InventoryValidationService;
    let prisma: jest.Mocked<PrismaService>;

    // Test data
    const testOrgId = 'org-123';
    const testWarehouseId = 'warehouse-456';

    const mockWarehouse = {
        id: testWarehouseId,
        organizationId: testOrgId,
        name: 'Main Warehouse',
        status: 'ACTIVE',
    };

    const mockProduct = {
        id: 'product-789',
        organizationId: testOrgId,
        sku: 'VALID-SKU-001',
        name: 'Test Product',
        status: 'ACTIVE',
    };

    const createValidInput = (): InventoryValidationInput => ({
        organizationId: testOrgId,
        sku: 'VALID-SKU-001',
        quantity: 100,
        warehouseId: testWarehouseId,
    });

    beforeEach(async () => {
        jest.clearAllMocks();

        prisma = {
            warehouse: {
                findUnique: jest.fn(),
                findFirst: jest.fn(),
            },
            product: {
                findUnique: jest.fn(),
                findFirst: jest.fn(),
            },
            inventoryItem: {
                findFirst: jest.fn(),
            },
        } as any;

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                InventoryValidationService,
                { provide: PrismaService, useValue: prisma },
            ],
        }).compile();

        service = module.get<InventoryValidationService>(InventoryValidationService);
    });

    // =========================================================================
    // SKU FORMAT VALIDATION
    // =========================================================================
    describe('SKU format validation', () => {
        it('should accept valid SKU format', async () => {
            prisma.warehouse.findFirst.mockResolvedValueOnce(mockWarehouse as any);
            prisma.product.findFirst.mockResolvedValueOnce(mockProduct as any);

            const input = createValidInput();
            const result = await service.validate(input);

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should accept SKU with alphanumeric and hyphens', async () => {
            prisma.warehouse.findFirst.mockResolvedValueOnce(mockWarehouse as any);
            prisma.product.findFirst.mockResolvedValueOnce({
                ...mockProduct,
                sku: 'ABC-123-XYZ',
            } as any);

            const input = { ...createValidInput(), sku: 'ABC-123-XYZ' };
            const result = await service.validate(input);

            expect(result.valid).toBe(true);
        });

        it('should reject invalid SKU format with special characters', async () => {
            const input = { ...createValidInput(), sku: 'INVALID@SKU!' };

            const result = await service.validate(input);

            expect(result.valid).toBe(false);
            expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('SKU')]))
        });

        it('should reject SKU that is too short', async () => {
            const input = { ...createValidInput(), sku: 'AB' };

            const result = await service.validate(input);

            expect(result.valid).toBe(false);
            expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('SKU')]))
        });

        it('should reject SKU that is too long', async () => {
            const input = { ...createValidInput(), sku: 'A'.repeat(101) };

            const result = await service.validate(input);

            expect(result.valid).toBe(false);
            expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('SKU')]))
        });

        it('should reject empty SKU', async () => {
            const input = { ...createValidInput(), sku: '' };

            const result = await service.validate(input);

            expect(result.valid).toBe(false);
            expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('SKU')]))
        });

        it('should reject SKU with only whitespace', async () => {
            const input = { ...createValidInput(), sku: '   ' };

            const result = await service.validate(input);

            expect(result.valid).toBe(false);
        });
    });

    // =========================================================================
    // SKU UNIQUENESS PER ORGANIZATION
    // =========================================================================
    describe('SKU uniqueness per organization', () => {
        it('should reject duplicate SKU within same organization', async () => {
            // Need to pass base validation first
            prisma.warehouse.findFirst.mockResolvedValueOnce(mockWarehouse as any);
            prisma.product.findFirst.mockResolvedValueOnce({
                ...mockProduct,
                sku: 'DUPLICATE-SKU',
            } as any);
            // Then check for existing item
            prisma.inventoryItem.findFirst.mockResolvedValueOnce({
                id: 'existing-item',
                sku: 'DUPLICATE-SKU',
                organizationId: testOrgId,
            } as any);

            const input = { ...createValidInput(), sku: 'DUPLICATE-SKU' };
            const result = await service.validateForCreate(input);

            expect(result.valid).toBe(false);
            expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('duplicate')]));
        });

        it('should allow same SKU in different organizations', async () => {
            prisma.inventoryItem.findFirst.mockResolvedValueOnce(null); // Not found in this org
            prisma.warehouse.findFirst.mockResolvedValueOnce(mockWarehouse as any);
            prisma.product.findFirst.mockResolvedValueOnce(mockProduct as any);

            const input = {
                ...createValidInput(),
                organizationId: 'different-org-456',
                sku: 'SHARED-SKU',
            };
            const result = await service.validateForCreate(input);

            expect(result.valid).toBe(true);
        });

        it('should check uniqueness scoped to organization', async () => {
            prisma.warehouse.findFirst.mockResolvedValueOnce(mockWarehouse as any);
            prisma.product.findFirst.mockResolvedValueOnce(mockProduct as any);
            prisma.inventoryItem.findFirst.mockResolvedValueOnce(null);

            const input = createValidInput();
            await service.validateForCreate(input);

            expect(prisma.inventoryItem.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        organizationId: testOrgId,
                    }),
                })
            );
        });
    });

    // =========================================================================
    // QUANTITY VALIDATION
    // =========================================================================
    describe('quantity validation', () => {
        it('should reject negative quantity', async () => {
            const input = { ...createValidInput(), quantity: -10 };

            const result = await service.validate(input);

            expect(result.valid).toBe(false);
            expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('quantity')]))
        });

        it('should allow zero quantity', async () => {
            prisma.warehouse.findFirst.mockResolvedValueOnce(mockWarehouse as any);
            prisma.product.findFirst.mockResolvedValueOnce(mockProduct as any);

            const input = { ...createValidInput(), quantity: 0 };
            const result = await service.validate(input);

            expect(result.valid).toBe(true);
        });

        it('should accept positive quantity', async () => {
            prisma.warehouse.findFirst.mockResolvedValueOnce(mockWarehouse as any);
            prisma.product.findFirst.mockResolvedValueOnce(mockProduct as any);

            const input = { ...createValidInput(), quantity: 500 };
            const result = await service.validate(input);

            expect(result.valid).toBe(true);
        });

        it('should reject quantity exceeding maximum limit', async () => {
            const input = { ...createValidInput(), quantity: 10_000_001 }; // Max 10M

            const result = await service.validate(input);

            expect(result.valid).toBe(false);
            expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('maximum')]))
        });

        it('should reject non-integer quantity', async () => {
            const input = { ...createValidInput(), quantity: 10.5 };

            const result = await service.validate(input);

            expect(result.valid).toBe(false);
            expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('integer')]))
        });
    });

    // =========================================================================
    // WAREHOUSE VALIDATION
    // =========================================================================
    describe('warehouse validation', () => {
        it('should accept valid warehouse in same organization', async () => {
            prisma.warehouse.findFirst.mockResolvedValueOnce(mockWarehouse as any);
            prisma.product.findFirst.mockResolvedValueOnce(mockProduct as any);

            const input = createValidInput();
            const result = await service.validate(input);

            expect(result.valid).toBe(true);
        });

        it('should reject non-existent warehouse', async () => {
            prisma.warehouse.findFirst.mockResolvedValueOnce(null);

            const input = { ...createValidInput(), warehouseId: 'non-existent' };
            const result = await service.validate(input);

            expect(result.valid).toBe(false);
            expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('warehouse')]))
        });

        it('should reject warehouse from different organization', async () => {
            // Warehouse exists but belongs to different org
            prisma.warehouse.findFirst.mockResolvedValueOnce(null);

            const input = createValidInput();
            const result = await service.validate(input);

            expect(result.valid).toBe(false);
            expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('warehouse')]))
        });

        it('should scope warehouse lookup to organization', async () => {
            prisma.warehouse.findFirst.mockResolvedValueOnce(null);

            const input = createValidInput();
            await service.validate(input);

            expect(prisma.warehouse.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        id: testWarehouseId,
                        organizationId: testOrgId,
                    }),
                })
            );
        });

        it('should reject inactive warehouse', async () => {
            prisma.warehouse.findFirst.mockResolvedValueOnce({
                ...mockWarehouse,
                status: 'INACTIVE',
            } as any);

            const input = createValidInput();
            const result = await service.validate(input);

            expect(result.valid).toBe(false);
            expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('inactive')]))
        });
    });

    // =========================================================================
    // PRODUCT VALIDATION
    // =========================================================================
    describe('product validation', () => {
        it('should accept valid product in same organization', async () => {
            prisma.warehouse.findFirst.mockResolvedValueOnce(mockWarehouse as any);
            prisma.product.findFirst.mockResolvedValueOnce(mockProduct as any);

            const input = createValidInput();
            const result = await service.validate(input);

            expect(result.valid).toBe(true);
        });

        it('should reject non-existent product (SKU not found)', async () => {
            prisma.warehouse.findFirst.mockResolvedValueOnce(mockWarehouse as any);
            prisma.product.findFirst.mockResolvedValueOnce(null);

            const input = createValidInput();
            const result = await service.validate(input);

            expect(result.valid).toBe(false);
            expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('product')]))
        });

        it('should reject product from different organization', async () => {
            prisma.warehouse.findFirst.mockResolvedValueOnce(mockWarehouse as any);
            prisma.product.findFirst.mockResolvedValueOnce(null); // Not found in this org

            const input = createValidInput();
            const result = await service.validate(input);

            expect(result.valid).toBe(false);
        });

        it('should reject inactive product', async () => {
            prisma.warehouse.findFirst.mockResolvedValueOnce(mockWarehouse as any);
            prisma.product.findFirst.mockResolvedValueOnce({
                ...mockProduct,
                status: 'INACTIVE',
            } as any);

            const input = createValidInput();
            const result = await service.validate(input);

            expect(result.valid).toBe(false);
            expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('inactive')]))
        });
    });

    // =========================================================================
    // CROSS-ORG ISOLATION (SECURITY)
    // =========================================================================
    describe('cross-org isolation', () => {
        it('should not allow access to another orgs warehouse', async () => {
            prisma.warehouse.findFirst.mockResolvedValueOnce(null); // Not found in requested org

            const input = {
                ...createValidInput(),
                organizationId: 'attacker-org',
            };
            const result = await service.validate(input);

            expect(result.valid).toBe(false);
        });

        it('should scope all lookups to organization', async () => {
            prisma.warehouse.findFirst.mockResolvedValueOnce(mockWarehouse as any);
            prisma.product.findFirst.mockResolvedValueOnce(mockProduct as any);

            const input = createValidInput();
            await service.validate(input);

            // Verify warehouse lookup is scoped
            expect(prisma.warehouse.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        organizationId: testOrgId,
                    }),
                })
            );

            // Verify product lookup is scoped
            expect(prisma.product.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        organizationId: testOrgId,
                    }),
                })
            );
        });
    });

    // =========================================================================
    // BATCH VALIDATION
    // =========================================================================
    describe('batch validation', () => {
        it('should validate multiple items and collect all errors', async () => {
            const items = [
                { ...createValidInput(), sku: '' }, // Invalid
                { ...createValidInput(), quantity: -5 }, // Invalid
                { ...createValidInput() }, // Valid
            ];

            prisma.warehouse.findFirst.mockResolvedValue(mockWarehouse as any);
            prisma.product.findFirst.mockResolvedValue(mockProduct as any);

            const results = await service.validateBatch(items);

            expect(results.validCount).toBe(1);
            expect(results.invalidCount).toBe(2);
            expect(results.errors).toHaveLength(2);
        });

        it('should return detailed error for each invalid row', async () => {
            const items = [
                { ...createValidInput(), sku: '', rowIndex: 1 },
                { ...createValidInput(), quantity: -5, rowIndex: 2 },
            ];

            const results = await service.validateBatch(items);

            expect(results.errors[0]).toMatchObject({
                rowIndex: 1,
                field: 'sku',
            });
            expect(results.errors[1]).toMatchObject({
                rowIndex: 2,
                field: 'quantity',
            });
        });
    });

    // =========================================================================
    // EDGE CASES
    // =========================================================================
    describe('edge cases', () => {
        it('should handle missing organizationId', async () => {
            const input = { ...createValidInput(), organizationId: '' };

            const result = await service.validate(input);

            expect(result.valid).toBe(false);
            expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('organization')]))
        });

        it('should handle null input gracefully', async () => {
            await expect(service.validate(null as any)).rejects.toThrow();
        });

        it('should handle undefined input gracefully', async () => {
            await expect(service.validate(undefined as any)).rejects.toThrow();
        });

        it('should trim whitespace from SKU', async () => {
            prisma.warehouse.findFirst.mockResolvedValueOnce(mockWarehouse as any);
            prisma.product.findFirst.mockResolvedValueOnce(mockProduct as any);

            const input = { ...createValidInput(), sku: '  VALID-SKU-001  ' };
            const result = await service.validate(input);

            expect(result.valid).toBe(true);
        });
    });

    // =========================================================================
    // ERROR MESSAGES
    // =========================================================================
    describe('error messages', () => {
        it('should provide clear error message for invalid SKU', async () => {
            const input = { ...createValidInput(), sku: '@@@' };

            const result = await service.validate(input);

            expect(result.errors[0]).toContain('SKU');
            expect(result.errors[0].length).toBeGreaterThan(10); // Descriptive
        });

        it('should provide clear error message for invalid quantity', async () => {
            const input = { ...createValidInput(), quantity: -1 };

            const result = await service.validate(input);

            expect(result.errors[0]).toContain('quantity');
        });
    });
});
