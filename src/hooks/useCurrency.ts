/**
 * useCurrency Hook
 * API hook for currency management
 * 
 * Part of: GAP-20 Multi-Currency Support
 */

import { useState, useCallback, useEffect } from 'react';
import { Currency, CURRENCIES, formatPrice as formatPriceUtil } from '../lib/currency';

export interface OrgCurrencySettings {
    defaultCurrency: string;
    supportedCurrencies: string[];
    defaultCurrencyDetails: Currency;
}

interface UpdateCurrencySettingsDto {
    defaultCurrency?: string;
    supportedCurrencies?: string[];
}

interface UseCurrencyReturn {
    currencies: Currency[];
    settings: OrgCurrencySettings | null;
    isLoading: boolean;
    error: Error | null;
    fetchSettings: () => Promise<void>;
    updateSettings: (dto: UpdateCurrencySettingsDto) => Promise<OrgCurrencySettings>;
    formatPrice: (amount: number, currencyCode?: string) => string;
    getCurrency: (code: string) => Currency | undefined;
}

const API_BASE = '/api/v1';

export function useCurrency(): UseCurrencyReturn {
    const [settings, setSettings] = useState<OrgCurrencySettings | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const fetchSettings = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await window.fetch(`${API_BASE}/organizations/current/currency`);

            if (!response.ok) {
                throw new Error('Failed to fetch currency settings');
            }

            const data = await response.json();
            setSettings(data);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Unknown error'));
        } finally {
            setIsLoading(false);
        }
    }, []);

    const updateSettings = useCallback(async (dto: UpdateCurrencySettingsDto): Promise<OrgCurrencySettings> => {
        const response = await window.fetch(`${API_BASE}/organizations/current/currency`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dto),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to update currency settings');
        }

        const updated = await response.json();
        setSettings(updated);
        return updated;
    }, []);

    const formatPrice = useCallback((amount: number, currencyCode?: string): string => {
        const code = currencyCode || settings?.defaultCurrency || 'SAR';
        return formatPriceUtil(amount, code);
    }, [settings]);

    const getCurrency = useCallback((code: string): Currency | undefined => {
        return CURRENCIES.find(c => c.code === code?.toUpperCase());
    }, []);

    return {
        currencies: CURRENCIES,
        settings,
        isLoading,
        error,
        fetchSettings,
        updateSettings,
        formatPrice,
        getCurrency,
    };
}
