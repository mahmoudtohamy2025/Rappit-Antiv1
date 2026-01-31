/**
 * useBilling Hook
 * API hook for billing and subscription management
 * 
 * Part of: GAP-16 Billing Page
 */

import { useState, useCallback } from 'react';

// ============================================================
// TYPES
// ============================================================

export type SubscriptionStatus =
    | 'TRIAL'
    | 'ACTIVE'
    | 'PAST_DUE'
    | 'CANCELLED'
    | 'EXPIRED';

export interface Subscription {
    id: string;
    planId: string;
    planName: string;
    planNameAr?: string;
    status: SubscriptionStatus;
    priceMonthly: number;
    priceYearly: number;
    billingInterval: 'monthly' | 'yearly';
    currentPeriodStart: string;
    currentPeriodEnd: string;
    trialEndsAt?: string;
    cancelAtPeriodEnd: boolean;
    cancelledAt?: string;
}

export interface PaymentMethod {
    id: string;
    type: 'card';
    brand: string;
    last4: string;
    expiryMonth: number;
    expiryYear: number;
    isDefault: boolean;
}

export interface Invoice {
    id: string;
    number: string;
    amount: number;
    currency: string;
    status: 'DRAFT' | 'OPEN' | 'PAID' | 'VOID' | 'UNCOLLECTIBLE';
    date: string;
    dueDate?: string;
    paidAt?: string;
    pdfUrl?: string;
    hostedUrl?: string;
}

interface UseBillingReturn {
    subscription: Subscription | null;
    paymentMethod: PaymentMethod | null;
    invoices: Invoice[];
    isLoading: boolean;
    error: Error | null;
    getSubscription: () => Promise<void>;
    getPaymentMethod: () => Promise<void>;
    getInvoices: () => Promise<void>;
    createCheckoutSession: (planId: string, isYearly: boolean) => Promise<string>;
    openCustomerPortal: () => Promise<void>;
    cancelSubscription: () => Promise<void>;
    resumeSubscription: () => Promise<void>;
}

const API_BASE = '/api/v1/billing';

// ============================================================
// HOOK
// ============================================================

export function useBilling(): UseBillingReturn {
    const [subscription, setSubscription] = useState<Subscription | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const getSubscription = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(`${API_BASE}/subscription`);
            if (!response.ok) throw new Error('فشل تحميل الاشتراك');
            const data = await response.json();
            setSubscription(data);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Unknown error'));
        } finally {
            setIsLoading(false);
        }
    }, []);

    const getPaymentMethod = useCallback(async () => {
        try {
            const response = await fetch(`${API_BASE}/payment-method`);
            if (!response.ok) return;
            const data = await response.json();
            setPaymentMethod(data);
        } catch (err) {
            console.error('Failed to fetch payment method:', err);
        }
    }, []);

    const getInvoices = useCallback(async () => {
        try {
            const response = await fetch(`${API_BASE}/invoices`);
            if (!response.ok) throw new Error('فشل تحميل الفواتير');
            const data = await response.json();
            setInvoices(data.data || data);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Unknown error'));
        }
    }, []);

    const createCheckoutSession = useCallback(async (
        planId: string,
        isYearly: boolean
    ): Promise<string> => {
        const response = await fetch(`${API_BASE}/create-checkout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ planId, isYearly }),
        });

        if (!response.ok) throw new Error('فشل إنشاء جلسة الدفع');

        const { url } = await response.json();
        return url;
    }, []);

    const openCustomerPortal = useCallback(async () => {
        const response = await fetch(`${API_BASE}/customer-portal`, {
            method: 'POST',
        });

        if (!response.ok) throw new Error('فشل فتح بوابة العميل');

        const { url } = await response.json();
        window.open(url, '_blank');
    }, []);

    const cancelSubscription = useCallback(async () => {
        const response = await fetch(`${API_BASE}/cancel`, { method: 'POST' });
        if (!response.ok) throw new Error('فشل إلغاء الاشتراك');
        await getSubscription();
    }, [getSubscription]);

    const resumeSubscription = useCallback(async () => {
        const response = await fetch(`${API_BASE}/resume`, { method: 'POST' });
        if (!response.ok) throw new Error('فشل استئناف الاشتراك');
        await getSubscription();
    }, [getSubscription]);

    return {
        subscription,
        paymentMethod,
        invoices,
        isLoading,
        error,
        getSubscription,
        getPaymentMethod,
        getInvoices,
        createCheckoutSession,
        openCustomerPortal,
        cancelSubscription,
        resumeSubscription,
    };
}
