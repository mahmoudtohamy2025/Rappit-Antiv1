/**
 * useCycleCounts Hook
 * API hook for cycle count (physical inventory) management
 * 
 * Part of: GAP-03 Wire API Hooks
 */

import { useState, useCallback } from 'react';

// ============================================================
// TYPES
// ============================================================

export type CycleCountStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface CycleCountItem {
    skuId: string;
    skuName?: string;
    expectedQuantity: number;
    countedQuantity: number | null;
    variance?: number;
}

export interface CycleCount {
    id: string;
    warehouseId: string;
    warehouseName?: string;
    status: CycleCountStatus;
    items: CycleCountItem[];
    assignedTo?: string;
    assignedToName?: string;
    notes?: string;
    startedAt?: string;
    completedAt?: string;
    createdAt: string;
    updatedAt: string;
}

export interface CycleCountFilters {
    status?: CycleCountStatus;
    warehouseId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
}

export interface CreateCycleCountDto {
    warehouseId: string;
    skuIds?: string[];
    assignedTo?: string;
    notes?: string;
}

export interface SubmitCycleCountDto {
    items: Array<{
        skuId: string;
        countedQuantity: number;
    }>;
}

interface PaginatedResponse {
    data: CycleCount[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
    };
}

interface UseCycleCountsReturn {
    cycleCounts: CycleCount[];
    meta: PaginatedResponse['meta'] | null;
    isLoading: boolean;
    error: Error | null;
    fetch: (filters?: CycleCountFilters) => Promise<void>;
    create: (dto: CreateCycleCountDto) => Promise<CycleCount>;
    start: (id: string) => Promise<CycleCount>;
    submit: (id: string, dto: SubmitCycleCountDto) => Promise<CycleCount>;
    cancel: (id: string) => Promise<CycleCount>;
    getById: (id: string) => Promise<CycleCount>;
}

const API_BASE = '/api/v1/inventory';

export function useCycleCounts(): UseCycleCountsReturn {
    const [cycleCounts, setCycleCounts] = useState<CycleCount[]>([]);
    const [meta, setMeta] = useState<PaginatedResponse['meta'] | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const buildParams = (filters?: CycleCountFilters) => {
        const params = new URLSearchParams();
        if (filters) {
            if (filters.status) params.append('status', filters.status);
            if (filters.warehouseId) params.append('warehouseId', filters.warehouseId);
            if (filters.startDate) params.append('startDate', filters.startDate);
            if (filters.endDate) params.append('endDate', filters.endDate);
            if (filters.page) params.append('page', String(filters.page));
            if (filters.pageSize) params.append('pageSize', String(filters.pageSize));
        }
        return params.toString();
    };

    const fetch = useCallback(async (filters?: CycleCountFilters) => {
        setIsLoading(true);
        setError(null);

        try {
            const params = buildParams(filters);
            const response = await window.fetch(`${API_BASE}/cycle-counts?${params}`);

            if (!response.ok) {
                throw new Error('فشل تحميل الجرد');
            }

            const result: PaginatedResponse = await response.json();
            setCycleCounts(result.data);
            setMeta(result.meta);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Unknown error'));
        } finally {
            setIsLoading(false);
        }
    }, []);

    const create = useCallback(async (dto: CreateCycleCountDto): Promise<CycleCount> => {
        const response = await window.fetch(`${API_BASE}/cycle-counts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dto),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'فشل إنشاء الجرد');
        }

        const newCycleCount = await response.json();
        setCycleCounts(prev => [newCycleCount, ...prev]);
        return newCycleCount;
    }, []);

    const start = useCallback(async (id: string): Promise<CycleCount> => {
        const response = await window.fetch(`${API_BASE}/cycle-counts/${id}/start`, {
            method: 'POST',
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'فشل بدء الجرد');
        }

        const updated = await response.json();
        setCycleCounts(prev => prev.map(cc => cc.id === id ? updated : cc));
        return updated;
    }, []);

    const submit = useCallback(async (id: string, dto: SubmitCycleCountDto): Promise<CycleCount> => {
        const response = await window.fetch(`${API_BASE}/cycle-counts/${id}/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dto),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'فشل تقديم الجرد');
        }

        const updated = await response.json();
        setCycleCounts(prev => prev.map(cc => cc.id === id ? updated : cc));
        return updated;
    }, []);

    const cancel = useCallback(async (id: string): Promise<CycleCount> => {
        const response = await window.fetch(`${API_BASE}/cycle-counts/${id}/cancel`, {
            method: 'POST',
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'فشل إلغاء الجرد');
        }

        const updated = await response.json();
        setCycleCounts(prev => prev.map(cc => cc.id === id ? updated : cc));
        return updated;
    }, []);

    const getById = useCallback(async (id: string): Promise<CycleCount> => {
        const response = await window.fetch(`${API_BASE}/cycle-counts/${id}`);

        if (!response.ok) {
            throw new Error('الجرد غير موجود');
        }

        return response.json();
    }, []);

    return {
        cycleCounts,
        meta,
        isLoading,
        error,
        fetch,
        create,
        start,
        submit,
        cancel,
        getById,
    };
}
