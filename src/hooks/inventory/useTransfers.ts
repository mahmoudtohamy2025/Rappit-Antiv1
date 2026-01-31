/**
 * useTransfers Hook
 * API hook for inventory transfers between warehouses
 * 
 * Part of: GAP-03 Wire API Hooks
 */

import { useState, useCallback } from 'react';

// ============================================================
// TYPES
// ============================================================

export type TransferStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED';

export interface TransferItem {
    skuId: string;
    skuName?: string;
    quantity: number;
}

export interface Transfer {
    id: string;
    fromWarehouseId: string;
    fromWarehouseName?: string;
    toWarehouseId: string;
    toWarehouseName?: string;
    status: TransferStatus;
    items: TransferItem[];
    notes?: string;
    requestedBy: string;
    requestedByName?: string;
    approvedBy?: string;
    approvedByName?: string;
    rejectionReason?: string;
    createdAt: string;
    updatedAt: string;
}

export interface TransferFilters {
    status?: TransferStatus;
    fromWarehouseId?: string;
    toWarehouseId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
}

export interface CreateTransferDto {
    fromWarehouseId: string;
    toWarehouseId: string;
    items: TransferItem[];
    notes?: string;
}

interface PaginatedResponse {
    data: Transfer[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
        pendingCount: number;
    };
}

interface UseTransfersReturn {
    transfers: Transfer[];
    meta: PaginatedResponse['meta'] | null;
    pendingCount: number;
    isLoading: boolean;
    error: Error | null;
    fetch: (filters?: TransferFilters) => Promise<void>;
    create: (dto: CreateTransferDto) => Promise<Transfer>;
    approve: (id: string) => Promise<Transfer>;
    reject: (id: string, reason: string) => Promise<Transfer>;
    cancel: (id: string) => Promise<Transfer>;
}

const API_BASE = '/api/v1/inventory';

export function useTransfers(): UseTransfersReturn {
    const [transfers, setTransfers] = useState<Transfer[]>([]);
    const [meta, setMeta] = useState<PaginatedResponse['meta'] | null>(null);
    const [pendingCount, setPendingCount] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const buildParams = (filters?: TransferFilters) => {
        const params = new URLSearchParams();
        if (filters) {
            if (filters.status) params.append('status', filters.status);
            if (filters.fromWarehouseId) params.append('fromWarehouseId', filters.fromWarehouseId);
            if (filters.toWarehouseId) params.append('toWarehouseId', filters.toWarehouseId);
            if (filters.startDate) params.append('startDate', filters.startDate);
            if (filters.endDate) params.append('endDate', filters.endDate);
            if (filters.page) params.append('page', String(filters.page));
            if (filters.pageSize) params.append('pageSize', String(filters.pageSize));
        }
        return params.toString();
    };

    const fetch = useCallback(async (filters?: TransferFilters) => {
        setIsLoading(true);
        setError(null);

        try {
            const params = buildParams(filters);
            const response = await window.fetch(`${API_BASE}/transfers?${params}`);

            if (!response.ok) {
                throw new Error('فشل تحميل التحويلات');
            }

            const result: PaginatedResponse = await response.json();
            setTransfers(result.data);
            setMeta(result.meta);
            setPendingCount(result.meta.pendingCount || 0);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Unknown error'));
        } finally {
            setIsLoading(false);
        }
    }, []);

    const create = useCallback(async (dto: CreateTransferDto): Promise<Transfer> => {
        const response = await window.fetch(`${API_BASE}/transfers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dto),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'فشل إنشاء التحويل');
        }

        const newTransfer = await response.json();
        setTransfers(prev => [newTransfer, ...prev]);
        setPendingCount(prev => prev + 1);
        return newTransfer;
    }, []);

    const approve = useCallback(async (id: string): Promise<Transfer> => {
        const response = await window.fetch(`${API_BASE}/transfers/${id}/approve`, {
            method: 'POST',
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'فشل الموافقة على التحويل');
        }

        const updated = await response.json();
        setTransfers(prev => prev.map(t => t.id === id ? updated : t));
        setPendingCount(prev => Math.max(0, prev - 1));
        return updated;
    }, []);

    const reject = useCallback(async (id: string, reason: string): Promise<Transfer> => {
        const response = await window.fetch(`${API_BASE}/transfers/${id}/reject`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'فشل رفض التحويل');
        }

        const updated = await response.json();
        setTransfers(prev => prev.map(t => t.id === id ? updated : t));
        setPendingCount(prev => Math.max(0, prev - 1));
        return updated;
    }, []);

    const cancel = useCallback(async (id: string): Promise<Transfer> => {
        const response = await window.fetch(`${API_BASE}/transfers/${id}/cancel`, {
            method: 'POST',
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'فشل إلغاء التحويل');
        }

        const updated = await response.json();
        setTransfers(prev => prev.map(t => t.id === id ? updated : t));
        return updated;
    }, []);

    return {
        transfers,
        meta,
        pendingCount,
        isLoading,
        error,
        fetch,
        create,
        approve,
        reject,
        cancel,
    };
}
