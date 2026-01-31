/**
 * useChannels Hook
 * API hook for sales channel integration management
 * 
 * Part of: GAP-18 Channel OAuth Flow
 */

import { useState, useCallback } from 'react';

// ============================================================
// TYPES
// ============================================================

export type ChannelPlatform = 'SHOPIFY' | 'WOOCOMMERCE';
export type ChannelStatus = 'CONNECTED' | 'SYNCING' | 'ERROR' | 'DISCONNECTED';

export interface Channel {
    id: string;
    platform: ChannelPlatform;
    storeName: string;
    storeUrl: string;
    status: ChannelStatus;
    lastSyncAt?: string;
    connectedAt: string;
    errorMessage?: string;
    syncStats?: {
        productsImported: number;
        ordersImported: number;
        lastOrderSync?: string;
    };
}

export interface ConnectChannelDto {
    platform: ChannelPlatform;
    storeUrl?: string;  // For WooCommerce
    apiKey?: string;    // For WooCommerce
    apiSecret?: string; // For WooCommerce
}

interface UseChannelsReturn {
    channels: Channel[];
    isLoading: boolean;
    error: Error | null;
    getChannels: () => Promise<void>;
    initiateOAuth: (platform: ChannelPlatform) => Promise<string>;
    handleOAuthCallback: (platform: ChannelPlatform, code: string, state: string) => Promise<Channel>;
    connectWithApiKey: (dto: ConnectChannelDto) => Promise<Channel>;
    disconnectChannel: (channelId: string) => Promise<void>;
    syncChannel: (channelId: string) => Promise<void>;
    testConnection: (channelId: string) => Promise<boolean>;
}

const API_BASE = '/api/v1/channels';

// ============================================================
// HOOK
// ============================================================

export function useChannels(): UseChannelsReturn {
    const [channels, setChannels] = useState<Channel[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const getChannels = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(API_BASE);
            if (!response.ok) throw new Error('فشل تحميل القنوات');
            const data = await response.json();
            setChannels(data.data || data);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Unknown error'));
        } finally {
            setIsLoading(false);
        }
    }, []);

    const initiateOAuth = useCallback(async (platform: ChannelPlatform): Promise<string> => {
        const response = await fetch(`${API_BASE}/connect/${platform.toLowerCase()}`, {
            method: 'POST',
        });

        if (!response.ok) throw new Error('فشل بدء الربط');

        const { url } = await response.json();
        return url;
    }, []);

    const handleOAuthCallback = useCallback(async (
        platform: ChannelPlatform,
        code: string,
        state: string
    ): Promise<Channel> => {
        const response = await fetch(`${API_BASE}/callback/${platform.toLowerCase()}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, state }),
        });

        if (!response.ok) throw new Error('فشل إتمام الربط');

        const channel = await response.json();
        setChannels(prev => [...prev, channel]);
        return channel;
    }, []);

    const connectWithApiKey = useCallback(async (dto: ConnectChannelDto): Promise<Channel> => {
        const response = await fetch(`${API_BASE}/connect-api-key`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dto),
        });

        if (!response.ok) throw new Error('فشل ربط القناة');

        const channel = await response.json();
        setChannels(prev => [...prev, channel]);
        return channel;
    }, []);

    const disconnectChannel = useCallback(async (channelId: string) => {
        const response = await fetch(`${API_BASE}/${channelId}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('فشل فصل القناة');
        setChannels(prev => prev.filter(c => c.id !== channelId));
    }, []);

    const syncChannel = useCallback(async (channelId: string) => {
        const response = await fetch(`${API_BASE}/${channelId}/sync`, { method: 'POST' });
        if (!response.ok) throw new Error('فشل المزامنة');

        // Update channel status
        setChannels(prev => prev.map(c =>
            c.id === channelId ? { ...c, status: 'SYNCING' as ChannelStatus } : c
        ));
    }, []);

    const testConnection = useCallback(async (channelId: string): Promise<boolean> => {
        const response = await fetch(`${API_BASE}/${channelId}/test`);
        if (!response.ok) return false;
        const { success } = await response.json();
        return success;
    }, []);

    return {
        channels,
        isLoading,
        error,
        getChannels,
        initiateOAuth,
        handleOAuthCallback,
        connectWithApiKey,
        disconnectChannel,
        syncChannel,
        testConnection,
    };
}
