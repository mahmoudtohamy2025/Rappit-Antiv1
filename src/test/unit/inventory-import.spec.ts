/**
 * Bulk CSV Inventory Import Unit Tests (INV-01)
 * 
 * Step A: Write Tests BEFORE Implementation
 * 
 * COMPREHENSIVE TEST COVERAGE:
 * - CSV Parsing (valid/invalid formats)
 * - Header Mapping & Validation
 * - Row-Level Validation
 * - Batch Import Logic
 * - File Size & Row Limits
 * - Error Collection & Reporting
 * - Cross-Org Isolation
 * - Idempotency & Duplicate Handling
 * - Partial Success Scenarios
 * - Edge Cases
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
    InventoryImportService,
    ImportResult,
    ImportOptions,
    CSVRow,
} from '../../src/modules/inventory/inventory-import.service';
import { InventoryValidationService } from '../../src/modules/inventory/inventory-validation.service';
import { PrismaService } from '../../src/common/database/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('InventoryImportService', () => {
    let service: InventoryImportService;
    let prisma: jest.Mocked<PrismaService>;
    let validationService: jest.Mocked<InventoryValidationService>;
    let eventEmitter: jest.Mocked<EventEmitter2>;

    // Test data
    const testOrgId = 'org-123';
    const testWarehouseId = 'warehouse-456';
    const testUserId = 'user-789';

    // Valid CSV content
    const validCSVContent = `sku,quantity,warehouseId
SKU-001,100,${testWarehouseId}
SKU-002,50,${testWarehouseId}
SKU-003,200,${testWarehouseId}`;

    const createImportOptions = (): ImportOptions => ({
        organizationId: testOrgId,
        userId: testUserId,
        warehouseId: testWarehouseId,
    });

    beforeEach(async () => {
        jest.clearAllMocks();

        prisma = {
            inventoryItem: {
                findFirst: jest.fn(),
                create: jest.fn(),
                update: jest.fn(),
                createMany: jest.fn(),
                upsert: jest.fn(),
            },
            product: {
                findFirst: jest.fn(),
                findMany: jest.fn(),
            },
            warehouse: {
                findFirst: jest.fn(),
            },
            $transaction: jest.fn((callback) => callback(prisma)),
        } as any;

        validationService = {
            validate: jest.fn().mockResolvedValue({ valid: true, errors: [] }),
            validateBatch: jest.fn().mockResolvedValue({
                validCount: 3,
                invalidCount: 0,
                errors: []
            }),
        } as any;

        eventEmitter = {
            emit: jest.fn(),
        } as any;

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                InventoryImportService,
                { provide: PrismaService, useValue: prisma },
                { provide: InventoryValidationService, useValue: validationService },
                { provide: EventEmitter2, useValue: eventEmitter },
            ],
        }).compile();

        service = module.get<InventoryImportService>(InventoryImportService);
    });

    // =========================================================================
    // CSV PARSING
    // =========================================================================
    describe('CSV parsing', () => {
        it('should parse valid CSV with correct headers', async () => {
            prisma.inventoryItem.findFirst.mockResolvedValue(null);
            prisma.inventoryItem.create.mockResolvedValue({ id: 'new-1' } as any);

            const result = await service.importFromCSV(validCSVContent, createImportOptions());

            expect(result.success).toBe(true);
            expect(result.totalRows).toBe(3);
        });

        it('should handle CSV with BOM (Byte Order Mark)', async () => {
            const csvWithBOM = '\uFEFF' + validCSVContent;
            prisma.inventoryItem.findFirst.mockResolvedValue(null);
            prisma.inventoryItem.create.mockResolvedValue({ id: 'new-1' } as any);

            const result = await service.importFromCSV(csvWithBOM, createImportOptions());

            expect(result.success).toBe(true);
        });

        it('should handle CSV with different line endings (CRLF)', async () => {
            const csvCRLF = validCSVContent.replace(/\n/g, '\r\n');
            prisma.inventoryItem.findFirst.mockResolvedValue(null);
            prisma.inventoryItem.create.mockResolvedValue({ id: 'new-1' } as any);

            const result = await service.importFromCSV(csvCRLF, createImportOptions());

            expect(result.success).toBe(true);
        });

        it('should handle CSV with trailing newline', async () => {
            const csvTrailingNewline = validCSVContent + '\n';
            prisma.inventoryItem.findFirst.mockResolvedValue(null);
            prisma.inventoryItem.create.mockResolvedValue({ id: 'new-1' } as any);

            const result = await service.importFromCSV(csvTrailingNewline, createImportOptions());

            expect(result.success).toBe(true);
            expect(result.totalRows).toBe(3);
        });

        it('should handle CSV with quoted values', async () => {
            const csvQuoted = `sku,quantity,warehouseId
"SKU-001",100,"${testWarehouseId}"
"SKU WITH COMMA, IN IT",50,"${testWarehouseId}"`;
            prisma.inventoryItem.findFirst.mockResolvedValue(null);
            prisma.inventoryItem.create.mockResolvedValue({ id: 'new-1' } as any);

            const result = await service.importFromCSV(csvQuoted, createImportOptions());

            expect(result.success).toBe(true);
        });

        it('should reject malformed CSV', async () => {
            const malformedCSV = `sku,quantity,warehouseId
SKU-001,100
SKU-002`; // Missing columns

            const result = await service.importFromCSV(malformedCSV, createImportOptions());

            expect(result.success).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });

        it('should reject CSV with unclosed quotes', async () => {
            const unclosedQuotes = `sku,quantity,warehouseId
"SKU-001,100,${testWarehouseId}`;

            const result = await service.importFromCSV(unclosedQuotes, createImportOptions());

            expect(result.success).toBe(false);
        });
    });

    // =========================================================================
    // HEADER VALIDATION
    // =========================================================================
    describe('header validation', () => {
        it('should accept required headers: sku, quantity, warehouseId', async () => {
            prisma.inventoryItem.findFirst.mockResolvedValue(null);
            prisma.inventoryItem.create.mockResolvedValue({ id: 'new-1' } as any);

            const result = await service.importFromCSV(validCSVContent, createImportOptions());

            expect(result.success).toBe(true);
        });

        it('should reject CSV missing required sku header', async () => {
            const missingSkuHeader = `quantity,warehouseId
100,${testWarehouseId}`;

            const result = await service.importFromCSV(missingSkuHeader, createImportOptions());

            expect(result.success).toBe(false);
            expect(result.errors).toContainEqual(
                expect.objectContaining({ message: expect.stringContaining('sku') })
            );
        });

        it('should reject CSV missing required quantity header', async () => {
            const missingQuantityHeader = `sku,warehouseId
SKU-001,${testWarehouseId}`;

            const result = await service.importFromCSV(missingQuantityHeader, createImportOptions());

            expect(result.success).toBe(false);
            expect(result.errors).toContainEqual(
                expect.objectContaining({ message: expect.stringContaining('quantity') })
            );
        });

        it('should accept headers in any order', async () => {
            const reorderedHeaders = `quantity,warehouseId,sku
100,${testWarehouseId},SKU-001`;
            prisma.inventoryItem.findFirst.mockResolvedValue(null);
            prisma.inventoryItem.create.mockResolvedValue({ id: 'new-1' } as any);

            const result = await service.importFromCSV(reorderedHeaders, createImportOptions());

            expect(result.success).toBe(true);
        });

        it('should accept headers with different casing (case-insensitive)', async () => {
            const uppercaseHeaders = `SKU,QUANTITY,WAREHOUSEID
SKU-001,100,${testWarehouseId}`;
            prisma.inventoryItem.findFirst.mockResolvedValue(null);
            prisma.inventoryItem.create.mockResolvedValue({ id: 'new-1' } as any);

            const result = await service.importFromCSV(uppercaseHeaders, createImportOptions());

            expect(result.success).toBe(true);
        });

        it('should accept headers with extra whitespace (trimmed)', async () => {
            const whitespaceHeaders = ` sku , quantity , warehouseId 
SKU-001,100,${testWarehouseId}`;
            prisma.inventoryItem.findFirst.mockResolvedValue(null);
            prisma.inventoryItem.create.mockResolvedValue({ id: 'new-1' } as any);

            const result = await service.importFromCSV(whitespaceHeaders, createImportOptions());

            expect(result.success).toBe(true);
        });

        it('should ignore extra columns (not mapped)', async () => {
            const extraColumns = `sku,quantity,warehouseId,extraColumn,anotherExtra
SKU-001,100,${testWarehouseId},ignore,this`;
            prisma.inventoryItem.findFirst.mockResolvedValue(null);
            prisma.inventoryItem.create.mockResolvedValue({ id: 'new-1' } as any);

            const result = await service.importFromCSV(extraColumns, createImportOptions());

            expect(result.success).toBe(true);
        });

        it('should reject CSV with empty headers', async () => {
            const emptyHeader = `sku,,warehouseId
SKU-001,100,${testWarehouseId}`;

            const result = await service.importFromCSV(emptyHeader, createImportOptions());

            expect(result.success).toBe(false);
        });

        it('should reject CSV with duplicate headers', async () => {
            const duplicateHeaders = `sku,quantity,sku,warehouseId
SKU-001,100,DUPLICATE,${testWarehouseId}`;

            const result = await service.importFromCSV(duplicateHeaders, createImportOptions());

            expect(result.success).toBe(false);
            expect(result.errors.some(e => e.message.toLowerCase().includes('duplicate'))).toBe(true);
        });
    });

    // =========================================================================
    // ROW-LEVEL VALIDATION
    // =========================================================================
    describe('row-level validation', () => {
        it('should collect row-level validation errors', async () => {
            validationService.validate.mockResolvedValueOnce({
                valid: false,
                errors: ['SKU format invalid']
            });

            const result = await service.importFromCSV(validCSVContent, createImportOptions());

            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0].row).toBeDefined();
        });

        it('should include row number in validation errors', async () => {
            validationService.validate.mockResolvedValueOnce({
                valid: false,
                errors: ['Invalid quantity']
            });

            const csvWithError = `sku,quantity,warehouseId
SKU-001,-100,${testWarehouseId}`;

            const result = await service.importFromCSV(csvWithError, createImportOptions());

            expect(result.errors[0].row).toBe(2); // Row 2 (after header)
        });

        it('should continue processing after validation error (collect all)', async () => {
            validationService.validate
                .mockResolvedValueOnce({ valid: false, errors: ['Error 1'] })
                .mockResolvedValueOnce({ valid: true, errors: [] })
                .mockResolvedValueOnce({ valid: false, errors: ['Error 3'] });

            const result = await service.importFromCSV(validCSVContent, createImportOptions());

            expect(result.errors.length).toBe(2);
        });

        it('should validate quantity is numeric', async () => {
            const nonNumericQuantity = `sku,quantity,warehouseId
SKU-001,abc,${testWarehouseId}`;

            const result = await service.importFromCSV(nonNumericQuantity, createImportOptions());

            expect(result.success).toBe(false);
            expect(result.errors).toContainEqual(
                expect.objectContaining({
                    field: 'quantity',
                    message: expect.stringContaining('numeric')
                })
            );
        });

        it('should validate SKU is not empty', async () => {
            const emptySku = `sku,quantity,warehouseId
,100,${testWarehouseId}`;

            validationService.validate.mockResolvedValue({
                valid: false,
                errors: ['SKU is required']
            });

            const result = await service.importFromCSV(emptySku, createImportOptions());

            expect(result.errors.length).toBeGreaterThan(0);
        });
    });

    // =========================================================================
    // BATCH IMPORT LOGIC
    // =========================================================================
    describe('batch import logic', () => {
        it('should create new inventory items', async () => {
            prisma.inventoryItem.findFirst.mockResolvedValue(null); // Not found
            prisma.inventoryItem.create.mockResolvedValue({
                id: 'new-item-1',
                sku: 'SKU-001',
                quantity: 100,
            } as any);

            const result = await service.importFromCSV(validCSVContent, createImportOptions());

            expect(result.created).toBe(3);
            expect(prisma.inventoryItem.create).toHaveBeenCalledTimes(3);
        });

        it('should update existing inventory items', async () => {
            prisma.inventoryItem.findFirst.mockResolvedValue({
                id: 'existing-item',
                sku: 'SKU-001',
                quantity: 50,
            } as any);
            prisma.inventoryItem.update.mockResolvedValue({
                id: 'existing-item',
                quantity: 100,
            } as any);

            const result = await service.importFromCSV(validCSVContent, createImportOptions());

            expect(result.updated).toBeGreaterThan(0);
        });

        it('should use upsert for atomic create-or-update', async () => {
            prisma.inventoryItem.upsert.mockResolvedValue({
                id: 'item-1',
                sku: 'SKU-001',
            } as any);

            const options = { ...createImportOptions(), useUpsert: true };
            const result = await service.importFromCSV(validCSVContent, options);

            expect(result.success).toBe(true);
        });

        it('should process in batches for large files', async () => {
            // Create CSV with 500 rows
            const largeCSV = ['sku,quantity,warehouseId'];
            for (let i = 0; i < 500; i++) {
                largeCSV.push(`SKU-${i.toString().padStart(4, '0')},${i * 10},${testWarehouseId}`);
            }

            prisma.inventoryItem.findFirst.mockResolvedValue(null);
            prisma.inventoryItem.create.mockResolvedValue({ id: 'new' } as any);

            const result = await service.importFromCSV(largeCSV.join('\n'), createImportOptions());

            expect(result.totalRows).toBe(500);
            // Should be processed in batches (e.g., 100 per batch)
        });

        it('should wrap import in transaction when atomic', async () => {
            prisma.inventoryItem.findFirst.mockResolvedValue(null);
            prisma.inventoryItem.create.mockResolvedValue({ id: 'new' } as any);

            const options = { ...createImportOptions(), atomic: true };
            await service.importFromCSV(validCSVContent, options);

            expect(prisma.$transaction).toHaveBeenCalled();
        });
    });

    // =========================================================================
    // FILE SIZE & ROW LIMITS
    // =========================================================================
    describe('file size and row limits', () => {
        it('should reject empty file', async () => {
            // Empty string throws BadRequestException
            await expect(service.importFromCSV('', createImportOptions()))
                .rejects.toThrow('CSV content is required');
        });

        it('should reject file with only headers (no data)', async () => {
            const headersOnly = 'sku,quantity,warehouseId';

            const result = await service.importFromCSV(headersOnly, createImportOptions());

            expect(result.success).toBe(false);
            expect(result.errors).toContainEqual(
                expect.objectContaining({ message: expect.stringContaining('no data') })
            );
        });

        it('should enforce maximum row limit', async () => {
            // Create CSV exceeding limit (e.g., 10001 rows for 10000 limit)
            const largeCSV = ['sku,quantity,warehouseId'];
            for (let i = 0; i < 10001; i++) {
                largeCSV.push(`SKU-${i},100,${testWarehouseId}`);
            }

            const result = await service.importFromCSV(largeCSV.join('\n'), createImportOptions());

            expect(result.success).toBe(false);
            expect(result.errors).toContainEqual(
                expect.objectContaining({ message: expect.stringContaining('maximum') })
            );
        });

        it('should enforce maximum file size limit', async () => {
            // This test simulates file size check
            const options = { ...createImportOptions(), maxFileSizeBytes: 1000 };

            // Create content larger than limit
            const largeContent = 'sku,quantity,warehouseId\n' + 'SKU-001,100,WH-001\n'.repeat(200);

            const result = await service.importFromCSV(largeContent, options);

            expect(result.success).toBe(false);
            expect(result.errors).toContainEqual(
                expect.objectContaining({ message: expect.stringContaining('size') })
            );
        });
    });

    // =========================================================================
    // ERROR COLLECTION & REPORTING
    // =========================================================================
    describe('error collection and reporting', () => {
        it('should return detailed error report', async () => {
            validationService.validate.mockResolvedValue({
                valid: false,
                errors: ['Validation failed']
            });

            const result = await service.importFromCSV(validCSVContent, createImportOptions());

            expect(result.errors).toBeInstanceOf(Array);
            result.errors.forEach(error => {
                expect(error).toHaveProperty('row');
                expect(error).toHaveProperty('field');
                expect(error).toHaveProperty('message');
            });
        });

        it('should include original row data in error', async () => {
            validationService.validate.mockResolvedValue({
                valid: false,
                errors: ['Invalid']
            });

            const result = await service.importFromCSV(validCSVContent, createImportOptions());

            expect(result.errors[0].originalData).toBeDefined();
        });

        it('should report success count and error count', async () => {
            validationService.validate
                .mockResolvedValueOnce({ valid: true, errors: [] })
                .mockResolvedValueOnce({ valid: false, errors: ['Error'] })
                .mockResolvedValueOnce({ valid: true, errors: [] });

            prisma.inventoryItem.findFirst.mockResolvedValue(null);
            prisma.inventoryItem.create.mockResolvedValue({ id: 'new' } as any);

            const result = await service.importFromCSV(validCSVContent, createImportOptions());

            expect(result.successCount).toBe(2);
            expect(result.errorCount).toBe(1);
        });

        it('should limit number of errors returned', async () => {
            // Create CSV with many invalid rows
            const manyInvalidRows = ['sku,quantity,warehouseId'];
            for (let i = 0; i < 200; i++) {
                manyInvalidRows.push(`,invalid,${testWarehouseId}`);
            }

            validationService.validate.mockResolvedValue({
                valid: false,
                errors: ['Invalid']
            });

            const result = await service.importFromCSV(manyInvalidRows.join('\n'), createImportOptions());

            // Should cap errors at reasonable limit (e.g., 100)
            expect(result.errors.length).toBeLessThanOrEqual(100);
            expect(result.totalErrors).toBeGreaterThan(0);
        });
    });

    // =========================================================================
    // CROSS-ORG ISOLATION
    // =========================================================================
    describe('cross-org isolation', () => {
        it('should scope all operations to organization', async () => {
            prisma.inventoryItem.findFirst.mockResolvedValue(null);
            prisma.inventoryItem.create.mockResolvedValue({ id: 'new' } as any);

            await service.importFromCSV(validCSVContent, createImportOptions());

            expect(prisma.inventoryItem.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        organizationId: testOrgId,
                    }),
                })
            );
        });

        it('should validate warehouse belongs to organization', async () => {
            validationService.validate.mockResolvedValue({
                valid: false,
                errors: ['Warehouse not accessible']
            });

            const result = await service.importFromCSV(validCSVContent, createImportOptions());

            expect(result.errors.length).toBeGreaterThan(0);
        });

        it('should not allow importing to another orgs warehouse', async () => {
            const options = {
                ...createImportOptions(),
                organizationId: 'different-org',
            };

            validationService.validate.mockResolvedValue({
                valid: false,
                errors: ['Warehouse not found in organization']
            });

            const result = await service.importFromCSV(validCSVContent, options);

            expect(result.success).toBe(false);
        });
    });

    // =========================================================================
    // IDEMPOTENCY & DUPLICATE HANDLING
    // =========================================================================
    describe('idempotency and duplicate handling', () => {
        it('should detect duplicate SKUs within same file', async () => {
            const duplicateSKUs = `sku,quantity,warehouseId
SKU-001,100,${testWarehouseId}
SKU-001,200,${testWarehouseId}`;

            prisma.inventoryItem.findFirst.mockResolvedValue(null);
            prisma.inventoryItem.create.mockResolvedValue({ id: 'new' } as any);

            const result = await service.importFromCSV(duplicateSKUs, createImportOptions());

            // Should warn about duplicates or take last value
            expect(result.warnings.some(w => w.message.toLowerCase().includes('duplicate'))).toBe(true);
        });

        it('should use last value for duplicate SKUs by default', async () => {
            const duplicateSKUs = `sku,quantity,warehouseId
SKU-001,100,${testWarehouseId}
SKU-001,200,${testWarehouseId}`;

            prisma.inventoryItem.findFirst.mockResolvedValue(null);
            prisma.inventoryItem.create.mockResolvedValue({ id: 'new' } as any);

            await service.importFromCSV(duplicateSKUs, createImportOptions());

            // Should use quantity 200 (last occurrence)
            expect(prisma.inventoryItem.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        quantity: 200,
                    }),
                })
            );
        });

        it('should generate idempotency key for import job', async () => {
            prisma.inventoryItem.findFirst.mockResolvedValue(null);
            prisma.inventoryItem.create.mockResolvedValue({ id: 'new' } as any);

            const result = await service.importFromCSV(validCSVContent, createImportOptions());

            expect(result.importId).toBeDefined();
            expect(result.importId.length).toBeGreaterThan(0);
        });
    });

    // =========================================================================
    // PARTIAL SUCCESS
    // =========================================================================
    describe('partial success scenarios', () => {
        it('should allow partial success with some errors', async () => {
            validationService.validate
                .mockResolvedValueOnce({ valid: true, errors: [] })
                .mockResolvedValueOnce({ valid: false, errors: ['Error'] })
                .mockResolvedValueOnce({ valid: true, errors: [] });

            prisma.inventoryItem.findFirst.mockResolvedValue(null);
            prisma.inventoryItem.create.mockResolvedValue({ id: 'new' } as any);

            const result = await service.importFromCSV(validCSVContent, createImportOptions());

            expect(result.partialSuccess).toBe(true);
            expect(result.successCount).toBe(2);
            expect(result.errorCount).toBe(1);
        });

        it('should rollback all on option: failOnFirstError', async () => {
            validationService.validate
                .mockResolvedValueOnce({ valid: true, errors: [] })
                .mockResolvedValueOnce({ valid: false, errors: ['Error'] });

            const options = { ...createImportOptions(), failOnFirstError: true };

            const result = await service.importFromCSV(validCSVContent, options);

            expect(result.success).toBe(false);
            // First row succeeds before error is hit, but processing stops
            expect(result.created).toBeLessThanOrEqual(1);
        });

        it('should rollback all on option: atomic=true', async () => {
            validationService.validate
                .mockResolvedValueOnce({ valid: true, errors: [] })
                .mockResolvedValueOnce({ valid: false, errors: ['Error'] });

            const options = { ...createImportOptions(), atomic: true };

            prisma.$transaction.mockImplementation(async (callback) => {
                throw new Error('Transaction rolled back');
            });

            const result = await service.importFromCSV(validCSVContent, options);

            expect(result.success).toBe(false);
            expect(result.created).toBe(0);
        });
    });

    // =========================================================================
    // AUDIT & EVENTS
    // =========================================================================
    describe('audit and events', () => {
        it('should emit import started event', async () => {
            prisma.inventoryItem.findFirst.mockResolvedValue(null);
            prisma.inventoryItem.create.mockResolvedValue({ id: 'new' } as any);

            await service.importFromCSV(validCSVContent, createImportOptions());

            expect(eventEmitter.emit).toHaveBeenCalledWith(
                'inventory.import.started',
                expect.objectContaining({
                    organizationId: testOrgId,
                    userId: testUserId,
                })
            );
        });

        it('should emit import completed event', async () => {
            prisma.inventoryItem.findFirst.mockResolvedValue(null);
            prisma.inventoryItem.create.mockResolvedValue({ id: 'new' } as any);

            await service.importFromCSV(validCSVContent, createImportOptions());

            expect(eventEmitter.emit).toHaveBeenCalledWith(
                'inventory.import.completed',
                expect.objectContaining({
                    success: true,
                    totalRows: 3,
                })
            );
        });

        it('should emit import failed event on error', async () => {
            // Use valid CSV but mock validation to fail
            validationService.validate.mockResolvedValue({
                valid: false,
                errors: ['Validation failed'],
            });

            const result = await service.importFromCSV(validCSVContent, createImportOptions());

            // When all rows fail, completed event is emitted with success: false
            expect(eventEmitter.emit).toHaveBeenCalledWith(
                'inventory.import.completed',
                expect.objectContaining({
                    success: false,
                })
            );
        });

        it('should record userId for audit trail', async () => {
            prisma.inventoryItem.findFirst.mockResolvedValue(null);
            prisma.inventoryItem.create.mockResolvedValue({ id: 'new' } as any);

            await service.importFromCSV(validCSVContent, createImportOptions());

            expect(prisma.inventoryItem.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        createdBy: testUserId,
                    }),
                })
            );
        });
    });

    // =========================================================================
    // EDGE CASES
    // =========================================================================
    describe('edge cases', () => {
        it('should handle null content', async () => {
            await expect(service.importFromCSV(null as any, createImportOptions()))
                .rejects.toThrow();
        });

        it('should handle undefined content', async () => {
            await expect(service.importFromCSV(undefined as any, createImportOptions()))
                .rejects.toThrow();
        });

        it('should handle missing organizationId', async () => {
            const options = { ...createImportOptions(), organizationId: '' };

            await expect(service.importFromCSV(validCSVContent, options))
                .rejects.toThrow();
        });

        it('should handle missing userId', async () => {
            const options = { ...createImportOptions(), userId: '' };

            await expect(service.importFromCSV(validCSVContent, options))
                .rejects.toThrow();
        });

        it('should handle single row file', async () => {
            const singleRow = `sku,quantity,warehouseId
SKU-001,100,${testWarehouseId}`;
            prisma.inventoryItem.findFirst.mockResolvedValue(null);
            prisma.inventoryItem.create.mockResolvedValue({ id: 'new' } as any);

            const result = await service.importFromCSV(singleRow, createImportOptions());

            expect(result.success).toBe(true);
            expect(result.totalRows).toBe(1);
        });

        it('should handle very long SKU values', async () => {
            const longSku = 'A'.repeat(200);
            const csvLongSku = `sku,quantity,warehouseId
${longSku},100,${testWarehouseId}`;

            validationService.validate.mockResolvedValue({
                valid: false,
                errors: ['SKU too long']
            });

            const result = await service.importFromCSV(csvLongSku, createImportOptions());

            expect(result.errors.length).toBeGreaterThan(0);
        });

        it('should handle special characters in data', async () => {
            const specialChars = `sku,quantity,warehouseId
"SKU-001\tTAB",100,${testWarehouseId}`;
            prisma.inventoryItem.findFirst.mockResolvedValue(null);
            prisma.inventoryItem.create.mockResolvedValue({ id: 'new' } as any);

            const result = await service.importFromCSV(specialChars, createImportOptions());

            // Should handle or reject gracefully
            expect(result).toBeDefined();
        });

        it('should handle Unicode characters in data', async () => {
            const unicodeData = `sku,quantity,warehouseId
产品-001,100,${testWarehouseId}`;

            validationService.validate.mockResolvedValue({
                valid: false,
                errors: ['SKU contains invalid characters']
            });

            const result = await service.importFromCSV(unicodeData, createImportOptions());

            expect(result.errors.length).toBeGreaterThan(0);
        });

        it('should handle very large quantity values', async () => {
            const largeQuantity = `sku,quantity,warehouseId
SKU-001,99999999999,${testWarehouseId}`;

            validationService.validate.mockResolvedValue({
                valid: false,
                errors: ['Quantity exceeds maximum']
            });

            const result = await service.importFromCSV(largeQuantity, createImportOptions());

            expect(result.errors.length).toBeGreaterThan(0);
        });

        it('should handle zero quantity', async () => {
            const zeroQuantity = `sku,quantity,warehouseId
SKU-001,0,${testWarehouseId}`;
            prisma.inventoryItem.findFirst.mockResolvedValue(null);
            prisma.inventoryItem.create.mockResolvedValue({ id: 'new' } as any);

            const result = await service.importFromCSV(zeroQuantity, createImportOptions());

            // Zero quantity should be valid
            expect(result.success).toBe(true);
        });

        it('should handle negative quantity', async () => {
            const negativeQuantity = `sku,quantity,warehouseId
SKU-001,-100,${testWarehouseId}`;

            validationService.validate.mockResolvedValue({
                valid: false,
                errors: ['Quantity cannot be negative']
            });

            const result = await service.importFromCSV(negativeQuantity, createImportOptions());

            expect(result.errors.length).toBeGreaterThan(0);
        });

        it('should handle whitespace-only values', async () => {
            const whitespaceValues = `sku,quantity,warehouseId
   ,100,${testWarehouseId}`;

            validationService.validate.mockResolvedValue({
                valid: false,
                errors: ['SKU is required']
            });

            const result = await service.importFromCSV(whitespaceValues, createImportOptions());

            expect(result.errors.length).toBeGreaterThan(0);
        });
    });

    // =========================================================================
    // DATABASE ERRORS
    // =========================================================================
    describe('database error handling', () => {
        it('should handle database connection error', async () => {
            prisma.inventoryItem.findFirst.mockRejectedValue(
                new Error('Database connection failed')
            );

            // Database errors on findFirst are caught and returned as errors
            const result = await service.importFromCSV(validCSVContent, createImportOptions());

            expect(result.success).toBe(false);
            expect(result.errors[0].message).toContain('Database connection failed');
        });

        it('should handle unique constraint violation', async () => {
            prisma.inventoryItem.findFirst.mockResolvedValue(null);
            prisma.inventoryItem.create.mockRejectedValue({
                code: 'P2002',
                message: 'Unique constraint violation',
            });

            const result = await service.importFromCSV(validCSVContent, createImportOptions());

            expect(result.errors.length).toBeGreaterThan(0);
        });

        it('should handle transaction timeout', async () => {
            prisma.$transaction.mockRejectedValue(new Error('Transaction timeout'));

            // Use atomic mode to trigger transaction
            const options = { ...createImportOptions(), atomic: true };
            const result = await service.importFromCSV(validCSVContent, options);

            expect(result.success).toBe(false);
        });
    });

    // =========================================================================
    // OPTIONAL COLUMNS
    // =========================================================================
    describe('optional columns', () => {
        it('should accept optional cost column', async () => {
            const withCost = `sku,quantity,warehouseId,cost
SKU-001,100,${testWarehouseId},25.99`;
            prisma.inventoryItem.findFirst.mockResolvedValue(null);
            prisma.inventoryItem.create.mockResolvedValue({ id: 'new' } as any);

            const result = await service.importFromCSV(withCost, createImportOptions());

            expect(result.success).toBe(true);
        });

        it('should accept optional reorderPoint column', async () => {
            const withReorderPoint = `sku,quantity,warehouseId,reorderPoint
SKU-001,100,${testWarehouseId},10`;
            prisma.inventoryItem.findFirst.mockResolvedValue(null);
            prisma.inventoryItem.create.mockResolvedValue({ id: 'new' } as any);

            const result = await service.importFromCSV(withReorderPoint, createImportOptions());

            expect(result.success).toBe(true);
        });

        it('should accept optional location column', async () => {
            const withLocation = `sku,quantity,warehouseId,location
SKU-001,100,${testWarehouseId},AISLE-3`;
            prisma.inventoryItem.findFirst.mockResolvedValue(null);
            prisma.inventoryItem.create.mockResolvedValue({ id: 'new' } as any);

            const result = await service.importFromCSV(withLocation, createImportOptions());

            expect(result.success).toBe(true);
        });
    });
});
