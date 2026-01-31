/**
 * useForceRelease Hook
 * API hook for force release operations
 * 
 * Connects to: force-release.service.ts (87 tests)
 */

import { useState, useCallback } from 'react';

interface Reservation {
    id: string;
    sku: string;
    productName: string;
    quantity: number;
    orderId: string;
    orderNumber: string;
    warehouseId: string;
    warehouseName: string;
    createdAt: string;
    ageMinutes: number;
}

interface ReleaseRecord {
    id: string;
    reservationId: string;
    sku: string;
    productName: string;
    quantity: number;
    orderNumber: string;
    reasonCode: string;
    reasonLabel: string;
    notes?: string;
    releasedBy: string;
    releasedAt: string;
}

interface ReleaseDto {
    reservationId: string;
    reasonCode: string;
    notes?: string;
    notifyOwner?: boolean;
}

interface BatchReleaseDto {
    reservationIds: string[];
    reasonCode: string;
    notes?: string;
}

interface UseForceReleaseReturn {
    stuckReservations: Reservation[];
    releaseHistory: ReleaseRecord[];
    isLoading: boolean;
    error: Error | null;
    fetchStuck: (minAgeMinutes?: number) => Promise<void>;
    fetchHistory: () => Promise<void>;
    release: (data: ReleaseDto) => Promise<ReleaseRecord>;
    batchRelease: (data: BatchReleaseDto) => Promise<ReleaseRecord[]>;
    getReasonCodes: () => Promise<Array<{ value: string; label: string; description: string }>>;
}

const API_BASE = '/api/v1/inventory/force-release';

export function useForceRelease(): UseForceReleaseReturn {
    const [stuckReservations, setStuckReservations] = useState<Reservation[]>([]);
    const [releaseHistory, setReleaseHistory] = useState<ReleaseRecord[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const fetchStuck = useCallback(async (minAgeMinutes = 30) => {
        setIsLoading(true);
        try {
            const response = await fetch(`${API_BASE}/stuck?minAgeMinutes=${minAgeMinutes}`);
            if (!response.ok) throw new Error('Failed to fetch stuck reservations');
            const data = await response.json();
            setStuckReservations(data);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Unknown error'));
        } finally {
            setIsLoading(false);
        }
    }, []);

    const fetchHistory = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`${API_BASE}/history`);
            if (!response.ok) throw new Error('Failed to fetch release history');
            const data = await response.json();
            setReleaseHistory(data);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Unknown error'));
        } finally {
            setIsLoading(false);
        }
    }, []);

    const release = useCallback(async (data: ReleaseDto): Promise<ReleaseRecord> => {
        const response = await fetch(API_BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to release reservation');
        }

        const record = await response.json();
        setStuckReservations(prev => prev.filter(r => r.id !== data.reservationId));
        setReleaseHistory(prev => [record, ...prev]);
        return record;
    }, []);

    const batchRelease = useCallback(async (data: BatchReleaseDto): Promise<ReleaseRecord[]> => {
        const response = await fetch(`${API_BASE}/batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to batch release');
        }

        const records = await response.json();
        setStuckReservations(prev => prev.filter(r => !data.reservationIds.includes(r.id)));
        setReleaseHistory(prev => [...records, ...prev]);
        return records;
    }, []);

    const getReasonCodes = useCallback(async () => {
        const response = await fetch(`${API_BASE}/reason-codes`);
        if (!response.ok) throw new Error('Failed to fetch reason codes');
        return response.json();
    }, []);

    return {
        stuckReservations,
        releaseHistory,
        isLoading,
        error,
        fetchStuck,
        fetchHistory,
        release,
        batchRelease,
        getReasonCodes,
    };
}
