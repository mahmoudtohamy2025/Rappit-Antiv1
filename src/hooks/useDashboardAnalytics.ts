/**
 * useDashboardAnalytics Hook
 * API hook for dashboard metrics and charts
 * 
 * Part of: GAP-12 Dashboard Analytics
 */

import { useState, useCallback } from 'react';

// ============================================================
// TYPES
// ============================================================

export type DateRange = '7d' | '30d' | '90d' | '12m';

export interface DashboardMetrics {
    totalRevenue: number;
    revenueChange: number;
    orderCount: number;
    orderCountChange: number;
    fulfillmentRate: number;
    avgOrderValue: number;
    lowStockItems: number;
    stockTurnover: number;
}

export interface RevenueDataPoint {
    date: string;
    revenue: number;
    orders: number;
}

export interface OrderStats {
    pending: number;
    processing: number;
    shipped: number;
    delivered: number;
    cancelled: number;
}

export interface TopProduct {
    id: string;
    name: string;
    sku: string;
    unitsSold: number;
    revenue: number;
    stock: number;
}

export interface ChannelRevenue {
    channel: string;
    channelName: string;
    revenue: number;
    orders: number;
    percentage: number;
}

interface UseDashboardAnalyticsReturn {
    metrics: DashboardMetrics | null;
    revenueData: RevenueDataPoint[];
    orderStats: OrderStats | null;
    topProducts: TopProduct[];
    channelRevenue: ChannelRevenue[];
    isLoading: boolean;
    error: Error | null;
    dateRange: DateRange;
    setDateRange: (range: DateRange) => void;
    getMetrics: () => Promise<void>;
    getRevenueData: () => Promise<void>;
    getOrderStats: () => Promise<void>;
    getTopProducts: (limit?: number) => Promise<void>;
    getChannelRevenue: () => Promise<void>;
    refreshAll: () => Promise<void>;
}

const API_BASE = '/api/v1/analytics';

// ============================================================
// HOOK
// ============================================================

export function useDashboardAnalytics(): UseDashboardAnalyticsReturn {
    const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
    const [revenueData, setRevenueData] = useState<RevenueDataPoint[]>([]);
    const [orderStats, setOrderStats] = useState<OrderStats | null>(null);
    const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
    const [channelRevenue, setChannelRevenue] = useState<ChannelRevenue[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [dateRange, setDateRange] = useState<DateRange>('30d');

    const getMetrics = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(`${API_BASE}/metrics?range=${dateRange}`);
            if (!response.ok) throw new Error('فشل تحميل الإحصائيات');
            const data = await response.json();
            setMetrics(data);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Unknown error'));
        } finally {
            setIsLoading(false);
        }
    }, [dateRange]);

    const getRevenueData = useCallback(async () => {
        try {
            const response = await fetch(`${API_BASE}/revenue?range=${dateRange}`);
            if (!response.ok) throw new Error('فشل تحميل بيانات الإيرادات');
            const data = await response.json();
            setRevenueData(data.data || data);
        } catch (err) {
            console.error('Failed to load revenue data:', err);
        }
    }, [dateRange]);

    const getOrderStats = useCallback(async () => {
        try {
            const response = await fetch(`${API_BASE}/orders?range=${dateRange}`);
            if (!response.ok) throw new Error('فشل تحميل إحصائيات الطلبات');
            const data = await response.json();
            setOrderStats(data);
        } catch (err) {
            console.error('Failed to load order stats:', err);
        }
    }, [dateRange]);

    const getTopProducts = useCallback(async (limit = 10) => {
        try {
            const response = await fetch(`${API_BASE}/top-products?range=${dateRange}&limit=${limit}`);
            if (!response.ok) throw new Error('فشل تحميل المنتجات الأكثر مبيعاً');
            const data = await response.json();
            setTopProducts(data.data || data);
        } catch (err) {
            console.error('Failed to load top products:', err);
        }
    }, [dateRange]);

    const getChannelRevenue = useCallback(async () => {
        try {
            const response = await fetch(`${API_BASE}/channels?range=${dateRange}`);
            if (!response.ok) throw new Error('فشل تحميل أداء القنوات');
            const data = await response.json();
            setChannelRevenue(data.data || data);
        } catch (err) {
            console.error('Failed to load channel revenue:', err);
        }
    }, [dateRange]);

    const refreshAll = useCallback(async () => {
        await Promise.all([
            getMetrics(),
            getRevenueData(),
            getOrderStats(),
            getTopProducts(),
            getChannelRevenue(),
        ]);
    }, [getMetrics, getRevenueData, getOrderStats, getTopProducts, getChannelRevenue]);

    return {
        metrics,
        revenueData,
        orderStats,
        topProducts,
        channelRevenue,
        isLoading,
        error,
        dateRange,
        setDateRange,
        getMetrics,
        getRevenueData,
        getOrderStats,
        getTopProducts,
        getChannelRevenue,
        refreshAll,
    };
}
