/**
 * useStockMovements Hook
 * API hook for stock movement operations
 * 
 * Connects to: stock-movement.service.ts (84 tests)
 */

import { useState, useCallback, useEffect } from 'react';

type MovementType = 'RECEIVE' | 'SHIP' | 'RETURN' | 'TRANSFER_OUT' | 'TRANSFER_IN' | 'ADJUSTMENT_ADD' | 'ADJUSTMENT_REMOVE' | 'DAMAGE';
type MovementStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED';

interface Movement {
    id: string;
    type: MovementType;
    sku: string;
    productName: string;
    quantity: number;
    warehouseId: string;
    warehouseName: string;
    status: MovementStatus;
    reason: string;
    referenceType?: string;
    referenceId?: string;
    createdBy: string;
    createdAt: string;
    executedAt?: string;
    executedBy?: string;
}

interface CreateMovementDto {
    type: MovementType;
    sku: string;
    warehouseId: string;
    quantity: number;
    reason: string;
    referenceType?: string;
    referenceId?: string;
}

interface MovementFilters {
    type?: MovementType;
    status?: MovementStatus;
    warehouseId?: string;
    sku?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
}

interface MovementStats {
    total: number;
    pending: number;
    completedToday: number;
    cancelled: number;
}

interface UseStockMovementsReturn {
    movements: Movement[];
    stats: MovementStats;
    isLoading: boolean;
    error: Error | null;
    fetch: (filters?: MovementFilters) => Promise<void>;
    create: (data: CreateMovementDto) => Promise<Movement>;
    execute: (id: string) => Promise<Movement>;
    cancel: (id: string) => Promise<Movement>;
    getById: (id: string) => Promise<Movement>;
}

const API_BASE = '/api/v1/inventory/movements';

export function useStockMovements(): UseStockMovementsReturn {
    const [movements, setMovements] = useState<Movement[]>([]);
    const [stats, setStats] = useState<MovementStats>({
        total: 0,
        pending: 0,
        completedToday: 0,
        cancelled: 0,
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const fetch = useCallback(async (filters?: MovementFilters) => {
        setIsLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams();
            if (filters) {
                Object.entries(filters).forEach(([key, value]) => {
                    if (value !== undefined) params.append(key, String(value));
                });
            }

            const response = await window.fetch(`${API_BASE}?${params.toString()}`);
            if (!response.ok) throw new Error('Failed to fetch movements');

            const data = await response.json();
            setMovements(data.items || data);

            if (data.stats) {
                setStats(data.stats);
            }
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Unknown error'));
        } finally {
            setIsLoading(false);
        }
    }, []);

    const create = useCallback(async (data: CreateMovementDto): Promise<Movement> => {
        const response = await window.fetch(API_BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to create movement');
        }

        const movement = await response.json();
        setMovements(prev => [movement, ...prev]);
        return movement;
    }, []);

    const execute = useCallback(async (id: string): Promise<Movement> => {
        const response = await window.fetch(`${API_BASE}/${id}/execute`, {
            method: 'POST',
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to execute movement');
        }

        const movement = await response.json();
        setMovements(prev => prev.map(m => m.id === id ? movement : m));
        return movement;
    }, []);

    const cancel = useCallback(async (id: string): Promise<Movement> => {
        const response = await window.fetch(`${API_BASE}/${id}/cancel`, {
            method: 'POST',
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to cancel movement');
        }

        const movement = await response.json();
        setMovements(prev => prev.map(m => m.id === id ? movement : m));
        return movement;
    }, []);

    const getById = useCallback(async (id: string): Promise<Movement> => {
        const response = await window.fetch(`${API_BASE}/${id}`);
        if (!response.ok) throw new Error('Movement not found');
        return response.json();
    }, []);

    return {
        movements,
        stats,
        isLoading,
        error,
        fetch,
        create,
        execute,
        cancel,
        getById,
    };
}
