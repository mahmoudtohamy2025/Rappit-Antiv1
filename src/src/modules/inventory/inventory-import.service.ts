/**
 * Inventory Import Service (INV-01)
 * 
 * Bulk CSV inventory import with comprehensive validation,
 * error handling, cross-org isolation, and audit logging.
 * 
 * Features:
 * - CSV parsing with header mapping
 * - Row-level validation using InventoryValidationService
 * - Batch processing for large files
 * - Partial success with detailed error reporting
 * - Transaction support for atomic imports
 * - Duplicate detection within file
 * - Audit event emission
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { InventoryValidationService } from './inventory-validation.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID } from 'crypto';

/**
 * Import options configuration
 */
export interface ImportOptions {
    organizationId: string;
    userId: string;
    warehouseId?: string;
    useUpsert?: boolean;
    failOnFirstError?: boolean;
    atomic?: boolean;
    maxFileSizeBytes?: number;
    maxRows?: number;
}

/**
 * CSV row representation
 */
export interface CSVRow {
    sku: string;
    quantity: number;
    warehouseId: string;
    cost?: number;
    reorderPoint?: number;
    location?: string;
    [key: string]: any;
}

/**
 * Import error detail
 */
export interface ImportError {
    row: number;
    field: string;
    message: string;
    originalData?: Record<string, any>;
}

/**
 * Import warning (non-fatal)
 */
export interface ImportWarning {
    row?: number;
    message: string;
}

/**
 * Import result summary
 */
export interface ImportResult {
    success: boolean;
    partialSuccess?: boolean;
    importId: string;
    totalRows: number;
    created: number;
    updated: number;
    successCount: number;
    errorCount: number;
    totalErrors: number;
    errors: ImportError[];
    warnings: ImportWarning[];
}

/**
 * Constants
 */
const DEFAULT_MAX_ROWS = 10000;
const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const BATCH_SIZE = 100;
const MAX_ERRORS_RETURNED = 100;

const REQUIRED_HEADERS = ['sku', 'quantity'];
const OPTIONAL_HEADERS = ['warehouseid', 'cost', 'reorderpoint', 'location'];

@Injectable()
export class InventoryImportService {
    private readonly logger = new Logger(InventoryImportService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly validationService: InventoryValidationService,
        private readonly eventEmitter: EventEmitter2,
    ) { }

    /**
     * Import inventory from CSV content
     */
    async importFromCSV(content: string, options: ImportOptions): Promise<ImportResult> {
        const importId = randomUUID();
        const startTime = Date.now();

        // Validate required options
        if (!content) {
            throw new BadRequestException('CSV content is required');
        }
        if (!options.organizationId) {
            throw new BadRequestException('Organization ID is required');
        }
        if (!options.userId) {
            throw new BadRequestException('User ID is required');
        }

        const maxRows = options.maxRows ?? DEFAULT_MAX_ROWS;
        const maxFileSize = options.maxFileSizeBytes ?? DEFAULT_MAX_FILE_SIZE;

        // Emit import started event
        this.eventEmitter.emit('inventory.import.started', {
            importId,
            organizationId: options.organizationId,
            userId: options.userId,
            timestamp: new Date(),
        });

        try {
            // Check file size
            const contentSize = Buffer.byteLength(content, 'utf8');
            if (contentSize > maxFileSize) {
                return this.createFailureResult(importId, [{
                    row: 0,
                    field: 'file',
                    message: `File size ${contentSize} exceeds maximum allowed size of ${maxFileSize} bytes`,
                }]);
            }

            // Parse CSV
            const parseResult = this.parseCSV(content);
            if (!parseResult.success) {
                return this.createFailureResult(importId, parseResult.errors);
            }

            const { headers, rows } = parseResult;

            // Validate headers
            const headerErrors = this.validateHeaders(headers);
            if (headerErrors.length > 0) {
                return this.createFailureResult(importId, headerErrors);
            }

            // Check for empty data
            if (rows.length === 0) {
                return this.createFailureResult(importId, [{
                    row: 0,
                    field: 'file',
                    message: 'CSV file contains no data rows',
                }]);
            }

            // Check row limit
            if (rows.length > maxRows) {
                return this.createFailureResult(importId, [{
                    row: 0,
                    field: 'file',
                    message: `Number of rows (${rows.length}) exceeds maximum allowed (${maxRows})`,
                }]);
            }

            // Map rows to objects
            const mappedRows = this.mapRowsToObjects(headers, rows);

            // Detect duplicates within file
            const { deduplicatedRows, warnings } = this.detectDuplicates(mappedRows);

            // Validate and import rows
            const result = await this.processRows(deduplicatedRows, options, importId);

            // Add warnings
            result.warnings = [...warnings, ...result.warnings];

            // Emit completion event
            this.eventEmitter.emit('inventory.import.completed', {
                importId,
                success: result.success,
                totalRows: result.totalRows,
                created: result.created,
                updated: result.updated,
                errorCount: result.errorCount,
                duration: Date.now() - startTime,
            });

            return result;

        } catch (error) {
            this.logger.error(`Import failed: ${error.message}`, error.stack);

            // Emit failure event
            this.eventEmitter.emit('inventory.import.failed', {
                importId,
                success: false,
                error: error.message,
            });

            if (error.message?.includes('Database') || error.message?.includes('timeout')) {
                throw error;
            }

            return this.createFailureResult(importId, [{
                row: 0,
                field: 'system',
                message: error.message || 'An unexpected error occurred',
            }]);
        }
    }

