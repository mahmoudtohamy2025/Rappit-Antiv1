/**
 * useOrganization Hook
 * API hook for organization management
 * 
 * Part of: GAP-10 Organization Settings
 */

import { useState, useCallback } from 'react';

// ============================================================
// TYPES
// ============================================================

export interface OrganizationProfile {
    id: string;
    name: string;
    logo: string | null;
    timezone: string;
    isActive: boolean;
    createdAt: string;
    usersCount?: number;
    warehousesCount?: number;
    productsCount?: number;
    ordersCount?: number;
}

export interface NotificationSettings {
    emailEnabled: boolean;
    lowStockAlerts: boolean;
    orderAlerts: boolean;
    weeklyReport: boolean;
}

export interface GeneralSettings {
    timezone: string;
    dateFormat: string;
    language: string;
}

export interface OrganizationSettings {
    notifications: NotificationSettings;
    general: GeneralSettings;
}

export interface OrganizationStats {
    users: number;
    warehouses: number;
    products: number;
    orders: {
        total: number;
        thisMonth: number;
        pending: number;
    };
    inventory: {
        totalItems: number;
        lowStock: number;
        outOfStock: number;
    };
}

interface UpdateOrganizationDto {
    name?: string;
    logo?: string;
    timezone?: string;
}

interface UpdateSettingsDto {
    notifications?: Partial<NotificationSettings>;
    general?: Partial<GeneralSettings>;
}

interface UseOrganizationReturn {
    profile: OrganizationProfile | null;
    settings: OrganizationSettings | null;
    stats: OrganizationStats | null;
    isLoading: boolean;
    error: Error | null;
    fetchProfile: (includeStats?: boolean) => Promise<void>;
    updateProfile: (dto: UpdateOrganizationDto) => Promise<OrganizationProfile>;
    fetchSettings: () => Promise<void>;
    updateSettings: (dto: UpdateSettingsDto) => Promise<OrganizationSettings>;
    fetchStats: () => Promise<void>;
}

const API_BASE = '/api/v1/organizations';

export function useOrganization(): UseOrganizationReturn {
    const [profile, setProfile] = useState<OrganizationProfile | null>(null);
    const [settings, setSettings] = useState<OrganizationSettings | null>(null);
    const [stats, setStats] = useState<OrganizationStats | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const fetchProfile = useCallback(async (includeStats = false) => {
        setIsLoading(true);
        setError(null);

        try {
            const params = includeStats ? '?includeStats=true' : '';
            const response = await window.fetch(`${API_BASE}/current${params}`);

            if (!response.ok) {
                throw new Error('Failed to fetch organization');
            }

            const data = await response.json();
            setProfile(data);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Unknown error'));
        } finally {
            setIsLoading(false);
        }
    }, []);

    const updateProfile = useCallback(async (dto: UpdateOrganizationDto): Promise<OrganizationProfile> => {
        const response = await window.fetch(`${API_BASE}/current`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dto),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to update organization');
        }

        const updated = await response.json();
        setProfile(updated);
        return updated;
    }, []);

    const fetchSettings = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await window.fetch(`${API_BASE}/current/settings`);

            if (!response.ok) {
                throw new Error('Failed to fetch settings');
            }

            const data = await response.json();
            setSettings(data);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Unknown error'));
        } finally {
            setIsLoading(false);
        }
    }, []);

    const updateSettings = useCallback(async (dto: UpdateSettingsDto): Promise<OrganizationSettings> => {
        const response = await window.fetch(`${API_BASE}/current/settings`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dto),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to update settings');
        }

        const updated = await response.json();
        setSettings(updated);
        return updated;
    }, []);

    const fetchStats = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await window.fetch(`${API_BASE}/current/stats`);

            if (!response.ok) {
                throw new Error('Failed to fetch stats');
            }

            const data = await response.json();
            setStats(data);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Unknown error'));
        } finally {
            setIsLoading(false);
        }
    }, []);

    return {
        profile,
        settings,
        stats,
        isLoading,
        error,
        fetchProfile,
        updateProfile,
        fetchSettings,
        updateSettings,
        fetchStats,
    };
}
