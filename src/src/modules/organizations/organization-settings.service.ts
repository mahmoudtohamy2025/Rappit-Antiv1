/**
 * Organization Settings Service
 * GAP-10: Organization Settings Implementation
 * 
 * Provides organization profile, settings, and statistics
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';

// ============================================================
// VALID TIMEZONES (subset of common ones)
// ============================================================

const VALID_TIMEZONES = [
    'Africa/Cairo',
    'Africa/Casablanca',
    'Asia/Riyadh',
    'Asia/Dubai',
    'Asia/Kuwait',
    'Asia/Bahrain',
    'Asia/Qatar',
    'Asia/Muscat',
    'Asia/Amman',
    'Asia/Beirut',
    'Asia/Jerusalem',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'America/New_York',
    'America/Los_Angeles',
    'UTC',
];

// ============================================================
// DTOs
// ============================================================

export interface OrganizationProfile {
    id: string;
    name: string;
    logo: string | null;
    timezone: string;
    isActive: boolean;
    createdAt: Date;
    usersCount?: number;
    warehousesCount?: number;
    productsCount?: number;
    ordersCount?: number;
}

export interface UpdateOrganizationDto {
    name?: string;
    logo?: string;
    timezone?: string;
}

export interface NotificationSettings {
    emailEnabled: boolean;
    lowStockAlerts: boolean;
    orderAlerts: boolean;
    weeklyReport: boolean;
}

export interface GeneralSettings {
    timezone: string;
    dateFormat: string;
    language: string;
}

export interface OrganizationSettings {
    notifications: NotificationSettings;
    general: GeneralSettings;
}

export interface UpdateSettingsDto {
    notifications?: Partial<NotificationSettings>;
    general?: Partial<GeneralSettings>;
}

export interface OrganizationStats {
    users: number;
    warehouses: number;
    products: number;
    orders: {
        total: number;
        thisMonth: number;
        pending: number;
    };
    inventory: {
        totalItems: number;
        lowStock: number;
        outOfStock: number;
    };
}

// ============================================================
// DEFAULT SETTINGS
// ============================================================

const DEFAULT_SETTINGS: OrganizationSettings = {
    notifications: {
        emailEnabled: true,
        lowStockAlerts: true,
        orderAlerts: true,
        weeklyReport: false,
    },
    general: {
        timezone: 'Asia/Riyadh',
        dateFormat: 'DD/MM/YYYY',
        language: 'ar',
    },
};

// ============================================================
// SERVICE
// ============================================================

@Injectable()
export class OrganizationSettingsService {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Validate timezone
     */
    validateTimezone(timezone: string): boolean {
        if (!timezone) return false;
        return VALID_TIMEZONES.includes(timezone);
    }

    /**
     * Get current organization profile
     */
    async getCurrentOrganization(
        organizationId: string,
        options?: { includeStats?: boolean },
    ): Promise<OrganizationProfile> {
        const org = await this.prisma.organization.findUnique({
            where: { id: organizationId },
        });

        if (!org) {
            throw new NotFoundException('المؤسسة غير موجودة');
        }

        const profile: OrganizationProfile = {
            id: org.id,
            name: org.name,
            logo: (org as any).logo || null,
            timezone: (org as any).timezone || 'Asia/Riyadh',
            isActive: org.isActive,
            createdAt: org.createdAt,
        };

        if (options?.includeStats) {
            const [usersCount, warehousesCount, productsCount, ordersCount] = await Promise.all([
                this.prisma.userOrganization.count({ where: { organizationId } }),
                this.prisma.warehouse.count({ where: { organizationId } }),
                this.prisma.product.count({ where: { organizationId } }),
                this.prisma.order.count({ where: { organizationId } }),
            ]);

            profile.usersCount = usersCount;
            profile.warehousesCount = warehousesCount;
            profile.productsCount = productsCount;
            profile.ordersCount = ordersCount;
        }

        return profile;
    }

    /**
     * Update organization profile
     */
    async updateOrganization(
        organizationId: string,
        dto: UpdateOrganizationDto,
    ): Promise<OrganizationProfile> {
        const org = await this.prisma.organization.findUnique({
            where: { id: organizationId },
        });

        if (!org) {
            throw new NotFoundException('المؤسسة غير موجودة');
        }

        // Validate timezone if provided
        if (dto.timezone && !this.validateTimezone(dto.timezone)) {
            throw new BadRequestException(`المنطقة الزمنية غير صالحة: ${dto.timezone}`);
        }

        const updated = await this.prisma.organization.update({
            where: { id: organizationId },
            data: {
                ...(dto.name && { name: dto.name }),
                ...(dto.logo !== undefined && { logo: dto.logo } as any),
                ...(dto.timezone && { timezone: dto.timezone } as any),
            },
        });

        return {
            id: updated.id,
            name: updated.name,
            logo: (updated as any).logo || null,
            timezone: (updated as any).timezone || 'Asia/Riyadh',
            isActive: updated.isActive,
            createdAt: updated.createdAt,
        };
    }

    /**
     * Get organization settings
     */
    async getSettings(organizationId: string): Promise<OrganizationSettings> {
        const org = await this.prisma.organization.findUnique({
            where: { id: organizationId },
            select: { settings: true, timezone: true } as any,
        });

        if (!org) {
            throw new NotFoundException('المؤسسة غير موجودة');
        }

        const savedSettings = (org as any).settings as OrganizationSettings | null;

        // Merge with defaults
        return {
            notifications: {
                ...DEFAULT_SETTINGS.notifications,
                ...savedSettings?.notifications,
            },
            general: {
                ...DEFAULT_SETTINGS.general,
                timezone: (org as any).timezone || DEFAULT_SETTINGS.general.timezone,
                ...savedSettings?.general,
            },
        };
    }

    /**
     * Update organization settings
     */
    async updateSettings(
        organizationId: string,
        dto: UpdateSettingsDto,
    ): Promise<OrganizationSettings> {
        const org = await this.prisma.organization.findUnique({
            where: { id: organizationId },
            select: { settings: true } as any,
        });

        if (!org) {
            throw new NotFoundException('المؤسسة غير موجودة');
        }

        const currentSettings = (org as any).settings as OrganizationSettings | null || DEFAULT_SETTINGS;

        // Merge settings
        const newSettings: OrganizationSettings = {
            notifications: {
                ...currentSettings.notifications,
                ...dto.notifications,
            },
            general: {
                ...currentSettings.general,
                ...dto.general,
            },
        };

        await this.prisma.organization.update({
            where: { id: organizationId },
            data: {
                settings: newSettings,
            } as any,
        });

        return newSettings;
    }

    /**
     * Get organization statistics
     */
    async getStats(organizationId: string): Promise<OrganizationStats> {
        const org = await this.prisma.organization.findUnique({
            where: { id: organizationId },
        });

        if (!org) {
            throw new NotFoundException('المؤسسة غير موجودة');
        }

        // Get this month's date range
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        // Run all queries in parallel
        const [
            users,
            warehouses,
            products,
            ordersTotal,
            ordersThisMonth,
            ordersPending,
            inventoryTotal,
            inventoryLowStock,
            inventoryOutOfStock,
        ] = await Promise.all([
            this.prisma.userOrganization.count({ where: { organizationId } }),
            this.prisma.warehouse.count({ where: { organizationId } }),
            this.prisma.product.count({ where: { organizationId } }),
            this.prisma.order.count({ where: { organizationId } }),
            this.prisma.order.count({
                where: {
                    organizationId,
                    createdAt: { gte: startOfMonth },
                },
            }),
            this.prisma.order.count({
                where: {
                    organizationId,
                    status: 'PENDING',
                },
            }),
            this.prisma.inventoryLevel.count({
                where: {
                    organizationId,
                },
            }),
            this.prisma.inventoryLevel.count({
                where: {
                    organizationId,
                    available: { gt: 0, lte: 10 }, // Low stock threshold
                },
            }),
            this.prisma.inventoryLevel.count({
                where: {
                    organizationId,
                    available: 0,
                },
            }),
        ]);

        return {
            users,
            warehouses,
            products,
            orders: {
                total: ordersTotal,
                thisMonth: ordersThisMonth,
                pending: ordersPending,
            },
            inventory: {
                totalItems: inventoryTotal,
                lowStock: inventoryLowStock,
                outOfStock: inventoryOutOfStock,
            },
        };
    }
}
