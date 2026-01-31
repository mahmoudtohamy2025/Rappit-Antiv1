/**
 * useExport Hook
 * API hook for data export operations
 * 
 * Part of: GAP-04 Export Functionality
 */

import { useState, useCallback } from 'react';

// ============================================================
// TYPES
// ============================================================

export type ExportFormat = 'csv' | 'json';
export type ExportType = 'inventory' | 'movements' | 'cycle-count' | 'audit' | 'orders';

export interface ExportOptions {
    format?: ExportFormat;
    warehouseId?: string;
    startDate?: string;
    endDate?: string;
    type?: string;
    status?: string;
    cycleCountId?: string;
}

interface UseExportReturn {
    isExporting: boolean;
    error: Error | null;
    exportInventory: (options?: ExportOptions) => Promise<void>;
    exportMovements: (options?: ExportOptions) => Promise<void>;
    exportCycleCount: (cycleCountId: string, format?: ExportFormat) => Promise<void>;
    exportAudit: (options?: ExportOptions) => Promise<void>;
    exportOrders: (options?: ExportOptions) => Promise<void>;
}

const API_BASE = '/api/v1';

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function buildQueryParams(options?: ExportOptions): string {
    if (!options) return '';
    const params = new URLSearchParams();
    if (options.format) params.append('format', options.format);
    if (options.warehouseId) params.append('warehouseId', options.warehouseId);
    if (options.startDate) params.append('startDate', options.startDate);
    if (options.endDate) params.append('endDate', options.endDate);
    if (options.type) params.append('type', options.type);
    if (options.status) params.append('status', options.status);
    return params.toString();
}

function generateFilename(type: ExportType, format: ExportFormat = 'csv'): string {
    const date = new Date().toISOString().split('T')[0];
    return `${type}_${date}.${format}`;
}

function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// ============================================================
// HOOK
// ============================================================

export function useExport(): UseExportReturn {
    const [isExporting, setIsExporting] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const exportData = useCallback(async (
        endpoint: string,
        filename: string,
        options?: ExportOptions
    ) => {
        setIsExporting(true);
        setError(null);

        try {
            const params = buildQueryParams(options);
            const url = `${endpoint}${params ? `?${params}` : ''}`;

            const response = await fetch(url);

            if (!response.ok) {
                throw new Error('فشل التصدير');
            }

            const blob = await response.blob();
            downloadBlob(blob, filename);
        } catch (err) {
            const exportError = err instanceof Error ? err : new Error('Unknown error');
            setError(exportError);
            throw exportError;
        } finally {
            setIsExporting(false);
        }
    }, []);

    const exportInventory = useCallback(async (options?: ExportOptions) => {
        const format = options?.format || 'csv';
        const filename = generateFilename('inventory', format);
        await exportData(`${API_BASE}/inventory/export`, filename, options);
    }, [exportData]);

    const exportMovements = useCallback(async (options?: ExportOptions) => {
        const format = options?.format || 'csv';
        const filename = generateFilename('movements', format);
        await exportData(`${API_BASE}/inventory/movements/export`, filename, options);
    }, [exportData]);

    const exportCycleCount = useCallback(async (cycleCountId: string, format: ExportFormat = 'csv') => {
        const filename = `cycle_count_${cycleCountId}_${new Date().toISOString().split('T')[0]}.${format}`;
        await exportData(
            `${API_BASE}/inventory/cycle-counts/${cycleCountId}/export`,
            filename,
            { format }
        );
    }, [exportData]);

    const exportAudit = useCallback(async (options?: ExportOptions) => {
        const format = options?.format || 'csv';
        const filename = generateFilename('audit', format);
        await exportData(`${API_BASE}/inventory/audit/export`, filename, options);
    }, [exportData]);

    const exportOrders = useCallback(async (options?: ExportOptions) => {
        const format = options?.format || 'csv';
        const filename = generateFilename('orders', format);
        await exportData(`${API_BASE}/orders/export`, filename, options);
    }, [exportData]);

    return {
        isExporting,
        error,
        exportInventory,
        exportMovements,
        exportCycleCount,
        exportAudit,
        exportOrders,
    };
}
