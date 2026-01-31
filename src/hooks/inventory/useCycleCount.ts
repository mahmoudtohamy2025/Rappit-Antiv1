/**
 * useCycleCount Hook
 * API hook for cycle count operations
 * 
 * Connects to: cycle-count.service.ts (114 tests)
 */

import { useState, useCallback } from 'react';

type CycleCountStatus = 'DRAFT' | 'IN_PROGRESS' | 'PENDING_APPROVAL' | 'COMPLETED' | 'CANCELLED';

interface CycleCount {
    id: string;
    name: string;
    warehouseId: string;
    warehouseName: string;
    status: CycleCountStatus;
    totalItems: number;
    countedItems: number;
    varianceItems: number;
    assigneeId?: string;
    assignee?: string;
    dueDate: string;
    createdAt: string;
    completedAt?: string;
}

interface CountItem {
    id: string;
    sku: string;
    productName: string;
    systemQty: number;
    countedQty: number | null;
    variance: number | null;
    counted: boolean;
    needsApproval: boolean;
}

interface CreateCycleCountDto {
    name: string;
    warehouseId: string;
    countType: 'all' | 'selected';
    selectedSkus?: string[];
    dueDate: string;
    assigneeId?: string;
}

interface RecordCountDto {
    itemId: string;
    countedQty: number;
}

interface UseCycleCountReturn {
    cycleCounts: CycleCount[];
    currentCount: CycleCount | null;
    items: CountItem[];
    isLoading: boolean;
    error: Error | null;
    fetchAll: () => Promise<void>;
    create: (data: CreateCycleCountDto) => Promise<CycleCount>;
    start: (id: string) => Promise<CycleCount>;
    getItems: (id: string) => Promise<CountItem[]>;
    recordCount: (cycleCountId: string, data: RecordCountDto) => Promise<CountItem>;
    complete: (id: string) => Promise<CycleCount>;
    approveVariance: (cycleCountId: string, itemId: string) => Promise<void>;
    approveAllVariances: (id: string) => Promise<void>;
    applyAdjustments: (id: string) => Promise<void>;
    cancel: (id: string) => Promise<void>;
}

const API_BASE = '/api/v1/inventory/cycle-counts';

export function useCycleCount(): UseCycleCountReturn {
    const [cycleCounts, setCycleCounts] = useState<CycleCount[]>([]);
    const [currentCount, setCurrentCount] = useState<CycleCount | null>(null);
    const [items, setItems] = useState<CountItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const fetchAll = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await fetch(API_BASE);
            if (!response.ok) throw new Error('Failed to fetch cycle counts');
            const data = await response.json();
            setCycleCounts(data.items || data);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Unknown error'));
        } finally {
            setIsLoading(false);
        }
    }, []);

    const create = useCallback(async (data: CreateCycleCountDto): Promise<CycleCount> => {
        const response = await fetch(API_BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        if (!response.ok) throw new Error('Failed to create cycle count');
        const cycleCount = await response.json();
        setCycleCounts(prev => [cycleCount, ...prev]);
        return cycleCount;
    }, []);

    const start = useCallback(async (id: string): Promise<CycleCount> => {
        const response = await fetch(`${API_BASE}/${id}/start`, { method: 'POST' });
        if (!response.ok) throw new Error('Failed to start cycle count');
        const cycleCount = await response.json();
        setCycleCounts(prev => prev.map(c => c.id === id ? cycleCount : c));
        setCurrentCount(cycleCount);
        return cycleCount;
    }, []);

    const getItems = useCallback(async (id: string): Promise<CountItem[]> => {
        const response = await fetch(`${API_BASE}/${id}/items`);
        if (!response.ok) throw new Error('Failed to fetch items');
        const data = await response.json();
        setItems(data);
        return data;
    }, []);

    const recordCount = useCallback(async (cycleCountId: string, data: RecordCountDto): Promise<CountItem> => {
        const response = await fetch(`${API_BASE}/${cycleCountId}/items/${data.itemId}/count`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ countedQty: data.countedQty }),
        });

        if (!response.ok) throw new Error('Failed to record count');
        const item = await response.json();
        setItems(prev => prev.map(i => i.id === data.itemId ? item : i));
        return item;
    }, []);

    const complete = useCallback(async (id: string): Promise<CycleCount> => {
        const response = await fetch(`${API_BASE}/${id}/complete`, { method: 'POST' });
        if (!response.ok) throw new Error('Failed to complete cycle count');
        const cycleCount = await response.json();
        setCycleCounts(prev => prev.map(c => c.id === id ? cycleCount : c));
        setCurrentCount(cycleCount);
        return cycleCount;
    }, []);

    const approveVariance = useCallback(async (cycleCountId: string, itemId: string) => {
        const response = await fetch(`${API_BASE}/${cycleCountId}/items/${itemId}/approve`, {
            method: 'POST',
        });
        if (!response.ok) throw new Error('Failed to approve variance');
        setItems(prev => prev.map(i => i.id === itemId ? { ...i, needsApproval: false } : i));
    }, []);

    const approveAllVariances = useCallback(async (id: string) => {
        const response = await fetch(`${API_BASE}/${id}/approve-all`, { method: 'POST' });
        if (!response.ok) throw new Error('Failed to approve all variances');
        setItems(prev => prev.map(i => ({ ...i, needsApproval: false })));
    }, []);

    const applyAdjustments = useCallback(async (id: string) => {
        const response = await fetch(`${API_BASE}/${id}/apply-adjustments`, { method: 'POST' });
        if (!response.ok) throw new Error('Failed to apply adjustments');
    }, []);

    const cancel = useCallback(async (id: string) => {
        const response = await fetch(`${API_BASE}/${id}/cancel`, { method: 'POST' });
        if (!response.ok) throw new Error('Failed to cancel cycle count');
        setCycleCounts(prev => prev.map(c => c.id === id ? { ...c, status: 'CANCELLED' as CycleCountStatus } : c));
    }, []);

    return {
        cycleCounts,
        currentCount,
        items,
        isLoading,
        error,
        fetchAll,
        create,
        start,
        getItems,
        recordCount,
        complete,
        approveVariance,
        approveAllVariances,
        applyAdjustments,
        cancel,
    };
}
