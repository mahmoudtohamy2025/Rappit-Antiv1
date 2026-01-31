/**
 * useAdmin Hook
 * API hook for platform admin operations
 * 
 * Part of: GAP-14 Admin Platform Dashboard
 */

import { useState, useCallback } from 'react';

// ============================================================
// TYPES
// ============================================================

export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED';

export interface PlatformStats {
    totalOrganizations: number;
    activeOrganizations: number;
    trialOrganizations: number;
    totalUsers: number;
    mrr: number;
    newSignupsThisMonth: number;
    churnRate: number;
}

export interface AdminOrganization {
    id: string;
    name: string;
    isActive: boolean;
    subscriptionStatus: SubscriptionStatus;
    currentPlan: string;
    userCount: number;
    orderCount: number;
    createdAt: string;
}

export interface AdminOrganizationDetail extends AdminOrganization {
    billingEmail?: string;
    trialEndsAt?: string;
    subscriptionEndsAt?: string;
    stripeCustomerId?: string;
    users: Array<{ id: string; email: string; name: string; role: string }>;
    recentOrders: number;
    totalRevenue: number;
    inventoryCount: number;
    warehouseCount: number;
}

export interface AdminOrgFilters {
    status?: SubscriptionStatus;
    search?: string;
    isActive?: boolean;
    page?: number;
    pageSize?: number;
}

interface UseAdminReturn {
    stats: PlatformStats | null;
    organizations: AdminOrganization[];
    currentOrg: AdminOrganizationDetail | null;
    isLoading: boolean;
    error: Error | null;
    getStats: () => Promise<void>;
    getOrganizations: (filters?: AdminOrgFilters) => Promise<void>;
    getOrganizationById: (id: string) => Promise<AdminOrganizationDetail>;
    updateOrganization: (id: string, data: Partial<AdminOrganization>) => Promise<AdminOrganization>;
    activateOrganization: (id: string) => Promise<void>;
    deactivateOrganization: (id: string) => Promise<void>;
}

const API_BASE = '/api/v1/admin';

// ============================================================
// HOOK
// ============================================================

export function useAdmin(): UseAdminReturn {
    const [stats, setStats] = useState<PlatformStats | null>(null);
    const [organizations, setOrganizations] = useState<AdminOrganization[]>([]);
    const [currentOrg, setCurrentOrg] = useState<AdminOrganizationDetail | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const getStats = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(`${API_BASE}/stats`);
            if (!response.ok) throw new Error('فشل تحميل الإحصائيات');
            const data = await response.json();
            setStats(data);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Unknown error'));
        } finally {
            setIsLoading(false);
        }
    }, []);

    const getOrganizations = useCallback(async (filters?: AdminOrgFilters) => {
        setIsLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams();
            if (filters?.status) params.append('status', filters.status);
            if (filters?.search) params.append('search', filters.search);
            if (filters?.isActive !== undefined) params.append('isActive', String(filters.isActive));
            if (filters?.page) params.append('page', String(filters.page));
            if (filters?.pageSize) params.append('pageSize', String(filters.pageSize));

            const response = await fetch(`${API_BASE}/organizations?${params}`);
            if (!response.ok) throw new Error('فشل تحميل المنظمات');
            const data = await response.json();
            setOrganizations(data.data || data);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Unknown error'));
        } finally {
            setIsLoading(false);
        }
    }, []);

    const getOrganizationById = useCallback(async (id: string): Promise<AdminOrganizationDetail> => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(`${API_BASE}/organizations/${id}`);
            if (!response.ok) {
                if (response.status === 404) throw new Error('المنظمة غير موجودة');
                throw new Error('فشل تحميل بيانات المنظمة');
            }
            const data = await response.json();
            setCurrentOrg(data);
            return data;
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Unknown error');
            setError(error);
            throw error;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const updateOrganization = useCallback(async (
        id: string,
        data: Partial<AdminOrganization>
    ): Promise<AdminOrganization> => {
        const response = await fetch(`${API_BASE}/organizations/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        if (!response.ok) throw new Error('فشل تحديث المنظمة');

        const updated = await response.json();
        setOrganizations(prev => prev.map(o => o.id === id ? updated : o));
        return updated;
    }, []);

    const activateOrganization = useCallback(async (id: string) => {
        await updateOrganization(id, { isActive: true });
    }, [updateOrganization]);

    const deactivateOrganization = useCallback(async (id: string) => {
        await updateOrganization(id, { isActive: false });
    }, [updateOrganization]);

    return {
        stats,
        organizations,
        currentOrg,
        isLoading,
        error,
        getStats,
        getOrganizations,
        getOrganizationById,
        updateOrganization,
        activateOrganization,
        deactivateOrganization,
    };
}
