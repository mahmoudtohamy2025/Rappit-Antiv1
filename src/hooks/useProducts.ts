/**
 * useProducts Hook
 * API hook for product management
 * 
 * Part of: GAP-02 Product/SKU CRUD
 */

import { useState, useCallback, useEffect } from 'react';

interface WarehouseStock {
    warehouseId: string;
    warehouseName: string;
    available: number;
    reserved: number;
    damaged: number;
}

export interface Product {
    id: string;
    organizationId: string;
    name: string;
    sku: string;
    description: string | null;
    category: string | null;
    barcode: string | null;
    price: number | null;
    cost: number | null;
    minStock: number;
    maxStock: number | null;
    images: string[];
    metadata: Record<string, any> | null;
    totalAvailable: number;
    totalReserved: number;
    stockStatus: 'LOW' | 'OUT' | 'NORMAL';
    stockByWarehouse?: WarehouseStock[];
    createdAt: string;
    updatedAt: string;
}

export interface CreateProductDto {
    name: string;
    sku?: string;
    description?: string;
    category?: string;
    barcode?: string;
    price?: number;
    cost?: number;
    minStock?: number;
    maxStock?: number;
    images?: string[];
    metadata?: Record<string, any>;
    initialStock?: {
        warehouseId: string;
        quantity: number;
    };
}

export interface UpdateProductDto {
    name?: string;
    sku?: string;
    description?: string;
    category?: string;
    barcode?: string;
    price?: number;
    cost?: number;
    minStock?: number;
    maxStock?: number;
    images?: string[];
    metadata?: Record<string, any>;
    isActive?: boolean;
}

interface ProductFilters {
    search?: string;
    category?: string;
    warehouseId?: string;
    stockLevel?: 'low' | 'out' | 'normal' | 'all';
    isActive?: boolean;
    page?: number;
    pageSize?: number;
}

interface PaginatedResponse {
    data: Product[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
    };
}

interface ProductStock {
    totalAvailable: number;
    totalReserved: number;
    totalDamaged: number;
}

interface UseProductsReturn {
    products: Product[];
    meta: PaginatedResponse['meta'] | null;
    isLoading: boolean;
    error: Error | null;
    fetch: (filters?: ProductFilters) => Promise<void>;
    create: (dto: CreateProductDto) => Promise<Product>;
    update: (id: string, dto: UpdateProductDto) => Promise<Product>;
    remove: (id: string) => Promise<void>;
    getById: (id: string) => Promise<Product>;
    getStock: (id: string) => Promise<ProductStock>;
    getHistory: (id: string) => Promise<any[]>;
    getCategories: () => Promise<string[]>;
    categories: string[];
}

const API_BASE = '/api/v1/products';

export function useProducts(): UseProductsReturn {
    const [products, setProducts] = useState<Product[]>([]);
    const [meta, setMeta] = useState<PaginatedResponse['meta'] | null>(null);
    const [categories, setCategories] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const buildParams = (filters?: ProductFilters) => {
        const params = new URLSearchParams();
        if (filters) {
            if (filters.search) params.append('search', filters.search);
            if (filters.category) params.append('category', filters.category);
            if (filters.warehouseId) params.append('warehouseId', filters.warehouseId);
            if (filters.stockLevel) params.append('stockLevel', filters.stockLevel);
            if (filters.isActive !== undefined) params.append('isActive', String(filters.isActive));
            if (filters.page) params.append('page', String(filters.page));
            if (filters.pageSize) params.append('pageSize', String(filters.pageSize));
        }
        return params.toString();
    };

    const fetch = useCallback(async (filters?: ProductFilters) => {
        setIsLoading(true);
        setError(null);

        try {
            const params = buildParams(filters);
            const response = await window.fetch(`${API_BASE}?${params}`);

            if (!response.ok) {
                throw new Error('Failed to fetch products');
            }

            const result: PaginatedResponse = await response.json();
            setProducts(result.data);
            setMeta(result.meta);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Unknown error'));
        } finally {
            setIsLoading(false);
        }
    }, []);

    const create = useCallback(async (dto: CreateProductDto): Promise<Product> => {
        const response = await window.fetch(API_BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dto),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to create product');
        }

        const newProduct = await response.json();
        setProducts(prev => [newProduct, ...prev]);
        return newProduct;
    }, []);

    const update = useCallback(async (id: string, dto: UpdateProductDto): Promise<Product> => {
        const response = await window.fetch(`${API_BASE}/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dto),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to update product');
        }

        const updated = await response.json();
        setProducts(prev => prev.map(p => p.id === id ? updated : p));
        return updated;
    }, []);

    const remove = useCallback(async (id: string): Promise<void> => {
        const response = await window.fetch(`${API_BASE}/${id}`, {
            method: 'DELETE',
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to delete product');
        }

        setProducts(prev => prev.filter(p => p.id !== id));
    }, []);

    const getById = useCallback(async (id: string): Promise<Product> => {
        const response = await window.fetch(`${API_BASE}/${id}`);

        if (!response.ok) {
            throw new Error('Product not found');
        }

        return response.json();
    }, []);

    const getStock = useCallback(async (id: string): Promise<ProductStock> => {
        const response = await window.fetch(`${API_BASE}/${id}/stock`);

        if (!response.ok) {
            throw new Error('Failed to get product stock');
        }

        return response.json();
    }, []);

    const getHistory = useCallback(async (id: string): Promise<any[]> => {
        const response = await window.fetch(`${API_BASE}/${id}/history`);

        if (!response.ok) {
            throw new Error('Failed to get product history');
        }

        return response.json();
    }, []);

    const getCategories = useCallback(async (): Promise<string[]> => {
        const response = await window.fetch(`${API_BASE}/categories`);

        if (!response.ok) {
            return [];
        }

        const cats = await response.json();
        setCategories(cats);
        return cats;
    }, []);

    return {
        products,
        meta,
        isLoading,
        error,
        fetch,
        create,
        update,
        remove,
        getById,
        getStock,
        getHistory,
        getCategories,
        categories,
    };
}