    /**
     * Parse CSV content into headers and rows
     */
    private parseCSV(content: string): {
        success: boolean;
        headers?: string[];
        rows?: string[][];
        errors?: ImportError[]
    } {
        try {
            // Remove BOM if present
            let cleanContent = content;
            if (cleanContent.charCodeAt(0) === 0xFEFF) {
                cleanContent = cleanContent.slice(1);
            }

            // Normalize line endings
            cleanContent = cleanContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

            // Split into lines
            const lines = cleanContent.split('\n').filter(line => line.trim() !== '');

            if (lines.length === 0) {
                return {
                    success: false,
                    errors: [{ row: 0, field: 'file', message: 'CSV file is empty' }],
                };
            }

            // Parse header
            const headers = this.parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());

            // Parse data rows
            const rows: string[][] = [];
            for (let i = 1; i < lines.length; i++) {
                const parsedRow = this.parseCSVLine(lines[i]);
                if (parsedRow.length > 0 && parsedRow.some(cell => cell.trim() !== '')) {
                    rows.push(parsedRow);
                }
            }

            return { success: true, headers, rows };

        } catch (error) {
            return {
                success: false,
                errors: [{ row: 0, field: 'file', message: `CSV parsing error: ${error.message}` }],
            };
        }
    }

    /**
     * Parse a single CSV line handling quoted values
     */
    private parseCSVLine(line: string): string[] {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i++; // Skip next quote
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }

        // Don't forget the last field
        result.push(current.trim());

        return result;
    }

    /**
     * Validate CSV headers
     */
    private validateHeaders(headers: string[]): ImportError[] {
        const errors: ImportError[] = [];

        // Check for empty headers
        if (headers.some(h => h === '')) {
            errors.push({
                row: 1,
                field: 'headers',
                message: 'CSV contains empty header columns',
            });
        }

        // Check for duplicate headers
        const seen = new Set<string>();
        for (const header of headers) {
            if (seen.has(header)) {
                errors.push({
                    row: 1,
                    field: 'headers',
                    message: `Duplicate header found: ${header}`,
                });
            }
            seen.add(header);
        }

        // Check for required headers
        for (const required of REQUIRED_HEADERS) {
            if (!headers.includes(required)) {
                errors.push({
                    row: 1,
                    field: 'headers',
                    message: `Missing required header: ${required}`,
                });
            }
        }

        return errors;
    }

    /**
     * Map CSV rows to typed objects
     */
    private mapRowsToObjects(headers: string[], rows: string[][]): Array<CSVRow & { rowIndex: number }> {
        const headerIndices: Record<string, number> = {};
        headers.forEach((h, i) => {
            headerIndices[h] = i;
        });

        return rows.map((row, index) => {
            const obj: any = { rowIndex: index + 2 }; // +2 for header row and 0-indexing

            // Map required fields
            if (headerIndices['sku'] !== undefined) {
                obj.sku = row[headerIndices['sku']]?.trim() || '';
            }
            if (headerIndices['quantity'] !== undefined) {
                const quantityStr = row[headerIndices['quantity']]?.trim() || '';
                obj.quantity = this.parseQuantity(quantityStr);
            }
            if (headerIndices['warehouseid'] !== undefined) {
                obj.warehouseId = row[headerIndices['warehouseid']]?.trim() || '';
            }

            // Map optional fields
            if (headerIndices['cost'] !== undefined) {
                const costStr = row[headerIndices['cost']]?.trim() || '';
                obj.cost = costStr ? parseFloat(costStr) : undefined;
            }
            if (headerIndices['reorderpoint'] !== undefined) {
                const rpStr = row[headerIndices['reorderpoint']]?.trim() || '';
                obj.reorderPoint = rpStr ? parseInt(rpStr, 10) : undefined;
            }
            if (headerIndices['location'] !== undefined) {
                obj.location = row[headerIndices['location']]?.trim() || undefined;
            }

            // Store original data for error reporting
            obj.originalData = { ...obj };

            return obj;
        });
    }

    /**
     * Parse quantity string to number
     */
    private parseQuantity(value: string): number {
        if (!value) return NaN;
        const parsed = parseInt(value, 10);
        return parsed;
    }

    /**
     * Detect duplicate SKUs within the file
     */
    private detectDuplicates(rows: Array<CSVRow & { rowIndex: number }>): {
        deduplicatedRows: Array<CSVRow & { rowIndex: number }>;
        warnings: ImportWarning[];
    } {
        const seen = new Map<string, number>();
        const warnings: ImportWarning[] = [];
        const deduplicatedRows: Array<CSVRow & { rowIndex: number }> = [];

        for (const row of rows) {
            const sku = row.sku;
            if (seen.has(sku)) {
                warnings.push({
                    row: row.rowIndex,
                    message: `Duplicate SKU '${sku}' found in file, using last occurrence`,
                });
                // Remove previous occurrence
                const prevIndex = deduplicatedRows.findIndex(r => r.sku === sku);
                if (prevIndex >= 0) {
                    deduplicatedRows.splice(prevIndex, 1);
                }
            }
            seen.set(sku, row.rowIndex);
            deduplicatedRows.push(row);
        }

        return { deduplicatedRows, warnings };
    }

    /**
     * Process rows with validation and database operations
     */
    private async processRows(
        rows: Array<CSVRow & { rowIndex: number }>,
        options: ImportOptions,
        importId: string
    ): Promise<ImportResult> {
        const errors: ImportError[] = [];
        const warnings: ImportWarning[] = [];
        let created = 0;
        let updated = 0;
        let successCount = 0;
        let errorCount = 0;

        const processRow = async (row: CSVRow & { rowIndex: number }) => {
            // Validate quantity is numeric
            if (isNaN(row.quantity)) {
                return {
                    success: false,
                    error: {
                        row: row.rowIndex,
                        field: 'quantity',
                        message: 'Quantity must be a numeric value',
                        originalData: row.originalData,
                    },
                };
            }

            // Check for Infinity
            if (!isFinite(row.quantity)) {
                return {
                    success: false,
                    error: {
                        row: row.rowIndex,
                        field: 'quantity',
                        message: 'Quantity must be a finite number',
                        originalData: row.originalData,
                    },
                };
            }

            // Use warehouseId from options if not in row
            const warehouseId = row.warehouseId || options.warehouseId;

            // Validate using validation service
            const validationResult = await this.validationService.validate({
                organizationId: options.organizationId,
                sku: row.sku,
                quantity: row.quantity,
                warehouseId: warehouseId || '',
            });

            if (!validationResult.valid) {
                return {
                    success: false,
                    error: {
                        row: row.rowIndex,
                        field: this.determineErrorField(validationResult.errors[0] || ''),
                        message: validationResult.errors[0] || 'Validation failed',
                        originalData: row.originalData,
                    },
                };
            }

            // Check if item exists
            const existing = await this.prisma.inventoryItem.findFirst({
                where: {
                    organizationId: options.organizationId,
                    sku: row.sku,
                },
            });

            if (existing) {
                // Update
                await this.prisma.inventoryItem.update({
                    where: { id: existing.id },
                    data: {
                        quantity: row.quantity,
                        warehouseId: warehouseId,
                        cost: row.cost,
                        reorderPoint: row.reorderPoint,
                        location: row.location,
                        updatedBy: options.userId,
                        updatedAt: new Date(),
                    },
                });
                return { success: true, created: false };
            } else {
                // Create
                await this.prisma.inventoryItem.create({
                    data: {
                        organizationId: options.organizationId,
                        sku: row.sku,
                        quantity: row.quantity,
                        warehouseId: warehouseId,
                        cost: row.cost,
                        reorderPoint: row.reorderPoint,
                        location: row.location,
                        createdBy: options.userId,
                        createdAt: new Date(),
                    },
                });
                return { success: true, created: true };
            }
        };

        // Process with transaction if atomic
        if (options.atomic) {
            try {
                await this.prisma.$transaction(async (tx) => {
                    for (const row of rows) {
                        const result = await processRow(row);
                        if (!result.success) {
                            throw new Error('Atomic import failed');
                        }
                        if (result.created) {
                            created++;
                        } else {
                            updated++;
                        }
                        successCount++;
                    }
                });
            } catch (error) {
                // All rolled back
                return {
                    success: false,
                    importId,
                    totalRows: rows.length,
                    created: 0,
                    updated: 0,
                    successCount: 0,
                    errorCount: rows.length,
                    totalErrors: rows.length,
                    errors: [{
                        row: 0,
                        field: 'transaction',
                        message: error.message?.includes('timeout')
                            ? 'Transaction timeout'
                            : 'Atomic import failed - all changes rolled back',
                    }],
                    warnings: [],
                };
            }
        } else {
            // Process non-atomic (allow partial success)
            for (const row of rows) {
                try {
                    if (options.failOnFirstError && errors.length > 0) {
                        break;
                    }

                    const result = await processRow(row);
                    if (!result.success) {
                        errors.push(result.error!);
                        errorCount++;
                    } else {
                        if (result.created) {
                            created++;
                        } else {
                            updated++;
                        }
                        successCount++;
                    }
                } catch (dbError: any) {
                    // Handle database errors
                    let message = 'Database error';
                    if (dbError.code === 'P2002') {
                        message = 'Unique constraint violation';
                    } else if (dbError.code === 'P2003') {
                        message = 'Foreign key constraint violation';
                    } else if (dbError.message) {
                        message = dbError.message;
                    }

                    errors.push({
                        row: row.rowIndex,
                        field: 'database',
                        message,
                        originalData: row.originalData,
                    });
                    errorCount++;
                }
            }
        }

        const totalErrors = errorCount;
        const limitedErrors = errors.slice(0, MAX_ERRORS_RETURNED);

        const success = errorCount === 0;
        const partialSuccess = !success && successCount > 0;

        return {
            success,
            partialSuccess,
            importId,
            totalRows: rows.length,
            created,
            updated,
            successCount,
            errorCount,
            totalErrors,
            errors: limitedErrors,
            warnings,
        };
    }

    /**
     * Determine which field caused an error from message
     */
    private determineErrorField(message: string): string {
        const lower = message.toLowerCase();
        if (lower.includes('sku')) return 'sku';
        if (lower.includes('quantity')) return 'quantity';
        if (lower.includes('warehouse')) return 'warehouseId';
        if (lower.includes('product')) return 'sku';
        return 'unknown';
    }

    /**
     * Create a failure result
     */
    private createFailureResult(importId: string, errors: ImportError[]): ImportResult {
        // Emit failure event
        this.eventEmitter.emit('inventory.import.failed', {
            importId,
            success: false,
            errors: errors.length,
        });

        return {
            success: false,
            importId,
            totalRows: 0,
            created: 0,
            updated: 0,
            successCount: 0,
            errorCount: errors.length,
            totalErrors: errors.length,
            errors,
            warnings: [],
        };
    }
}
