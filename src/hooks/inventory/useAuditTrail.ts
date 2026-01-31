/**
 * useAuditTrail Hook
 * API hook for audit trail operations
 * 
 * Connects to: inventory-audit.service.ts (90 tests)
 */

import { useState, useCallback } from 'react';

type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'ADJUSTMENT' | 'IMPORT' | 'CYCLE_COUNT' | 'FORCE_RELEASE' | 'TRANSFER';

interface AuditEntry {
    id: string;
    action: AuditAction;
    sku: string;
    productName: string;
    previousQty: number;
    newQty: number;
    variance: number;
    warehouseId: string;
    warehouseName: string;
    userId: string;
    userName: string;
    notes: string;
    referenceType?: string;
    referenceId?: string;
    createdAt: string;
}

interface AuditFilters {
    action?: AuditAction;
    sku?: string;
    warehouseId?: string;
    userId?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
}

interface AuditStats {
    totalChanges: number;
    netVariance: number;
    positiveChanges: number;
    negativeChanges: number;
}

interface UseAuditTrailReturn {
    entries: AuditEntry[];
    stats: AuditStats;
    isLoading: boolean;
    error: Error | null;
    fetch: (filters?: AuditFilters) => Promise<void>;
    getStats: (filters?: AuditFilters) => Promise<AuditStats>;
    getById: (id: string) => Promise<AuditEntry>;
    exportCsv: (filters?: AuditFilters) => Promise<void>;
    exportJson: (filters?: AuditFilters) => Promise<void>;
}

const API_BASE = '/api/v1/inventory/audit';

export function useAuditTrail(): UseAuditTrailReturn {
    const [entries, setEntries] = useState<AuditEntry[]>([]);
    const [stats, setStats] = useState<AuditStats>({
        totalChanges: 0,
        netVariance: 0,
        positiveChanges: 0,
        negativeChanges: 0,
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const buildParams = (filters?: AuditFilters) => {
        const params = new URLSearchParams();
        if (filters) {
            Object.entries(filters).forEach(([key, value]) => {
                if (value !== undefined) params.append(key, String(value));
            });
        }
        return params.toString();
    };

    const fetch = useCallback(async (filters?: AuditFilters) => {
        setIsLoading(true);
        try {
            const params = buildParams(filters);
            const response = await window.fetch(`${API_BASE}?${params}`);
            if (!response.ok) throw new Error('Failed to fetch audit entries');
            const data = await response.json();
            setEntries(data.items || data);
            if (data.stats) setStats(data.stats);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Unknown error'));
        } finally {
            setIsLoading(false);
        }
    }, []);

    const getStats = useCallback(async (filters?: AuditFilters): Promise<AuditStats> => {
        const params = buildParams(filters);
        const response = await window.fetch(`${API_BASE}/stats?${params}`);
        if (!response.ok) throw new Error('Failed to fetch audit stats');
        const data = await response.json();
        setStats(data);
        return data;
    }, []);

    const getById = useCallback(async (id: string): Promise<AuditEntry> => {
        const response = await window.fetch(`${API_BASE}/${id}`);
        if (!response.ok) throw new Error('Audit entry not found');
        return response.json();
    }, []);

    const exportCsv = useCallback(async (filters?: AuditFilters) => {
        const params = buildParams(filters);
        const response = await window.fetch(`${API_BASE}/export/csv?${params}`);
        if (!response.ok) throw new Error('Export failed');

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `audit_trail_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, []);

    const exportJson = useCallback(async (filters?: AuditFilters) => {
        const params = buildParams(filters);
        const response = await window.fetch(`${API_BASE}/export/json?${params}`);
        if (!response.ok) throw new Error('Export failed');

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `audit_trail_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, []);

    return {
        entries,
        stats,
        isLoading,
        error,
        fetch,
        getStats,
        getById,
        exportCsv,
        exportJson,
    };
}
