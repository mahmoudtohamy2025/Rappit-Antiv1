/**
 * useOrderSync Hook
 * API hook for order synchronization management
 * 
 * Part of: GAP-19 Order Sync UI
 */

import { useState, useCallback, useEffect, useRef } from 'react';

// ============================================================
// TYPES
// ============================================================

export type SyncStatus = 'IDLE' | 'SYNCING' | 'SYNCED' | 'ERROR';

export interface ChannelSyncStatus {
    channelId: string;
    channelName: string;
    platform: string;
    status: SyncStatus;
    lastSyncAt?: string;
    ordersImported: number;
    pendingOrders: number;
    errorCount: number;
}

export interface SyncHistoryItem {
    id: string;
    channelId: string;
    channelName: string;
    startedAt: string;
    completedAt?: string;
    ordersImported: number;
    ordersFailed: number;
    status: 'RUNNING' | 'SUCCESS' | 'PARTIAL' | 'FAILED';
    duration?: number;
}

export interface SyncError {
    id: string;
    channelId: string;
    orderId?: string;
    orderNumber?: string;
    message: string;
    details?: string;
    createdAt: string;
    resolved: boolean;
    resolvedAt?: string;
}

interface UseOrderSyncReturn {
    channelStatuses: ChannelSyncStatus[];
    syncHistory: SyncHistoryItem[];
    syncErrors: SyncError[];
    isLoading: boolean;
    error: Error | null;
    getChannelStatuses: () => Promise<void>;
    getSyncHistory: (channelId?: string) => Promise<void>;
    getSyncErrors: (channelId?: string) => Promise<void>;
    triggerSync: (channelId: string) => Promise<void>;
    triggerSyncAll: () => Promise<void>;
    resolveError: (errorId: string) => Promise<void>;
    resolveAllErrors: (channelId: string) => Promise<void>;
}

const API_BASE = '/api/v1/sync';

// ============================================================
// HOOK
// ============================================================

export function useOrderSync(autoRefresh = false, refreshInterval = 30000): UseOrderSyncReturn {
    const [channelStatuses, setChannelStatuses] = useState<ChannelSyncStatus[]>([]);
    const [syncHistory, setSyncHistory] = useState<SyncHistoryItem[]>([]);
    const [syncErrors, setSyncErrors] = useState<SyncError[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    const getChannelStatuses = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(`${API_BASE}/status`);
            if (!response.ok) throw new Error('فشل تحميل حالة المزامنة');
            const data = await response.json();
            setChannelStatuses(data.data || data);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Unknown error'));
        } finally {
            setIsLoading(false);
        }
    }, []);

    const getSyncHistory = useCallback(async (channelId?: string) => {
        try {
            const params = channelId ? `?channelId=${channelId}` : '';
            const response = await fetch(`${API_BASE}/history${params}`);
            if (!response.ok) throw new Error('فشل تحميل سجل المزامنة');
            const data = await response.json();
            setSyncHistory(data.data || data);
        } catch (err) {
            console.error('Failed to load sync history:', err);
        }
    }, []);

    const getSyncErrors = useCallback(async (channelId?: string) => {
        try {
            const params = channelId ? `?channelId=${channelId}` : '';
            const response = await fetch(`${API_BASE}/errors${params}`);
            if (!response.ok) throw new Error('فشل تحميل أخطاء المزامنة');
            const data = await response.json();
            setSyncErrors(data.data || data);
        } catch (err) {
            console.error('Failed to load sync errors:', err);
        }
    }, []);

    const triggerSync = useCallback(async (channelId: string) => {
        // Update status to syncing
        setChannelStatuses(prev => prev.map(c =>
            c.channelId === channelId ? { ...c, status: 'SYNCING' as SyncStatus } : c
        ));

        const response = await fetch(`${API_BASE}/trigger/${channelId}`, { method: 'POST' });
        if (!response.ok) throw new Error('فشل بدء المزامنة');

        // Refresh status after a delay
        setTimeout(() => getChannelStatuses(), 2000);
    }, [getChannelStatuses]);

    const triggerSyncAll = useCallback(async () => {
        setChannelStatuses(prev => prev.map(c => ({ ...c, status: 'SYNCING' as SyncStatus })));

        const response = await fetch(`${API_BASE}/trigger-all`, { method: 'POST' });
        if (!response.ok) throw new Error('فشل بدء المزامنة');

        setTimeout(() => getChannelStatuses(), 5000);
    }, [getChannelStatuses]);

    const resolveError = useCallback(async (errorId: string) => {
        const response = await fetch(`${API_BASE}/errors/${errorId}/resolve`, { method: 'POST' });
        if (!response.ok) throw new Error('فشل حل الخطأ');
        setSyncErrors(prev => prev.map(e =>
            e.id === errorId ? { ...e, resolved: true, resolvedAt: new Date().toISOString() } : e
        ));
    }, []);

    const resolveAllErrors = useCallback(async (channelId: string) => {
        const response = await fetch(`${API_BASE}/errors/resolve-all?channelId=${channelId}`, { method: 'POST' });
        if (!response.ok) throw new Error('فشل حل الأخطاء');
        setSyncErrors(prev => prev.map(e =>
            e.channelId === channelId ? { ...e, resolved: true, resolvedAt: new Date().toISOString() } : e
        ));
    }, []);

    // Auto-refresh
    useEffect(() => {
        if (autoRefresh) {
            intervalRef.current = setInterval(() => {
                getChannelStatuses();
            }, refreshInterval);

            return () => {
                if (intervalRef.current) clearInterval(intervalRef.current);
            };
        }
    }, [autoRefresh, refreshInterval, getChannelStatuses]);

    return {
        channelStatuses,
        syncHistory,
        syncErrors,
        isLoading,
        error,
        getChannelStatuses,
        getSyncHistory,
        getSyncErrors,
        triggerSync,
        triggerSyncAll,
        resolveError,
        resolveAllErrors,
    };
}
