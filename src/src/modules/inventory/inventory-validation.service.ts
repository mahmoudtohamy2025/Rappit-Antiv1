/**
 * Inventory Validation Service (INV-04)
 * 
 * Comprehensive validation rules for inventory operations.
 * 
 * Features:
 * - SKU format validation (alphanumeric + hyphens, 3-100 chars)
 * - Quantity validation (non-negative integers, max 10M)
 * - Warehouse validation (exists, belongs to org, active)
 * - Product validation (exists, belongs to org, active)
 * - SKU uniqueness per organization
 * - Batch validation with row-level errors
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';

/**
 * Input for inventory validation
 */
export interface InventoryValidationInput {
    organizationId: string;
    sku: string;
    quantity: number;
    warehouseId: string;
    rowIndex?: number; // For batch validation
}

/**
 * Result of single item validation
 */
export interface ValidationResult {
    valid: boolean;
    errors: string[];
}

/**
 * Error detail for batch validation
 */
export interface ValidationError {
    rowIndex: number;
    field: string;
    message: string;
}

/**
 * Result of batch validation
 */
export interface BatchValidationResult {
    validCount: number;
    invalidCount: number;
    errors: ValidationError[];
}

/**
 * Constants
 */
const SKU_MIN_LENGTH = 3;
const SKU_MAX_LENGTH = 100;
const SKU_PATTERN = /^[A-Za-z0-9\-]+$/;
const MAX_QUANTITY = 10_000_000;

@Injectable()
export class InventoryValidationService {
    private readonly logger = new Logger(InventoryValidationService.name);

    constructor(private readonly prisma: PrismaService) { }

    /**
     * Validate a single inventory item
     */
    async validate(input: InventoryValidationInput): Promise<ValidationResult> {
        if (!input) {
            throw new BadRequestException('Validation input is required');
        }

        const errors: string[] = [];

        // Validate organization ID
        if (!input.organizationId || input.organizationId.trim() === '') {
            errors.push('organization ID is required');
        }

        // Validate SKU format
        const skuErrors = this.validateSkuFormat(input.sku);
        errors.push(...skuErrors);

        // Validate quantity
        const quantityErrors = this.validateQuantity(input.quantity);
        errors.push(...quantityErrors);

        // If basic validation fails, return early
        if (errors.length > 0) {
            return { valid: false, errors };
        }

        // Validate warehouse exists and belongs to org
        const warehouseErrors = await this.validateWarehouse(
            input.warehouseId,
            input.organizationId
        );
        errors.push(...warehouseErrors);

        // Validate product exists and belongs to org
        const productErrors = await this.validateProduct(
            input.sku.trim(),
            input.organizationId
        );
        errors.push(...productErrors);

        return {
            valid: errors.length === 0,
            errors,
        };
    }

    /**
     * Validate for creation (includes uniqueness check)
     */
    async validateForCreate(input: InventoryValidationInput): Promise<ValidationResult> {
        const baseResult = await this.validate(input);

        if (!baseResult.valid) {
            return baseResult;
        }

        // Check SKU uniqueness within organization
        const existingItem = await this.prisma.inventoryItem.findFirst({
            where: {
                sku: input.sku.trim(),
                organizationId: input.organizationId,
            },
        });

        if (existingItem) {
            return {
                valid: false,
                errors: [`SKU '${input.sku}' already exists - duplicate not allowed`],
            };
        }

        return { valid: true, errors: [] };
    }

    /**
     * Validate multiple items (batch validation)
     */
    async validateBatch(items: InventoryValidationInput[]): Promise<BatchValidationResult> {
        const errors: ValidationError[] = [];
        let validCount = 0;
        let invalidCount = 0;

        for (const item of items) {
            const result = await this.validate(item);

            if (result.valid) {
                validCount++;
            } else {
                invalidCount++;
                // Determine which field caused the error
                const field = this.determineErrorField(result.errors[0] || '');
                errors.push({
                    rowIndex: item.rowIndex ?? 0,
                    field,
                    message: result.errors[0] || 'Validation failed',
                });
            }
        }

        return { validCount, invalidCount, errors };
    }

    /**
     * Validate SKU format
     */
    private validateSkuFormat(sku: string): string[] {
        const errors: string[] = [];

        if (!sku || sku.trim() === '') {
            errors.push('SKU is required and cannot be empty');
            return errors;
        }

        const trimmedSku = sku.trim();

        if (trimmedSku.length < SKU_MIN_LENGTH) {
            errors.push(`SKU must be at least ${SKU_MIN_LENGTH} characters`);
        }

        if (trimmedSku.length > SKU_MAX_LENGTH) {
            errors.push(`SKU must not exceed ${SKU_MAX_LENGTH} characters`);
        }

        if (!SKU_PATTERN.test(trimmedSku)) {
            errors.push('SKU must contain only alphanumeric characters and hyphens');
        }

        return errors;
    }

    /**
     * Validate quantity
     */
    private validateQuantity(quantity: number): string[] {
        const errors: string[] = [];

        if (typeof quantity !== 'number' || isNaN(quantity)) {
            errors.push('quantity must be a valid number');
            return errors;
        }

        if (quantity < 0) {
            errors.push('quantity cannot be negative');
        }

        if (quantity > MAX_QUANTITY) {
            errors.push(`quantity cannot exceed maximum of ${MAX_QUANTITY.toLocaleString()}`);
        }

        if (!Number.isInteger(quantity)) {
            errors.push('quantity must be an integer');
        }

        return errors;
    }

    /**
     * Validate warehouse exists and belongs to organization
     */
    private async validateWarehouse(warehouseId: string, organizationId: string): Promise<string[]> {
        const errors: string[] = [];

        const warehouse = await this.prisma.warehouse.findFirst({
            where: {
                id: warehouseId,
                organizationId: organizationId,
            },
        });

        if (!warehouse) {
            errors.push(`warehouse '${warehouseId}' not found or not accessible`);
            return errors;
        }

        if (warehouse.status === 'INACTIVE') {
            errors.push(`warehouse '${warehouseId}' is inactive`);
        }

        return errors;
    }

    /**
     * Validate product exists and belongs to organization
     */
    private async validateProduct(sku: string, organizationId: string): Promise<string[]> {
        const errors: string[] = [];

        const product = await this.prisma.product.findFirst({
            where: {
                sku: sku,
                organizationId: organizationId,
            },
        });

        if (!product) {
            errors.push(`product with SKU '${sku}' not found or not accessible`);
            return errors;
        }

        if (product.status === 'INACTIVE') {
            errors.push(`product with SKU '${sku}' is inactive`);
        }

        return errors;
    }

    /**
     * Determine which field caused the validation error
     */
    private determineErrorField(errorMessage: string): string {
        const lower = errorMessage.toLowerCase();

        if (lower.includes('sku')) return 'sku';
        if (lower.includes('quantity')) return 'quantity';
        if (lower.includes('warehouse')) return 'warehouseId';
        if (lower.includes('product')) return 'sku';
        if (lower.includes('organization')) return 'organizationId';

        return 'unknown';
    }
}
