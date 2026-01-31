/**
 * useBulkOperations Hook
 * API hook for bulk product operations
 * 
 * Part of: GAP-13 Bulk Operations
 */

import { useState, useCallback } from 'react';

// ============================================================
// TYPES
// ============================================================

export type BulkOperationType = 'update' | 'delete' | 'category';

export interface BulkOperationResult {
    success: number;
    failed: number;
    errors: Array<{ id: string; error: string }>;
}

export interface BulkUpdateDto {
    ids: string[];
    update: {
        status?: 'ACTIVE' | 'INACTIVE';
        categoryId?: string;
    };
}

interface UseBulkOperationsReturn {
    selectedIds: string[];
    isProcessing: boolean;
    progress: number;
    result: BulkOperationResult | null;
    select: (id: string) => void;
    deselect: (id: string) => void;
    selectAll: (ids: string[]) => void;
    deselectAll: () => void;
    toggleSelect: (id: string) => void;
    isSelected: (id: string) => boolean;
    bulkUpdateStatus: (status: 'ACTIVE' | 'INACTIVE') => Promise<BulkOperationResult>;
    bulkAssignCategory: (categoryId: string) => Promise<BulkOperationResult>;
    bulkDelete: () => Promise<BulkOperationResult>;
    clearResult: () => void;
}

const API_BASE = '/api/v1/products';

// ============================================================
// HOOK
// ============================================================

export function useBulkOperations(): UseBulkOperationsReturn {
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [result, setResult] = useState<BulkOperationResult | null>(null);

    const select = useCallback((id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev : [...prev, id]);
    }, []);

    const deselect = useCallback((id: string) => {
        setSelectedIds(prev => prev.filter(i => i !== id));
    }, []);

    const selectAll = useCallback((ids: string[]) => {
        setSelectedIds(ids);
    }, []);

    const deselectAll = useCallback(() => {
        setSelectedIds([]);
    }, []);

    const toggleSelect = useCallback((id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    }, []);

    const isSelected = useCallback((id: string) => {
        return selectedIds.includes(id);
    }, [selectedIds]);

    const bulkUpdateStatus = useCallback(async (
        status: 'ACTIVE' | 'INACTIVE'
    ): Promise<BulkOperationResult> => {
        setIsProcessing(true);
        setProgress(0);

        try {
            const response = await fetch(`${API_BASE}/bulk-update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: selectedIds, update: { status } }),
            });

            if (!response.ok) throw new Error('فشل التحديث الجماعي');

            const result = await response.json();
            setResult(result);
            setProgress(100);
            setSelectedIds([]);
            return result;
        } catch (err) {
            const result = { success: 0, failed: selectedIds.length, errors: [] };
            setResult(result);
            return result;
        } finally {
            setIsProcessing(false);
        }
    }, [selectedIds]);

    const bulkAssignCategory = useCallback(async (
        categoryId: string
    ): Promise<BulkOperationResult> => {
        setIsProcessing(true);
        setProgress(0);

        try {
            const response = await fetch(`${API_BASE}/bulk-category`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: selectedIds, categoryId }),
            });

            if (!response.ok) throw new Error('فشل تعيين التصنيف');

            const result = await response.json();
            setResult(result);
            setProgress(100);
            setSelectedIds([]);
            return result;
        } catch (err) {
            const result = { success: 0, failed: selectedIds.length, errors: [] };
            setResult(result);
            return result;
        } finally {
            setIsProcessing(false);
        }
    }, [selectedIds]);

    const bulkDelete = useCallback(async (): Promise<BulkOperationResult> => {
        setIsProcessing(true);
        setProgress(0);

        try {
            const response = await fetch(`${API_BASE}/bulk-delete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: selectedIds }),
            });

            if (!response.ok) throw new Error('فشل الحذف الجماعي');

            const result = await response.json();
            setResult(result);
            setProgress(100);
            setSelectedIds([]);
            return result;
        } catch (err) {
            const result = { success: 0, failed: selectedIds.length, errors: [] };
            setResult(result);
            return result;
        } finally {
            setIsProcessing(false);
        }
    }, [selectedIds]);

    const clearResult = useCallback(() => {
        setResult(null);
        setProgress(0);
    }, []);

    return {
        selectedIds,
        isProcessing,
        progress,
        result,
        select,
        deselect,
        selectAll,
        deselectAll,
        toggleSelect,
        isSelected,
        bulkUpdateStatus,
        bulkAssignCategory,
        bulkDelete,
        clearResult,
    };
}
