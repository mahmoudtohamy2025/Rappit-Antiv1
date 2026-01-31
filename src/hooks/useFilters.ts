/**
 * useFilters Hook
 * Unified filter state management for inventory panels
 * 
 * Part of: GAP-05 Enhanced Filters
 */

import { useState, useCallback, useMemo } from 'react';

// ============================================================
// TYPES
// ============================================================

export type StockLevel = 'all' | 'low' | 'out' | 'normal';

export interface FilterState {
    warehouseId?: string;
    warehouseName?: string;
    category?: string;
    stockLevel?: StockLevel;
    startDate?: string;
    endDate?: string;
    search?: string;
    status?: string;
    type?: string;
}

export interface FilterLabel {
    key: keyof FilterState;
    label: string;
    value: string;
}

interface UseFiltersOptions {
    defaultFilters?: Partial<FilterState>;
    onFilterChange?: (filters: FilterState) => void;
}

interface UseFiltersReturn {
    filters: FilterState;
    setWarehouse: (id: string | undefined, name?: string) => void;
    setCategory: (category: string | undefined) => void;
    setStockLevel: (level: StockLevel | undefined) => void;
    setDateRange: (startDate: string | undefined, endDate: string | undefined) => void;
    setSearch: (query: string) => void;
    setStatus: (status: string | undefined) => void;
    setType: (type: string | undefined) => void;
    clearFilters: () => void;
    hasActiveFilters: boolean;
    activeFilterCount: number;
    activeFilterLabels: FilterLabel[];
    removeFilter: (key: keyof FilterState) => void;
    getQueryParams: () => string;
}

// ============================================================
// LABEL MAPPINGS
// ============================================================

const STOCK_LEVEL_LABELS: Record<StockLevel, string> = {
    all: 'الكل',
    low: 'منخفض',
    out: 'نفذ',
    normal: 'متوفر',
};

// ============================================================
// HOOK
// ============================================================

export function useFilters(options?: UseFiltersOptions): UseFiltersReturn {
    const [filters, setFilters] = useState<FilterState>(options?.defaultFilters || {});

    const setWarehouse = useCallback((id: string | undefined, name?: string) => {
        setFilters(prev => {
            const updated = { ...prev, warehouseId: id, warehouseName: name };
            options?.onFilterChange?.(updated);
            return updated;
        });
    }, [options?.onFilterChange]);

    const setCategory = useCallback((category: string | undefined) => {
        setFilters(prev => {
            const updated = { ...prev, category };
            options?.onFilterChange?.(updated);
            return updated;
        });
    }, [options?.onFilterChange]);

    const setStockLevel = useCallback((level: StockLevel | undefined) => {
        setFilters(prev => {
            const updated = { ...prev, stockLevel: level };
            options?.onFilterChange?.(updated);
            return updated;
        });
    }, [options?.onFilterChange]);

    const setDateRange = useCallback((startDate: string | undefined, endDate: string | undefined) => {
        setFilters(prev => {
            const updated = { ...prev, startDate, endDate };
            options?.onFilterChange?.(updated);
            return updated;
        });
    }, [options?.onFilterChange]);

    const setSearch = useCallback((query: string) => {
        setFilters(prev => {
            const updated = { ...prev, search: query || undefined };
            options?.onFilterChange?.(updated);
            return updated;
        });
    }, [options?.onFilterChange]);

    const setStatus = useCallback((status: string | undefined) => {
        setFilters(prev => {
            const updated = { ...prev, status };
            options?.onFilterChange?.(updated);
            return updated;
        });
    }, [options?.onFilterChange]);

    const setType = useCallback((type: string | undefined) => {
        setFilters(prev => {
            const updated = { ...prev, type };
            options?.onFilterChange?.(updated);
            return updated;
        });
    }, [options?.onFilterChange]);

    const clearFilters = useCallback(() => {
        const empty: FilterState = {};
        setFilters(empty);
        options?.onFilterChange?.(empty);
    }, [options?.onFilterChange]);

    const removeFilter = useCallback((key: keyof FilterState) => {
        setFilters(prev => {
            const updated = { ...prev };
            delete updated[key];
            // Also remove warehouseName if removing warehouseId
            if (key === 'warehouseId') {
                delete updated.warehouseName;
            }
            // Clear both dates if removing one
            if (key === 'startDate' || key === 'endDate') {
                delete updated.startDate;
                delete updated.endDate;
            }
            options?.onFilterChange?.(updated);
            return updated;
        });
    }, [options?.onFilterChange]);

    const hasActiveFilters = useMemo(() => {
        return Object.entries(filters).some(([key, value]) => {
            if (key === 'warehouseName') return false; // Don't count display name
            if (key === 'stockLevel' && value === 'all') return false;
            return value !== undefined && value !== '';
        });
    }, [filters]);

    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (filters.warehouseId) count++;
        if (filters.category) count++;
        if (filters.stockLevel && filters.stockLevel !== 'all') count++;
        if (filters.startDate && filters.endDate) count++;
        if (filters.search) count++;
        if (filters.status) count++;
        if (filters.type) count++;
        return count;
    }, [filters]);

    const activeFilterLabels = useMemo((): FilterLabel[] => {
        const labels: FilterLabel[] = [];

        if (filters.warehouseId) {
            labels.push({
                key: 'warehouseId',
                label: 'المستودع',
                value: filters.warehouseName || filters.warehouseId,
            });
        }

        if (filters.category) {
            labels.push({
                key: 'category',
                label: 'الفئة',
                value: filters.category,
            });
        }

        if (filters.stockLevel && filters.stockLevel !== 'all') {
            labels.push({
                key: 'stockLevel',
                label: 'المخزون',
                value: STOCK_LEVEL_LABELS[filters.stockLevel],
            });
        }

        if (filters.startDate && filters.endDate) {
            labels.push({
                key: 'startDate',
                label: 'الفترة',
                value: `${filters.startDate} - ${filters.endDate}`,
            });
        }

        if (filters.search) {
            labels.push({
                key: 'search',
                label: 'بحث',
                value: filters.search,
            });
        }

        return labels;
    }, [filters]);

    const getQueryParams = useCallback(() => {
        const params = new URLSearchParams();
        if (filters.warehouseId) params.append('warehouseId', filters.warehouseId);
        if (filters.category) params.append('category', filters.category);
        if (filters.stockLevel && filters.stockLevel !== 'all') params.append('stockLevel', filters.stockLevel);
        if (filters.startDate) params.append('startDate', filters.startDate);
        if (filters.endDate) params.append('endDate', filters.endDate);
        if (filters.search) params.append('search', filters.search);
        if (filters.status) params.append('status', filters.status);
        if (filters.type) params.append('type', filters.type);
        return params.toString();
    }, [filters]);

    return {
        filters,
        setWarehouse,
        setCategory,
        setStockLevel,
        setDateRange,
        setSearch,
        setStatus,
        setType,
        clearFilters,
        hasActiveFilters,
        activeFilterCount,
        activeFilterLabels,
        removeFilter,
        getQueryParams,
    };
}
