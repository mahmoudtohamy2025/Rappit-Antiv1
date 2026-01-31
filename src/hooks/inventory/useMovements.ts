/**
 * useMovements Hook
 * API hook for stock movements
 * 
 * Part of: GAP-03 Wire API Hooks
 */

import { useState, useCallback } from 'react';

// ============================================================
// TYPES
// ============================================================

export type MovementType = 'IN' | 'OUT' | 'ADJUSTMENT' | 'TRANSFER';

export interface Movement {
    id: string;
    type: MovementType;
    skuId: string;
    skuName?: string;
    warehouseId: string;
    warehouseName?: string;
    quantity: number;
    reason: string;
    reference?: string;
    userId: string;
    userName?: string;
    createdAt: string;
}

export interface MovementFilters {
    type?: MovementType;
    warehouseId?: string;
    skuId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
}

export interface CreateMovementDto {
    type: MovementType;
    skuId: string;
    warehouseId: string;
    quantity: number;
    reason: string;
    reference?: string;
}

interface PaginatedResponse {
    data: Movement[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
    };
}

interface UseMovementsReturn {
    movements: Movement[];
    meta: PaginatedResponse['meta'] | null;
    isLoading: boolean;
    error: Error | null;
    fetch: (filters?: MovementFilters) => Promise<void>;
    create: (dto: CreateMovementDto) => Promise<Movement>;
}

const API_BASE = '/api/v1/inventory';

export function useMovements(): UseMovementsReturn {
    const [movements, setMovements] = useState<Movement[]>([]);
    const [meta, setMeta] = useState<PaginatedResponse['meta'] | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const buildParams = (filters?: MovementFilters) => {
        const params = new URLSearchParams();
        if (filters) {
            if (filters.type) params.append('type', filters.type);
            if (filters.warehouseId) params.append('warehouseId', filters.warehouseId);
            if (filters.skuId) params.append('skuId', filters.skuId);
            if (filters.startDate) params.append('startDate', filters.startDate);
            if (filters.endDate) params.append('endDate', filters.endDate);
            if (filters.page) params.append('page', String(filters.page));
            if (filters.pageSize) params.append('pageSize', String(filters.pageSize));
        }
        return params.toString();
    };

    const fetch = useCallback(async (filters?: MovementFilters) => {
        setIsLoading(true);
        setError(null);

        try {
            const params = buildParams(filters);
            const response = await window.fetch(`${API_BASE}/movements?${params}`);

            if (!response.ok) {
                throw new Error('فشل تحميل الحركات');
            }

            const result: PaginatedResponse = await response.json();
            setMovements(result.data);
            setMeta(result.meta);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Unknown error'));
        } finally {
            setIsLoading(false);
        }
    }, []);

    const create = useCallback(async (dto: CreateMovementDto): Promise<Movement> => {
        const response = await window.fetch(`${API_BASE}/movements`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dto),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'فشل إنشاء الحركة');
        }

        const newMovement = await response.json();
        setMovements(prev => [newMovement, ...prev]);
        return newMovement;
    }, []);

    return {
        movements,
        meta,
        isLoading,
        error,
        fetch,
        create,
    };
}
