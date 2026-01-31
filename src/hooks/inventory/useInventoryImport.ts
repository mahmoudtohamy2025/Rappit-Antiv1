/**
 * useInventoryImport Hook
 * API hook for CSV import operations
 * 
 * Connects to: inventory-import.service.ts (105 tests)
 * Enhanced for GAP-07: Import History, Validation, Templates
 */

import { useState, useCallback } from 'react';

// ============================================================
// TYPES
// ============================================================

export type ImportType = 'products' | 'inventory';
export type ImportStatus = 'idle' | 'uploading' | 'validating' | 'processing' | 'completed' | 'failed';

export interface ImportOptions {
    updateExisting: boolean;
    skipDuplicates: boolean;
    validateOnly: boolean;
    type?: ImportType;
}

export interface ImportError {
    row: number;
    field: string;
    message: string;
    value?: string;
    sku?: string;
}

export interface ImportResult {
    id?: string;
    totalRows: number;
    successfulRows: number;
    failedRows: number;
    skippedRows: number;
    createdCount?: number;
    updatedCount?: number;
    errors: ImportError[];
    duration?: number;
}

export interface ImportProgress {
    status: ImportStatus;
    fileName: string;
    totalRows: number;
    processedRows: number;
    successfulRows: number;
    failedRows: number;
}

export interface ValidationResult {
    valid: boolean;
    totalRows: number;
    validRows: number;
    errorRows: number;
    errors: ImportError[];
    preview: any[];
    headers: string[];
}

export interface ImportHistory {
    id: string;
    type: ImportType;
    filename: string;
    status: 'COMPLETED' | 'PARTIAL' | 'FAILED';
    totalRows: number;
    successRows: number;
    errorRows: number;
    userId: string;
    userName?: string;
    createdAt: string;
}

interface UseInventoryImportReturn {
    progress: ImportProgress;
    result: ImportResult | null;
    validation: ValidationResult | null;
    history: ImportHistory[];
    isImporting: boolean;
    isValidating: boolean;
    importCsv: (file: File, options: ImportOptions) => Promise<ImportResult>;
    validateCsv: (file: File, type: ImportType) => Promise<ValidationResult>;
    getHistory: (type?: ImportType) => Promise<void>;
    downloadErrorReport: (importId: string) => void;
    downloadTemplate: (type: ImportType) => void;
    reset: () => void;
}

const API_BASE = '/api/v1/inventory';

export function useInventoryImport(): UseInventoryImportReturn {
    const [progress, setProgress] = useState<ImportProgress>({
        status: 'idle',
        fileName: '',
        totalRows: 0,
        processedRows: 0,
        successfulRows: 0,
        failedRows: 0,
    });
    const [result, setResult] = useState<ImportResult | null>(null);
    const [validation, setValidation] = useState<ValidationResult | null>(null);
    const [history, setHistory] = useState<ImportHistory[]>([]);
    const [isImporting, setIsImporting] = useState(false);
    const [isValidating, setIsValidating] = useState(false);

    // Validate CSV without importing
    const validateCsv = useCallback(async (file: File, type: ImportType): Promise<ValidationResult> => {
        setIsValidating(true);
        setProgress(prev => ({ ...prev, status: 'validating', fileName: file.name }));

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('type', type);

            const response = await fetch(`${API_BASE}/import/validate`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Validation failed');
            }

            const data: ValidationResult = await response.json();
            setValidation(data);
            return data;
        } catch (error) {
            setProgress(prev => ({ ...prev, status: 'failed' }));
            throw error;
        } finally {
            setIsValidating(false);
        }
    }, []);

    const importCsv = useCallback(async (file: File, options: ImportOptions): Promise<ImportResult> => {
        setIsImporting(true);
        setProgress({
            status: 'uploading',
            fileName: file.name,
            totalRows: 0,
            processedRows: 0,
            successfulRows: 0,
            failedRows: 0,
        });

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('updateExisting', String(options.updateExisting));
            formData.append('skipDuplicates', String(options.skipDuplicates));
            formData.append('validateOnly', String(options.validateOnly));
            if (options.type) formData.append('type', options.type);

            setProgress(prev => ({ ...prev, status: 'processing' }));

            const response = await fetch(`${API_BASE}/import`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Import failed');
            }

            const data = await response.json();

            setProgress(prev => ({
                ...prev,
                status: 'completed',
                totalRows: data.totalRows,
                processedRows: data.totalRows,
                successfulRows: data.successfulRows,
                failedRows: data.failedRows,
            }));

            const importResult: ImportResult = {
                id: data.id,
                totalRows: data.totalRows,
                successfulRows: data.successfulRows,
                failedRows: data.failedRows,
                skippedRows: data.skippedRows || 0,
                createdCount: data.createdCount,
                updatedCount: data.updatedCount,
                errors: data.errors || [],
                duration: data.duration,
            };

            setResult(importResult);
            return importResult;
        } catch (error) {
            setProgress(prev => ({ ...prev, status: 'failed' }));
            throw error;
        } finally {
            setIsImporting(false);
        }
    }, []);

    // Get import history
    const getHistory = useCallback(async (type?: ImportType) => {
        try {
            const params = type ? `?type=${type}` : '';
            const response = await fetch(`${API_BASE}/import/history${params}`);

            if (!response.ok) {
                throw new Error('Failed to fetch history');
            }

            const data = await response.json();
            setHistory(data.data || data);
        } catch (error) {
            console.error('Failed to fetch import history:', error);
        }
    }, []);

    // Download error report for specific import
    const downloadErrorReport = useCallback((importId: string) => {
        const link = document.createElement('a');
        link.href = `${API_BASE}/import/${importId}/errors`;
        link.download = `import_errors_${importId}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, []);

    // Download CSV template
    const downloadTemplate = useCallback((type: ImportType) => {
        let headers: string[];
        let sampleRow: string[];

        if (type === 'products') {
            headers = ['name', 'sku', 'category', 'description', 'price', 'cost', 'barcode', 'minStock', 'maxStock'];
            sampleRow = ['سماعة لاسلكية', 'ELEC-001', 'إلكترونيات', 'سماعة بلوتوث عالية الجودة', '199.99', '100', '6901234567890', '10', '500'];
        } else {
            headers = ['sku', 'warehouseId', 'quantity', 'location'];
            sampleRow = ['ELEC-001', 'warehouse-id-here', '50', 'A-01-01'];
        }

        const csvContent = [headers.join(','), sampleRow.join(',')].join('\n');
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${type}_import_template.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, []);

    const reset = useCallback(() => {
        setProgress({
            status: 'idle',
            fileName: '',
            totalRows: 0,
            processedRows: 0,
            successfulRows: 0,
            failedRows: 0,
        });
        setResult(null);
        setValidation(null);
        setIsImporting(false);
        setIsValidating(false);
    }, []);

    return {
        progress,
        result,
        validation,
        history,
        isImporting,
        isValidating,
        importCsv,
        validateCsv,
        getHistory,
        downloadErrorReport,
        downloadTemplate,
        reset,
    };
}
