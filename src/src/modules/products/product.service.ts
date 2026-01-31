/**
 * Product Service
 * GAP-02: Product/SKU CRUD Implementation
 * 
 * Best Practices:
 * - Multi-tenant organization isolation
 * - SKU uniqueness per organization
 * - Soft delete for products with inventory
 * - Stock status calculation
 * - Comprehensive filtering
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { Product, SKU, Prisma } from '@prisma/client';

// ============================================================
// DTOs
// ============================================================

export interface CreateProductDto {
    name: string;
    sku?: string;
    description?: string;
    category?: string;
    barcode?: string;
    price?: number;
    cost?: number;
    minStock?: number;
    maxStock?: number;
    images?: string[];
    metadata?: Record<string, any>;
    initialStock?: {
        warehouseId: string;
        quantity: number;
    };
}

export interface UpdateProductDto {
    name?: string;
    sku?: string;
    description?: string;
    category?: string;
    barcode?: string;
    price?: number;
    cost?: number;
    minStock?: number;
    maxStock?: number;
    images?: string[];
    metadata?: Record<string, any>;
    isActive?: boolean;
}

export interface ProductFilters {
    search?: string;
    category?: string;
    warehouseId?: string;
    stockLevel?: 'low' | 'out' | 'normal' | 'all';
    isActive?: boolean;
    page?: number;
    pageSize?: number;
}

export interface WarehouseStock {
    warehouseId: string;
    warehouseName: string;
    available: number;
    reserved: number;
    damaged: number;
}

export interface ProductWithStock extends Product {
    sku: string;
    barcode: string | null;
    price: number | null;
    cost: number | null;
    minStock: number;
    maxStock: number | null;
    totalAvailable: number;
    totalReserved: number;
    stockStatus: 'LOW' | 'OUT' | 'NORMAL';
    stockByWarehouse?: WarehouseStock[];
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
export class ProductService {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Create a new product with SKU
     */
    async createProduct(
        organizationId: string,
        dto: CreateProductDto,
    ): Promise<ProductWithStock> {
        // Validate minStock < maxStock
        if (dto.minStock !== undefined && dto.maxStock !== undefined) {
            if (dto.minStock > dto.maxStock) {
                throw new BadRequestException('الحد الأدنى يجب أن يكون أقل من الحد الأقصى');
            }
        }

        // Generate SKU if not provided
        let sku = dto.sku;
        if (!sku) {
            const count = await this.prisma.sKU.count({
                where: { organizationId },
            });
            sku = `PRD-${String(count + 1).padStart(6, '0')}`;
        }

        // Check for duplicate SKU
        const existingSku = await this.prisma.sKU.findFirst({
            where: {
                organizationId,
                sku,
            },
        });

        if (existingSku) {
            throw new BadRequestException(`رمز المنتج "${sku}" مستخدم بالفعل`);
        }

        // Create product and SKU in transaction
        return this.prisma.$transaction(async (tx) => {
            // Create the product
            const product = await tx.product.create({
                data: {
                    organizationId,
                    name: dto.name,
                    description: dto.description,
                    category: dto.category,
                    metadata: dto.metadata,
                },
            });

            // Create the SKU
            const skuRecord = await tx.sKU.create({
                data: {
                    organizationId,
                    productId: product.id,
                    sku,
                    barcode: dto.barcode,
                    metadata: {
                        price: dto.price,
                        cost: dto.cost,
                        minStock: dto.minStock ?? 10,
                        maxStock: dto.maxStock,
                        images: dto.images ?? [],
                    },
                },
            });

            // Create initial stock if provided
            if (dto.initialStock) {
                await tx.inventoryLevel.create({
                    data: {
                        organizationId,
                        skuId: skuRecord.id,
                        warehouseId: dto.initialStock.warehouseId,
                        available: dto.initialStock.quantity,
                        reserved: 0,
                        damaged: 0,
                    },
                });
            }

            return this.formatProductResponse(product, skuRecord, dto.initialStock?.quantity ?? 0);
        });
    }

    /**
     * Get all products for an organization with filtering
     */
    async getProducts(
        organizationId: string,
        filters: ProductFilters,
    ): Promise<PaginatedResponse<ProductWithStock>> {
        const {
            search,
            category,
            warehouseId,
            stockLevel,
            isActive = true,
            page = 1,
            pageSize = 25
        } = filters;

        const where: Prisma.ProductWhereInput = {
            organizationId,
        };

        // Filter by category
        if (category) {
            where.category = category;
        }

        // Search by name or SKU
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { skus: { some: { sku: { contains: search, mode: 'insensitive' } } } },
            ];
        }

        // Filter by warehouse
        if (warehouseId) {
            where.skus = {
                some: {
                    inventoryLevels: {
                        some: {
                            warehouseId,
                        },
                    },
                },
            };
        }

        const [products, total] = await Promise.all([
            this.prisma.product.findMany({
                where,
                include: {
                    skus: {
                        include: {
                            inventoryLevels: {
                                include: {
                                    warehouse: true,
                                },
                            },
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            this.prisma.product.count({ where }),
        ]);

        // Transform to ProductWithStock
        let data = products.map((p) => this.transformProduct(p));

        // Filter by stock level (client-side for now)
        if (stockLevel && stockLevel !== 'all') {
            data = data.filter((p) => {
                if (stockLevel === 'low') return p.stockStatus === 'LOW';
                if (stockLevel === 'out') return p.stockStatus === 'OUT';
                if (stockLevel === 'normal') return p.stockStatus === 'NORMAL';
                return true;
            });
        }

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
     * Get product by ID
     */
    async getProductById(
        organizationId: string,
        productId: string,
    ): Promise<ProductWithStock> {
        const product = await this.prisma.product.findFirst({
            where: {
                id: productId,
                organizationId,
            },
            include: {
                skus: {
                    include: {
                        inventoryLevels: {
                            include: {
                                warehouse: true,
                            },
                        },
                    },
                },
            },
        });

        if (!product) {
            throw new NotFoundException('المنتج غير موجود');
        }

        return this.transformProduct(product);
    }

    /**
     * Update a product
     */
    async updateProduct(
        organizationId: string,
        productId: string,
        dto: UpdateProductDto,
    ): Promise<ProductWithStock> {
        // Check product exists
        const existing = await this.prisma.product.findFirst({
            where: {
                id: productId,
                organizationId,
            },
            include: {
                skus: true,
            },
        });

        if (!existing) {
            throw new NotFoundException('المنتج غير موجود');
        }

        // Validate minStock < maxStock
        if (dto.minStock !== undefined && dto.maxStock !== undefined) {
            if (dto.minStock > dto.maxStock) {
                throw new BadRequestException('الحد الأدنى يجب أن يكون أقل من الحد الأقصى');
            }
        }

        // Check for duplicate SKU if updating
        if (dto.sku && existing.skus[0]?.sku !== dto.sku) {
            const duplicateSku = await this.prisma.sKU.findFirst({
                where: {
                    organizationId,
                    sku: dto.sku,
                    id: { not: existing.skus[0]?.id },
                },
            });

            if (duplicateSku) {
                throw new BadRequestException(`رمز المنتج "${dto.sku}" مستخدم بالفعل`);
            }
        }

        // Update product
        const updated = await this.prisma.product.update({
            where: { id: productId },
            data: {
                ...(dto.name && { name: dto.name }),
                ...(dto.description !== undefined && { description: dto.description }),
                ...(dto.category !== undefined && { category: dto.category }),
                ...(dto.metadata !== undefined && { metadata: dto.metadata }),
            },
            include: {
                skus: {
                    include: {
                        inventoryLevels: {
                            include: {
                                warehouse: true,
                            },
                        },
                    },
                },
            },
        });

        // Update SKU if needed
        if (existing.skus[0] && (dto.sku || dto.barcode !== undefined || dto.price !== undefined)) {
            const currentMeta = (existing.skus[0].metadata as any) || {};
            await this.prisma.sKU.update({
                where: { id: existing.skus[0].id },
                data: {
                    ...(dto.sku && { sku: dto.sku }),
                    ...(dto.barcode !== undefined && { barcode: dto.barcode }),
                    metadata: {
                        ...currentMeta,
                        ...(dto.price !== undefined && { price: dto.price }),
                        ...(dto.cost !== undefined && { cost: dto.cost }),
                        ...(dto.minStock !== undefined && { minStock: dto.minStock }),
                        ...(dto.maxStock !== undefined && { maxStock: dto.maxStock }),
                        ...(dto.images !== undefined && { images: dto.images }),
                    },
                },
            });
        }

        return this.transformProduct(updated);
    }

    /**
     * Delete a product
     */
    async deleteProduct(
        organizationId: string,
        productId: string,
    ): Promise<void> {
        const product = await this.prisma.product.findFirst({
            where: {
                id: productId,
                organizationId,
            },
            include: {
                skus: true,
            },
        });

        if (!product) {
            throw new NotFoundException('المنتج غير موجود');
        }

        // Check for active reservations
        const skuIds = product.skus.map((s) => s.id);
        const reservationCount = await this.prisma.inventoryReservation.count({
            where: {
                skuId: { in: skuIds },
                status: 'ACTIVE',
            },
        });

        if (reservationCount > 0) {
            throw new BadRequestException(
                `لا يمكن حذف المنتج لوجود ${reservationCount} حجوزات نشطة`
            );
        }

        // Check for inventory
        const inventoryCount = await this.prisma.inventoryLevel.count({
            where: {
                skuId: { in: skuIds },
            },
        });

        if (inventoryCount > 0) {
            // Soft delete - just deactivate
            await this.prisma.product.update({
                where: { id: productId },
                data: {
                    metadata: {
                        ...(product.metadata as any || {}),
                        isActive: false,
                    },
                },
            });
        } else {
            // Hard delete
            await this.prisma.product.delete({
                where: { id: productId },
            });
        }
    }

    /**
     * Get product stock history
     */
    async getProductHistory(
        organizationId: string,
        productId: string,
    ): Promise<any[]> {
        const product = await this.prisma.product.findFirst({
            where: {
                id: productId,
                organizationId,
            },
            include: {
                skus: true,
            },
        });

        if (!product) {
            throw new NotFoundException('المنتج غير موجود');
        }

        const skuIds = product.skus.map((s) => s.id);

        return this.prisma.inventoryAdjustment.findMany({
            where: {
                skuId: { in: skuIds },
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
    }

    /**
     * Get unique categories for organization
     */
    async getCategories(organizationId: string): Promise<string[]> {
        const products = await this.prisma.product.findMany({
            where: {
                organizationId,
                category: { not: null },
            },
            select: {
                category: true,
            },
            distinct: ['category'],
        });

        return [...new Set(products.map((p) => p.category).filter(Boolean) as string[])];
    }

    /**
     * Get product stock totals
     */
    async getProductStock(
        organizationId: string,
        productId: string,
    ): Promise<{ totalAvailable: number; totalReserved: number; totalDamaged: number }> {
        const product = await this.prisma.product.findFirst({
            where: {
                id: productId,
                organizationId,
            },
            include: {
                skus: true,
            },
        });

        if (!product) {
            throw new NotFoundException('المنتج غير موجود');
        }

        const skuIds = product.skus.map((s) => s.id);

        const aggregates = await this.prisma.inventoryLevel.aggregate({
            where: {
                skuId: { in: skuIds },
            },
            _sum: {
                available: true,
                reserved: true,
                damaged: true,
            },
        });

        return {
            totalAvailable: aggregates._sum.available || 0,
            totalReserved: aggregates._sum.reserved || 0,
            totalDamaged: aggregates._sum.damaged || 0,
        };
    }

    /**
     * Calculate stock status
     */
    calculateStockStatus(
        available: number,
        minStock: number,
        maxStock: number | null,
    ): 'LOW' | 'OUT' | 'NORMAL' {
        if (available <= 0) return 'OUT';
        if (available < minStock) return 'LOW';
        return 'NORMAL';
    }

    // ============================================================
    // PRIVATE HELPERS
    // ============================================================

    private transformProduct(product: any): ProductWithStock {
        const sku = product.skus?.[0];
        const meta = (sku?.metadata as any) || {};

        // Aggregate stock across warehouses
        let totalAvailable = 0;
        let totalReserved = 0;
        const stockByWarehouse: WarehouseStock[] = [];

        if (sku?.inventoryLevels) {
            for (const level of sku.inventoryLevels) {
                totalAvailable += level.available;
                totalReserved += level.reserved;
                stockByWarehouse.push({
                    warehouseId: level.warehouseId,
                    warehouseName: level.warehouse?.name || 'غير معروف',
                    available: level.available,
                    reserved: level.reserved,
                    damaged: level.damaged,
                });
            }
        }

        const minStock = meta.minStock ?? 10;
        const maxStock = meta.maxStock ?? null;

        return {
            ...product,
            sku: sku?.sku || '',
            barcode: sku?.barcode || null,
            price: meta.price || null,
            cost: meta.cost || null,
            minStock,
            maxStock,
            totalAvailable,
            totalReserved,
            stockStatus: this.calculateStockStatus(totalAvailable, minStock, maxStock),
            stockByWarehouse,
        };
    }

    private formatProductResponse(
        product: Product,
        sku: SKU,
        initialQuantity: number,
    ): ProductWithStock {
        const meta = (sku.metadata as any) || {};
        return {
            ...product,
            sku: sku.sku,
            barcode: sku.barcode,
            price: meta.price || null,
            cost: meta.cost || null,
            minStock: meta.minStock ?? 10,
            maxStock: meta.maxStock ?? null,
            totalAvailable: initialQuantity,
            totalReserved: 0,
            stockStatus: this.calculateStockStatus(initialQuantity, meta.minStock ?? 10, meta.maxStock),
            stockByWarehouse: [],
        };
    }
}
