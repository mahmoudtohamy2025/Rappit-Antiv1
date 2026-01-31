/**
 * useOrders Hook
 * API hook for order management operations
 * 
 * Part of: GAP-08 Orders Enhancements
 */

import { useState, useCallback } from 'react';

// ============================================================
// TYPES
// ============================================================

export type OrderStatus =
    | 'PENDING'
    | 'CONFIRMED'
    | 'PROCESSING'
    | 'SHIPPED'
    | 'DELIVERED'
    | 'CANCELLED'
    | 'REFUNDED';

export type OrderChannel = 'MANUAL' | 'SHOPIFY' | 'WOOCOMMERCE' | 'API';

export interface OrderItem {
    id: string;
    skuId: string;
    skuName?: string;
    quantity: number;
    price: number;
    total: number;
}

export interface Order {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    channel: OrderChannel;
    customerName: string;
    customerEmail?: string;
    customerPhone?: string;
    shippingAddress?: {
        street: string;
        city: string;
        country: string;
        postalCode?: string;
    };
    items: OrderItem[];
    subtotal: number;
    tax: number;
    shipping: number;
    total: number;
    notes?: string;
    createdAt: string;
    updatedAt: string;
}

export interface OrderFilters {
    status?: OrderStatus;
    channel?: OrderChannel;
    search?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
}

export interface CreateOrderDto {
    customerName: string;
    customerEmail?: string;
    customerPhone?: string;
    shippingAddress?: {
        street: string;
        city: string;
        country: string;
        postalCode?: string;
    };
    items: Array<{
        skuId: string;
        quantity: number;
        price: number;
    }>;
    notes?: string;
}

export interface BulkStatusUpdateDto {
    orderIds: string[];
    status: OrderStatus;
    notes?: string;
}

export interface TimelineEvent {
    id: string;
    status: OrderStatus;
    notes?: string;
    userId?: string;
    userName?: string;
    createdAt: string;
}

interface PaginatedResponse {
    data: Order[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
    };
}

interface UseOrdersReturn {
    orders: Order[];
    meta: PaginatedResponse['meta'] | null;
    selectedOrders: string[];
    isLoading: boolean;
    error: Error | null;
    fetchOrders: (filters?: OrderFilters) => Promise<void>;
    createOrder: (dto: CreateOrderDto) => Promise<Order>;
    updateStatus: (orderId: string, status: OrderStatus, notes?: string) => Promise<Order>;
    bulkUpdateStatus: (dto: BulkStatusUpdateDto) => Promise<void>;
    getTimeline: (orderId: string) => Promise<TimelineEvent[]>;
    exportOrders: (filters?: OrderFilters, format?: 'csv' | 'json') => Promise<void>;
    selectOrder: (orderId: string) => void;
    deselectOrder: (orderId: string) => void;
    selectAll: () => void;
    deselectAll: () => void;
}

const API_BASE = '/api/v1/orders';

// ============================================================
// HOOK
// ============================================================

export function useOrders(): UseOrdersReturn {
    const [orders, setOrders] = useState<Order[]>([]);
    const [meta, setMeta] = useState<PaginatedResponse['meta'] | null>(null);
    const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const buildParams = (filters?: OrderFilters) => {
        const params = new URLSearchParams();
        if (filters) {
            if (filters.status) params.append('status', filters.status);
            if (filters.channel) params.append('channel', filters.channel);
            if (filters.search) params.append('search', filters.search);
            if (filters.startDate) params.append('startDate', filters.startDate);
            if (filters.endDate) params.append('endDate', filters.endDate);
            if (filters.page) params.append('page', String(filters.page));
            if (filters.pageSize) params.append('pageSize', String(filters.pageSize));
        }
        return params.toString();
    };

    const fetchOrders = useCallback(async (filters?: OrderFilters) => {
        setIsLoading(true);
        setError(null);

        try {
            const params = buildParams(filters);
            const response = await fetch(`${API_BASE}?${params}`);

            if (!response.ok) {
                throw new Error('فشل تحميل الطلبات');
            }

            const result: PaginatedResponse = await response.json();
            setOrders(result.data);
            setMeta(result.meta);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Unknown error'));
        } finally {
            setIsLoading(false);
        }
    }, []);

    const createOrder = useCallback(async (dto: CreateOrderDto): Promise<Order> => {
        const response = await fetch(API_BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...dto, channel: 'MANUAL' }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'فشل إنشاء الطلب');
        }

        const order = await response.json();
        setOrders(prev => [order, ...prev]);
        return order;
    }, []);

    const updateStatus = useCallback(async (
        orderId: string,
        status: OrderStatus,
        notes?: string
    ): Promise<Order> => {
        const response = await fetch(`${API_BASE}/${orderId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status, notes }),
        });

        if (!response.ok) {
            throw new Error('فشل تحديث الحالة');
        }

        const order = await response.json();
        setOrders(prev => prev.map(o => o.id === orderId ? order : o));
        return order;
    }, []);

    const bulkUpdateStatus = useCallback(async (dto: BulkStatusUpdateDto) => {
        const response = await fetch(`${API_BASE}/bulk-status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dto),
        });

        if (!response.ok) {
            throw new Error('فشل تحديث الطلبات');
        }

        // Update local state
        setOrders(prev => prev.map(o =>
            dto.orderIds.includes(o.id) ? { ...o, status: dto.status } : o
        ));
        setSelectedOrders([]);
    }, []);

    const getTimeline = useCallback(async (orderId: string): Promise<TimelineEvent[]> => {
        const response = await fetch(`${API_BASE}/${orderId}/timeline`);

        if (!response.ok) {
            throw new Error('فشل تحميل الجدول الزمني');
        }

        return response.json();
    }, []);

    const exportOrders = useCallback(async (filters?: OrderFilters, format: 'csv' | 'json' = 'csv') => {
        const params = buildParams(filters);
        const response = await fetch(`${API_BASE}/export?${params}&format=${format}`);

        if (!response.ok) {
            throw new Error('فشل التصدير');
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `orders_${new Date().toISOString().split('T')[0]}.${format}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, []);

    const selectOrder = useCallback((orderId: string) => {
        setSelectedOrders(prev => [...prev, orderId]);
    }, []);

    const deselectOrder = useCallback((orderId: string) => {
        setSelectedOrders(prev => prev.filter(id => id !== orderId));
    }, []);

    const selectAll = useCallback(() => {
        setSelectedOrders(orders.map(o => o.id));
    }, [orders]);

    const deselectAll = useCallback(() => {
        setSelectedOrders([]);
    }, []);

    return {
        orders,
        meta,
        selectedOrders,
        isLoading,
        error,
        fetchOrders,
        createOrder,
        updateStatus,
        bulkUpdateStatus,
        getTimeline,
        exportOrders,
        selectOrder,
        deselectOrder,
        selectAll,
        deselectAll,
    };
}
