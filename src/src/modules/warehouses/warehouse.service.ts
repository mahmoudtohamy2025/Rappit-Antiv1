/**
 * Warehouse Service
 * GAP-01: Warehouse CRUD Implementation
 * 
 * Best Practices:
 * - Multi-tenant organization isolation
 * - Soft delete for warehouses with inventory
 * - Auto-generated codes if not provided
 * - Default warehouse management
 * - Comprehensive stats calculation
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { Warehouse, Prisma } from '@prisma/client';

// ============================================================
// DTOs
// ============================================================

export interface CreateWarehouseDto {
    name: string;
    code?: string;
    address?: {
        street?: string;
        city?: string;
        country?: string;
        postalCode?: string;
    };
    capacity?: number;
    contactName?: string;
    contactPhone?: string;
    contactEmail?: string;
    isActive?: boolean;
}

export interface UpdateWarehouseDto {
    name?: string;
    code?: string;
    address?: {
        street?: string;
        city?: string;
        country?: string;
        postalCode?: string;
    };
    capacity?: number;
    contactName?: string;
    contactPhone?: string;
    contactEmail?: string;
    isActive?: boolean;
}

export interface GetWarehousesDto {
    search?: string;
    isActive?: boolean;
    page?: number;
    pageSize?: number;
}

export interface WarehouseStats {
    totalItems: number;
    totalQuantity: number;
    reservedQuantity: number;
    damagedQuantity: number;
    lowStockItems: number;
}

interface PaginatedResponse<T> {
    data: T[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
    };
}

// ============================================================
// SERVICE
// ============================================================

@Injectable()
export class WarehouseService {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Create a new warehouse
     */
    async createWarehouse(
        organizationId: string,
        dto: CreateWarehouseDto,
    ): Promise<Warehouse> {
        // Check for duplicate name
        const existingByName = await this.prisma.warehouse.findFirst({
            where: {
                organizationId,
                name: dto.name,
            },
        });

        if (existingByName) {
            throw new BadRequestException(`اسم المستودع "${dto.name}" مستخدم بالفعل`);
        }

        // Generate code if not provided
        let code = dto.code;
        if (!code) {
            const count = await this.prisma.warehouse.count({
                where: { organizationId },
            });
            code = `WH-${String(count + 1).padStart(3, '0')}`;
        } else {
            // Check for duplicate code
            const existingByCode = await this.prisma.warehouse.findFirst({
                where: {
                    organizationId,
                    code: dto.code,
                },
            });

            if (existingByCode) {
                throw new BadRequestException(`كود المستودع "${dto.code}" مستخدم بالفعل`);
            }
        }

        // Check if this is the first warehouse (make it default)
        const warehouseCount = await this.prisma.warehouse.count({
            where: { organizationId },
        });
        const isDefault = warehouseCount === 0;

        return this.prisma.warehouse.create({
            data: {
                organizationId,
                name: dto.name,
                code,
                address: dto.address || null,
                isActive: dto.isActive ?? true,
                isDefault,
            },
        });
    }

    /**
     * Get all warehouses for an organization with pagination and filtering
     */
    async getWarehouses(
        organizationId: string,
        dto: GetWarehousesDto,
    ): Promise<PaginatedResponse<Warehouse>> {
        const { search, isActive, page = 1, pageSize = 25 } = dto;

        const where: Prisma.WarehouseWhereInput = {
            organizationId,
        };

        // Filter by active status
        if (isActive !== undefined) {
            where.isActive = isActive;
        }

        // Search by name or code
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { code: { contains: search, mode: 'insensitive' } },
            ];
        }

        const [data, total] = await Promise.all([
            this.prisma.warehouse.findMany({
                where,
                orderBy: [
                    { isDefault: 'desc' },
                    { name: 'asc' },
                ],
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            this.prisma.warehouse.count({ where }),
        ]);

        return {
            data,
            meta: {
                total,
                page,
                pageSize,
                totalPages: Math.ceil(total / pageSize),
            },
        };
    }

    /**
     * Get a warehouse by ID
     */
    async getWarehouseById(
        organizationId: string,
        warehouseId: string,
        options?: { includeStats?: boolean },
    ): Promise<Warehouse & { stats?: WarehouseStats }> {
        const warehouse = await this.prisma.warehouse.findFirst({
            where: {
                id: warehouseId,
                organizationId,
            },
        });

        if (!warehouse) {
            throw new NotFoundException(`المستودع غير موجود`);
        }

        if (options?.includeStats) {
            const stats = await this.getWarehouseStats(organizationId, warehouseId);
            return { ...warehouse, stats };
        }

        return warehouse;
    }

    /**
     * Update a warehouse
     */
    async updateWarehouse(
        organizationId: string,
        warehouseId: string,
        dto: UpdateWarehouseDto,
    ): Promise<Warehouse> {
        // Check warehouse exists
        const existing = await this.prisma.warehouse.findFirst({
            where: {
                id: warehouseId,
                organizationId,
            },
        });

        if (!existing) {
            throw new NotFoundException(`المستودع غير موجود`);
        }

        // Check for duplicate name if changing
        if (dto.name && dto.name !== existing.name) {
            const duplicateName = await this.prisma.warehouse.findFirst({
                where: {
                    organizationId,
                    name: dto.name,
                    id: { not: warehouseId },
                },
            });

            if (duplicateName) {
                throw new BadRequestException(`اسم المستودع "${dto.name}" مستخدم بالفعل`);
            }
        }

        // Check for duplicate code if changing
        if (dto.code && dto.code !== existing.code) {
            const duplicateCode = await this.prisma.warehouse.findFirst({
                where: {
                    organizationId,
                    code: dto.code,
                    id: { not: warehouseId },
                },
            });

            if (duplicateCode) {
                throw new BadRequestException(`كود المستودع "${dto.code}" مستخدم بالفعل`);
            }
        }

        return this.prisma.warehouse.update({
            where: { id: warehouseId },
            data: {
                ...(dto.name && { name: dto.name }),
                ...(dto.code && { code: dto.code }),
                ...(dto.address !== undefined && { address: dto.address }),
                ...(dto.capacity !== undefined && { capacity: dto.capacity }),
                ...(dto.contactName !== undefined && { contactName: dto.contactName }),
                ...(dto.contactPhone !== undefined && { contactPhone: dto.contactPhone }),
                ...(dto.contactEmail !== undefined && { contactEmail: dto.contactEmail }),
                ...(dto.isActive !== undefined && { isActive: dto.isActive }),
            },
        });
    }

    /**
     * Delete a warehouse
     * - Cannot delete if has active reservations
     * - Soft deletes if has inventory (no reservations)
     * - Hard deletes if empty
     */
    async deleteWarehouse(
        organizationId: string,
        warehouseId: string,
    ): Promise<void> {
        const warehouse = await this.prisma.warehouse.findFirst({
            where: {
                id: warehouseId,
                organizationId,
            },
        });

        if (!warehouse) {
            throw new NotFoundException(`المستودع غير موجود`);
        }

        // Check for active reservations
        const reservationCount = await this.prisma.inventoryReservation.count({
            where: {
                warehouseId,
                status: 'ACTIVE',
            },
        });

        if (reservationCount > 0) {
            throw new BadRequestException(
                `لا يمكن حذف المستودع لوجود ${reservationCount} حجوزات نشطة`
            );
        }

        // Check if default warehouse and others exist
        if (warehouse.isDefault) {
            const otherCount = await this.prisma.warehouse.count({
                where: {
                    organizationId,
                    id: { not: warehouseId },
                    isActive: true,
                },
            });

            if (otherCount > 0) {
                throw new BadRequestException(
                    `لا يمكن حذف المستودع الافتراضي. يرجى تعيين مستودع آخر كافتراضي أولاً`
                );
            }
        }

        // Check for inventory items
        const inventoryCount = await this.prisma.inventoryLevel.count({
            where: { warehouseId },
        });

        if (inventoryCount > 0) {
            // Soft delete - just deactivate
            await this.prisma.warehouse.update({
                where: { id: warehouseId },
                data: { isActive: false },
            });
        } else {
            // Hard delete - no inventory
            await this.prisma.warehouse.delete({
                where: { id: warehouseId },
            });
        }
    }

    /**
     * Set a warehouse as the default
     */
    async setDefaultWarehouse(
        organizationId: string,
        warehouseId: string,
    ): Promise<Warehouse> {
        const warehouse = await this.prisma.warehouse.findFirst({
            where: {
                id: warehouseId,
                organizationId,
            },
        });

        if (!warehouse) {
            throw new NotFoundException(`المستودع غير موجود`);
        }

        // Unset current default
        await this.prisma.warehouse.updateMany({
            where: {
                organizationId,
                isDefault: true,
            },
            data: {
                isDefault: false,
            },
        });

        // Set new default
        return this.prisma.warehouse.update({
            where: { id: warehouseId },
            data: { isDefault: true },
        });
    }

    /**
     * Get inventory stats for a warehouse
     */
    async getWarehouseStats(
        organizationId: string,
        warehouseId: string,
    ): Promise<WarehouseStats> {
        // Verify warehouse exists and belongs to org
        const warehouse = await this.prisma.warehouse.findFirst({
            where: {
                id: warehouseId,
                organizationId,
            },
        });

        if (!warehouse) {
            throw new NotFoundException(`المستودع غير موجود`);
        }

        // Get aggregated quantities
        const aggregates = await this.prisma.inventoryLevel.aggregate({
            where: { warehouseId },
            _sum: {
                available: true,
                reserved: true,
                damaged: true,
            },
        });

        // Get total items count
        const totalItems = await this.prisma.inventoryLevel.count({
            where: { warehouseId },
        });

        // Get low stock items count (available < 10)
        const lowStockItems = await this.prisma.inventoryLevel.count({
            where: {
                warehouseId,
                available: { lt: 10 },
            },
        });

        return {
            totalItems,
            totalQuantity: aggregates._sum.available || 0,
            reservedQuantity: aggregates._sum.reserved || 0,
            damagedQuantity: aggregates._sum.damaged || 0,
            lowStockItems,
        };
    }

    /**
     * Get the default warehouse for an organization
     */
    async getDefaultWarehouse(organizationId: string): Promise<Warehouse | null> {
        return this.prisma.warehouse.findFirst({
            where: {
                organizationId,
                isDefault: true,
                isActive: true,
            },
        });
    }
}
