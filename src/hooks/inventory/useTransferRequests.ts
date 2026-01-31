/**
 * useTransferRequests Hook
 * API hook for transfer request operations
 * 
 * Connects to: transfer-reservation.service.ts (89 tests)
 */

import { useState, useCallback } from 'react';

type TransferStatus = 'PENDING' | 'APPROVED' | 'IN_TRANSIT' | 'COMPLETED' | 'REJECTED' | 'CANCELLED';
type TransferPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
type TransferType = 'IMMEDIATE' | 'PENDING' | 'SCHEDULED';

interface TransferRequest {
    id: string;
    sourceWarehouseId: string;
    sourceWarehouse: string;
    targetWarehouseId: string;
    targetWarehouse: string;
    sku: string;
    productName: string;
    quantity: number;
    status: TransferStatus;
    priority: TransferPriority;
    transferType: TransferType;
    reason?: string;
    scheduledDate?: string;
    requestedBy: string;
    requestedAt: string;
    approvedBy?: string;
    approvedAt?: string;
    completedAt?: string;
}

interface CreateTransferDto {
    sourceWarehouseId: string;
    targetWarehouseId: string;
    items: Array<{ sku: string; quantity: number }>;
    transferType: TransferType;
    priority: TransferPriority;
    scheduledDate?: string;
    reason?: string;
}

interface TransferFilters {
    status?: TransferStatus;
    priority?: TransferPriority;
    sourceWarehouseId?: string;
    targetWarehouseId?: string;
    page?: number;
    limit?: number;
}

interface UseTransferRequestsReturn {
    transfers: TransferRequest[];
    pendingApprovals: TransferRequest[];
    isLoading: boolean;
    error: Error | null;
    fetch: (filters?: TransferFilters) => Promise<void>;
    fetchPendingApprovals: () => Promise<void>;
    create: (data: CreateTransferDto) => Promise<TransferRequest[]>;
    approve: (id: string) => Promise<TransferRequest>;
    reject: (id: string, reason?: string) => Promise<TransferRequest>;
    cancel: (id: string) => Promise<TransferRequest>;
    complete: (id: string) => Promise<TransferRequest>;
    getById: (id: string) => Promise<TransferRequest>;
}

const API_BASE = '/api/v1/inventory/transfers';

export function useTransferRequests(): UseTransferRequestsReturn {
    const [transfers, setTransfers] = useState<TransferRequest[]>([]);
    const [pendingApprovals, setPendingApprovals] = useState<TransferRequest[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const fetch = useCallback(async (filters?: TransferFilters) => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams();
            if (filters) {
                Object.entries(filters).forEach(([key, value]) => {
                    if (value !== undefined) params.append(key, String(value));
                });
            }

            const response = await window.fetch(`${API_BASE}?${params.toString()}`);
            if (!response.ok) throw new Error('Failed to fetch transfers');
            const data = await response.json();
            setTransfers(data.items || data);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Unknown error'));
        } finally {
            setIsLoading(false);
        }
    }, []);

    const fetchPendingApprovals = useCallback(async () => {
        const response = await window.fetch(`${API_BASE}?status=PENDING`);
        if (!response.ok) throw new Error('Failed to fetch pending approvals');
        const data = await response.json();
        setPendingApprovals(data.items || data);
    }, []);

    const create = useCallback(async (data: CreateTransferDto): Promise<TransferRequest[]> => {
        const response = await window.fetch(API_BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to create transfer');
        }

        const newTransfers = await response.json();
        setTransfers(prev => [...newTransfers, ...prev]);
        return newTransfers;
    }, []);

    const approve = useCallback(async (id: string): Promise<TransferRequest> => {
        const response = await window.fetch(`${API_BASE}/${id}/approve`, { method: 'POST' });
        if (!response.ok) throw new Error('Failed to approve transfer');
        const transfer = await response.json();
        setTransfers(prev => prev.map(t => t.id === id ? transfer : t));
        setPendingApprovals(prev => prev.filter(t => t.id !== id));
        return transfer;
    }, []);

    const reject = useCallback(async (id: string, reason?: string): Promise<TransferRequest> => {
        const response = await window.fetch(`${API_BASE}/${id}/reject`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason }),
        });
        if (!response.ok) throw new Error('Failed to reject transfer');
        const transfer = await response.json();
        setTransfers(prev => prev.map(t => t.id === id ? transfer : t));
        setPendingApprovals(prev => prev.filter(t => t.id !== id));
        return transfer;
    }, []);

    const cancel = useCallback(async (id: string): Promise<TransferRequest> => {
        const response = await window.fetch(`${API_BASE}/${id}/cancel`, { method: 'POST' });
        if (!response.ok) throw new Error('Failed to cancel transfer');
        const transfer = await response.json();
        setTransfers(prev => prev.map(t => t.id === id ? transfer : t));
        return transfer;
    }, []);

    const complete = useCallback(async (id: string): Promise<TransferRequest> => {
        const response = await window.fetch(`${API_BASE}/${id}/complete`, { method: 'POST' });
        if (!response.ok) throw new Error('Failed to complete transfer');
        const transfer = await response.json();
        setTransfers(prev => prev.map(t => t.id === id ? transfer : t));
        return transfer;
    }, []);

    const getById = useCallback(async (id: string): Promise<TransferRequest> => {
        const response = await window.fetch(`${API_BASE}/${id}`);
        if (!response.ok) throw new Error('Transfer not found');
        return response.json();
    }, []);

    return {
        transfers,
        pendingApprovals,
        isLoading,
        error,
        fetch,
        fetchPendingApprovals,
        create,
        approve,
        reject,
        cancel,
        complete,
        getById,
    };
}
