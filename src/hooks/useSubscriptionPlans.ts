/**
 * useSubscriptionPlans Hook
 * API hook for subscription plan management
 * 
 * Part of: GAP-15 Subscription Tiers
 */

import { useState, useCallback } from 'react';

// ============================================================
// TYPES
// ============================================================

export type SupportLevel = 'basic' | 'priority' | 'dedicated';

export interface PlanFeatures {
    maxUsers: number;
    maxWarehouses: number;
    maxSkus: number;
    maxOrdersPerMonth: number;
    integrations: string[];
    apiAccess: boolean;
    supportLevel: SupportLevel;
}

export interface SubscriptionPlan {
    id: string;
    name: string;
    nameAr: string;
    description?: string;
    descriptionAr?: string;
    priceMonthly: number;
    priceYearly: number;
    currency: string;
    features: PlanFeatures;
    stripePriceIdMonthly?: string;
    stripePriceIdYearly?: string;
    isActive: boolean;
    isPopular?: boolean;
    sortOrder: number;
    createdAt?: string;
    updatedAt?: string;
}

export interface CreatePlanDto {
    name: string;
    nameAr: string;
    description?: string;
    descriptionAr?: string;
    priceMonthly: number;
    priceYearly: number;
    currency?: string;
    features: PlanFeatures;
    isActive?: boolean;
    isPopular?: boolean;
    sortOrder?: number;
}

interface UseSubscriptionPlansReturn {
    plans: SubscriptionPlan[];
    isLoading: boolean;
    error: Error | null;
    getPlans: (activeOnly?: boolean) => Promise<void>;
    getPublicPlans: () => Promise<SubscriptionPlan[]>;
    createPlan: (dto: CreatePlanDto) => Promise<SubscriptionPlan>;
    updatePlan: (id: string, dto: Partial<CreatePlanDto>) => Promise<SubscriptionPlan>;
    deletePlan: (id: string) => Promise<void>;
    syncWithStripe: () => Promise<void>;
}

const API_BASE = '/api/v1/admin/plans';

// ============================================================
// HOOK
// ============================================================

export function useSubscriptionPlans(): UseSubscriptionPlansReturn {
    const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const getPlans = useCallback(async (activeOnly = false) => {
        setIsLoading(true);
        setError(null);

        try {
            const params = activeOnly ? '?active=true' : '';
            const response = await fetch(`${API_BASE}${params}`);
            if (!response.ok) throw new Error('فشل تحميل الخطط');
            const data = await response.json();
            setPlans(data.data || data);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Unknown error'));
        } finally {
            setIsLoading(false);
        }
    }, []);

    const getPublicPlans = useCallback(async (): Promise<SubscriptionPlan[]> => {
        const response = await fetch('/api/v1/plans');
        if (!response.ok) throw new Error('فشل تحميل الخطط');
        const data = await response.json();
        return data.data || data;
    }, []);

    const createPlan = useCallback(async (dto: CreatePlanDto): Promise<SubscriptionPlan> => {
        const response = await fetch(API_BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...dto, currency: dto.currency || 'SAR' }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'فشل إنشاء الخطة');
        }

        const plan = await response.json();
        setPlans(prev => [...prev, plan].sort((a, b) => a.sortOrder - b.sortOrder));
        return plan;
    }, []);

    const updatePlan = useCallback(async (
        id: string,
        dto: Partial<CreatePlanDto>
    ): Promise<SubscriptionPlan> => {
        const response = await fetch(`${API_BASE}/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dto),
        });

        if (!response.ok) throw new Error('فشل تحديث الخطة');

        const plan = await response.json();
        setPlans(prev => prev.map(p => p.id === id ? plan : p));
        return plan;
    }, []);

    const deletePlan = useCallback(async (id: string) => {
        const response = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('فشل حذف الخطة');
        setPlans(prev => prev.filter(p => p.id !== id));
    }, []);

    const syncWithStripe = useCallback(async () => {
        const response = await fetch(`${API_BASE}/sync-stripe`, { method: 'POST' });
        if (!response.ok) throw new Error('فشل المزامنة مع Stripe');
        await getPlans();
    }, [getPlans]);

    return {
        plans,
        isLoading,
        error,
        getPlans,
        getPublicPlans,
        createPlan,
        updatePlan,
        deletePlan,
        syncWithStripe,
    };
}
