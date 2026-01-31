/**
 * useWarehouses Hook
 * API hook for warehouse management
 * 
 * Part of: GAP-01 Warehouse CRUD
 */

import { useState, useCallback, useEffect } from 'react';

interface Address {
    street?: string;
    city?: string;
    country?: string;
    postalCode?: string;
}

interface WarehouseStats {
    totalItems: number;
    totalQuantity: number;
    reservedQuantity: number;
    damagedQuantity: number;
    lowStockItems: number;
}

export interface Warehouse {
    id: string;
    name: string;
    code: string;
    address: Address | null;
    capacity: number | null;
    contactName: string | null;
    contactPhone: string | null;
    contactEmail: string | null;
    isActive: boolean;
    isDefault: boolean;
    organizationId: string;
    stats?: WarehouseStats;
    createdAt: string;
    updatedAt: string;
}

export interface CreateWarehouseDto {
    name: string;
    code?: string;
    address?: Address;
    capacity?: number;
    contactName?: string;
    contactPhone?: string;
    contactEmail?: string;
    isActive?: boolean;
}

export interface UpdateWarehouseDto {
    name?: string;
    code?: string;
    address?: Address;
    capacity?: number;
    contactName?: string;
    contactPhone?: string;
    contactEmail?: string;
    isActive?: boolean;
}

interface WarehouseFilters {
    search?: string;
    isActive?: boolean;
    page?: number;
    pageSize?: number;
}

interface PaginatedResponse {
    data: Warehouse[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
    };
}

interface UseWarehousesReturn {
    warehouses: Warehouse[];
    meta: PaginatedResponse['meta'] | null;
    isLoading: boolean;
    error: Error | null;
    fetch: (filters?: WarehouseFilters) => Promise<void>;
    create: (dto: CreateWarehouseDto) => Promise<Warehouse>;
    update: (id: string, dto: UpdateWarehouseDto) => Promise<Warehouse>;
    remove: (id: string) => Promise<void>;
    setDefault: (id: string) => Promise<Warehouse>;
    getById: (id: string, includeStats?: boolean) => Promise<Warehouse>;
    getStats: (id: string) => Promise<WarehouseStats>;
    getDefaultWarehouse: () => Promise<Warehouse | null>;
}

const API_BASE = '/api/v1/warehouses';

export function useWarehouses(): UseWarehousesReturn {
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [meta, setMeta] = useState<PaginatedResponse['meta'] | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const buildParams = (filters?: WarehouseFilters) => {
        const params = new URLSearchParams();
        if (filters) {
            if (filters.search) params.append('search', filters.search);
            if (filters.isActive !== undefined) params.append('isActive', String(filters.isActive));
            if (filters.page) params.append('page', String(filters.page));
            if (filters.pageSize) params.append('pageSize', String(filters.pageSize));
        }
        return params.toString();
    };

    const fetch = useCallback(async (filters?: WarehouseFilters) => {
        setIsLoading(true);
        setError(null);

        try {
            const params = buildParams(filters);
            const response = await window.fetch(`${API_BASE}?${params}`);

            if (!response.ok) {
                throw new Error('Failed to fetch warehouses');
            }

            const result: PaginatedResponse = await response.json();
            setWarehouses(result.data);
            setMeta(result.meta);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Unknown error'));
        } finally {
            setIsLoading(false);
        }
    }, []);

    const create = useCallback(async (dto: CreateWarehouseDto): Promise<Warehouse> => {
        const response = await window.fetch(API_BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dto),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to create warehouse');
        }

        const newWarehouse = await response.json();
        setWarehouses(prev => [newWarehouse, ...prev]);
        return newWarehouse;
    }, []);

    const update = useCallback(async (id: string, dto: UpdateWarehouseDto): Promise<Warehouse> => {
        const response = await window.fetch(`${API_BASE}/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dto),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to update warehouse');
        }

        const updated = await response.json();
        setWarehouses(prev => prev.map(w => w.id === id ? updated : w));
        return updated;
    }, []);

    const remove = useCallback(async (id: string): Promise<void> => {
        const response = await window.fetch(`${API_BASE}/${id}`, {
            method: 'DELETE',
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to delete warehouse');
        }

        setWarehouses(prev => prev.filter(w => w.id !== id));
    }, []);

    const setDefault = useCallback(async (id: string): Promise<Warehouse> => {
        const response = await window.fetch(`${API_BASE}/${id}/set-default`, {
            method: 'POST',
        });

        if (!response.ok) {
            throw new Error('Failed to set default warehouse');
        }

        const updated = await response.json();
        setWarehouses(prev => prev.map(w => ({
            ...w,
            isDefault: w.id === id,
        })));
        return updated;
    }, []);

    const getById = useCallback(async (id: string, includeStats = false): Promise<Warehouse> => {
        const params = includeStats ? '?includeStats=true' : '';
        const response = await window.fetch(`${API_BASE}/${id}${params}`);

        if (!response.ok) {
            throw new Error('Warehouse not found');
        }

        return response.json();
    }, []);

    const getStats = useCallback(async (id: string): Promise<WarehouseStats> => {
        const response = await window.fetch(`${API_BASE}/${id}/stats`);

        if (!response.ok) {
            throw new Error('Failed to get warehouse stats');
        }

        return response.json();
    }, []);

    const getDefaultWarehouse = useCallback(async (): Promise<Warehouse | null> => {
        const response = await window.fetch(`${API_BASE}/default`);

        if (!response.ok) {
            return null;
        }

        return response.json();
    }, []);

    return {
        warehouses,
        meta,
        isLoading,
        error,
        fetch,
        create,
        update,
        remove,
        setDefault,
        getById,
        getStats,
        getDefaultWarehouse,
    };
}
