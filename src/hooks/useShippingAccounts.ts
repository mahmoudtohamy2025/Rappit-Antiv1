/**
 * useShippingAccounts Hook
 * API hook for shipping carrier account management
 * 
 * Part of: GAP-21 Shipping Carrier Connect
 */

import { useState, useCallback } from 'react';

// ============================================================
// TYPES
// ============================================================

export type ShippingCarrier = 'FEDEX' | 'DHL' | 'UPS' | 'ARAMEX';
export type ShippingAccountStatus = 'CONNECTED' | 'ERROR' | 'DISCONNECTED';

export interface ShippingAccount {
    id: string;
    carrier: ShippingCarrier;
    accountNumber: string;
    accountName?: string;
    status: ShippingAccountStatus;
    isDefault: boolean;
    connectedAt: string;
    lastUsedAt?: string;
    errorMessage?: string;
}

export interface ConnectFedExDto {
    clientId: string;
    clientSecret: string;
    accountNumber: string;
}

export interface ConnectDHLDto {
    customerId: string;
    apiKey: string;
    accountNumber?: string;
}

export interface ConnectAramexDto {
    accountNumber: string;
    userName: string;
    password: string;
    accountPin: string;
}

interface UseShippingAccountsReturn {
    accounts: ShippingAccount[];
    isLoading: boolean;
    error: Error | null;
    getAccounts: () => Promise<void>;
    connectFedEx: (dto: ConnectFedExDto) => Promise<ShippingAccount>;
    connectDHL: (dto: ConnectDHLDto) => Promise<ShippingAccount>;
    connectAramex: (dto: ConnectAramexDto) => Promise<ShippingAccount>;
    disconnectAccount: (accountId: string) => Promise<void>;
    setDefaultAccount: (accountId: string) => Promise<void>;
    testConnection: (accountId: string) => Promise<boolean>;
}

const API_BASE = '/api/v1/shipping-accounts';

// ============================================================
// CARRIER CONFIG
// ============================================================

export const CARRIER_CONFIG: Record<ShippingCarrier, {
    name: string;
    nameAr: string;
    color: string;
    authType: 'oauth' | 'apikey' | 'credentials';
}> = {
    FEDEX: { name: 'FedEx', nameAr: 'فيديكس', color: '#4D148C', authType: 'oauth' },
    DHL: { name: 'DHL Express', nameAr: 'دي إتش إل', color: '#FFCC00', authType: 'apikey' },
    UPS: { name: 'UPS', nameAr: 'يو بي إس', color: '#351C15', authType: 'oauth' },
    ARAMEX: { name: 'Aramex', nameAr: 'أرامكس', color: '#ED1C24', authType: 'credentials' },
};

// ============================================================
// HOOK
// ============================================================

export function useShippingAccounts(): UseShippingAccountsReturn {
    const [accounts, setAccounts] = useState<ShippingAccount[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const getAccounts = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(API_BASE);
            if (!response.ok) throw new Error('فشل تحميل حسابات الشحن');
            const data = await response.json();
            setAccounts(data.data || data);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Unknown error'));
        } finally {
            setIsLoading(false);
        }
    }, []);

    const connectFedEx = useCallback(async (dto: ConnectFedExDto): Promise<ShippingAccount> => {
        const response = await fetch(`${API_BASE}/connect/fedex`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dto),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'فشل ربط FedEx');
        }

        const account = await response.json();
        setAccounts(prev => [...prev, account]);
        return account;
    }, []);

    const connectDHL = useCallback(async (dto: ConnectDHLDto): Promise<ShippingAccount> => {
        const response = await fetch(`${API_BASE}/connect/dhl`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dto),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'فشل ربط DHL');
        }

        const account = await response.json();
        setAccounts(prev => [...prev, account]);
        return account;
    }, []);

    const connectAramex = useCallback(async (dto: ConnectAramexDto): Promise<ShippingAccount> => {
        const response = await fetch(`${API_BASE}/connect/aramex`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dto),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'فشل ربط Aramex');
        }

        const account = await response.json();
        setAccounts(prev => [...prev, account]);
        return account;
    }, []);

    const disconnectAccount = useCallback(async (accountId: string) => {
        const response = await fetch(`${API_BASE}/${accountId}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('فشل إلغاء ربط الحساب');
        setAccounts(prev => prev.filter(a => a.id !== accountId));
    }, []);

    const setDefaultAccount = useCallback(async (accountId: string) => {
        const response = await fetch(`${API_BASE}/${accountId}/default`, { method: 'POST' });
        if (!response.ok) throw new Error('فشل تعيين الحساب الافتراضي');
        setAccounts(prev => prev.map(a => ({ ...a, isDefault: a.id === accountId })));
    }, []);

    const testConnection = useCallback(async (accountId: string): Promise<boolean> => {
        const response = await fetch(`${API_BASE}/${accountId}/test`);
        if (!response.ok) return false;
        const { success } = await response.json();
        return success;
    }, []);

    return {
        accounts,
        isLoading,
        error,
        getAccounts,
        connectFedEx,
        connectDHL,
        connectAramex,
        disconnectAccount,
        setDefaultAccount,
        testConnection,
    };
}
