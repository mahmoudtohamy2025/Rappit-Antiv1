/**
 * useFilterPresets Hook
 * API hook for saving and loading filter presets
 * 
 * Part of: GAP-11 Filter Presets
 */

import { useState, useCallback, useEffect } from 'react';

// ============================================================
// TYPES
// ============================================================

export interface FilterValues {
    warehouseId?: string;
    categoryId?: string;
    stockLevel?: 'all' | 'low' | 'out' | 'normal';
    dateFrom?: string;
    dateTo?: string;
    search?: string;
    status?: string;
    [key: string]: string | undefined;
}

export interface FilterPreset {
    id: string;
    name: string;
    filters: FilterValues;
    isDefault: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface CreatePresetDto {
    name: string;
    filters: FilterValues;
    isDefault?: boolean;
}

interface UseFilterPresetsReturn {
    presets: FilterPreset[];
    activePreset: FilterPreset | null;
    isLoading: boolean;
    error: Error | null;
    getPresets: () => Promise<void>;
    createPreset: (dto: CreatePresetDto) => Promise<FilterPreset>;
    updatePreset: (id: string, dto: Partial<CreatePresetDto>) => Promise<FilterPreset>;
    deletePreset: (id: string) => Promise<void>;
    applyPreset: (preset: FilterPreset, onApply: (filters: FilterValues) => void) => void;
    setDefaultPreset: (id: string) => Promise<void>;
    clearActivePreset: () => void;
}

const API_BASE = '/api/v1/filter-presets';
const STORAGE_KEY = 'active-filter-preset';

// ============================================================
// HOOK
// ============================================================

export function useFilterPresets(): UseFilterPresetsReturn {
    const [presets, setPresets] = useState<FilterPreset[]>([]);
    const [activePreset, setActivePreset] = useState<FilterPreset | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const getPresets = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(API_BASE);
            if (!response.ok) throw new Error('فشل تحميل الفلاتر المحفوظة');
            const data = await response.json();
            setPresets(data.data || data);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Unknown error'));
        } finally {
            setIsLoading(false);
        }
    }, []);

    const createPreset = useCallback(async (dto: CreatePresetDto): Promise<FilterPreset> => {
        const response = await fetch(API_BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dto),
        });

        if (!response.ok) throw new Error('فشل حفظ الفلتر');

        const preset = await response.json();
        setPresets(prev => [...prev, preset]);
        return preset;
    }, []);

    const updatePreset = useCallback(async (
        id: string,
        dto: Partial<CreatePresetDto>
    ): Promise<FilterPreset> => {
        const response = await fetch(`${API_BASE}/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dto),
        });

        if (!response.ok) throw new Error('فشل تحديث الفلتر');

        const preset = await response.json();
        setPresets(prev => prev.map(p => p.id === id ? preset : p));
        return preset;
    }, []);

    const deletePreset = useCallback(async (id: string) => {
        const response = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('فشل حذف الفلتر');
        setPresets(prev => prev.filter(p => p.id !== id));
        if (activePreset?.id === id) {
            setActivePreset(null);
            localStorage.removeItem(STORAGE_KEY);
        }
    }, [activePreset]);

    const applyPreset = useCallback((
        preset: FilterPreset,
        onApply: (filters: FilterValues) => void
    ) => {
        setActivePreset(preset);
        localStorage.setItem(STORAGE_KEY, preset.id);
        onApply(preset.filters);
    }, []);

    const setDefaultPreset = useCallback(async (id: string) => {
        // Clear existing defaults
        const response = await fetch(`${API_BASE}/${id}/default`, { method: 'POST' });
        if (!response.ok) throw new Error('فشل تعيين الفلتر الافتراضي');

        setPresets(prev => prev.map(p => ({
            ...p,
            isDefault: p.id === id,
        })));
    }, []);

    const clearActivePreset = useCallback(() => {
        setActivePreset(null);
        localStorage.removeItem(STORAGE_KEY);
    }, []);

    // Auto-load default preset on init
    useEffect(() => {
        const savedId = localStorage.getItem(STORAGE_KEY);
        if (savedId && presets.length > 0) {
            const saved = presets.find(p => p.id === savedId);
            if (saved) setActivePreset(saved);
        } else {
            const defaultPreset = presets.find(p => p.isDefault);
            if (defaultPreset) setActivePreset(defaultPreset);
        }
    }, [presets]);

    return {
        presets,
        activePreset,
        isLoading,
        error,
        getPresets,
        createPreset,
        updatePreset,
        deletePreset,
        applyPreset,
        setDefaultPreset,
        clearActivePreset,
    };
}
