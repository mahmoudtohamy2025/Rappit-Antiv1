/**
 * Billing Page Component
 * Main billing management page
 * 
 * Part of: GAP-16 Billing Page
 */

import { useEffect, useState } from 'react';
import {
    CreditCard,
    FileText,
    AlertTriangle,
    Loader2,
    ExternalLink,
    Calendar,
    Check,
    X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../../UI/card';
import { Button } from '../../UI/button';
import { Badge } from '../../UI/badge';
import { useBilling, Subscription, PaymentMethod, Invoice, SubscriptionStatus } from '../../../hooks/useBilling';

// ============================================================
// STATUS CONFIG
// ============================================================

const STATUS_CONFIG: Record<SubscriptionStatus, { label: string; color: string }> = {
    TRIAL: { label: 'تجريبي', color: 'bg-blue-100 text-blue-800' },
    ACTIVE: { label: 'نشط', color: 'bg-green-100 text-green-800' },
    PAST_DUE: { label: 'متأخر', color: 'bg-red-100 text-red-800' },
    CANCELLED: { label: 'ملغي', color: 'bg-gray-100 text-gray-800' },
    EXPIRED: { label: 'منتهي', color: 'bg-orange-100 text-orange-800' },
};

// ============================================================
// CURRENT PLAN CARD
// ============================================================

function CurrentPlanCard({ subscription, onUpgrade, onManage }: {
    subscription: Subscription;
    onUpgrade: () => void;
    onManage: () => void;
}) {
    const statusConfig = STATUS_CONFIG[subscription.status];
    const periodEnd = new Date(subscription.currentPeriodEnd);
    const daysRemaining = Math.ceil((periodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    // Trial days
    const trialDays = subscription.trialEndsAt
        ? Math.ceil((new Date(subscription.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null;

    return (
        <Card dir="rtl">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <Calendar className="w-5 h-5" />
                        الخطة الحالية
                    </CardTitle>
                    <Badge className={`${statusConfig.color} border-0`}>
                        {statusConfig.label}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <h3 className="text-2xl font-bold">{subscription.planNameAr || subscription.planName}</h3>
                    <p className="text-muted-foreground">
                        {subscription.priceMonthly} ر.س / {subscription.billingInterval === 'yearly' ? 'سنة' : 'شهر'}
                    </p>
                </div>

                {/* Trial Warning */}
                {trialDays !== null && trialDays > 0 && trialDays <= 7 && (
                    <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
                        <AlertTriangle className="w-4 h-4" />
                        تنتهي الفترة التجريبية خلال {trialDays} أيام
                    </div>
                )}

                {/* Past Due Warning */}
                {subscription.status === 'PAST_DUE' && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-center gap-2 text-red-700 dark:text-red-300">
                        <AlertTriangle className="w-4 h-4" />
                        الدفعة متأخرة. يرجى تحديث طريقة الدفع.
                    </div>
                )}

                {/* Cancellation Notice */}
                {subscription.cancelAtPeriodEnd && (
                    <div className="p-3 bg-gray-50 dark:bg-gray-900/20 rounded-lg text-gray-700 dark:text-gray-300">
                        سيتم إلغاء اشتراكك في {periodEnd.toLocaleDateString('ar-SA')}
                    </div>
                )}

                <div className="text-sm text-muted-foreground">
                    {subscription.cancelAtPeriodEnd ? 'ينتهي في' : 'يتجدد في'}: {periodEnd.toLocaleDateString('ar-SA')}
                    {!subscription.cancelAtPeriodEnd && ` (${daysRemaining} يوم)`}
                </div>
            </CardContent>
            <CardFooter className="gap-2">
                <Button onClick={onUpgrade}>ترقية الخطة</Button>
                <Button variant="outline" onClick={onManage}>
                    إدارة الاشتراك
                    <ExternalLink className="w-4 h-4 mr-2" />
                </Button>
            </CardFooter>
        </Card>
    );
}

// ============================================================
// PAYMENT METHOD CARD
// ============================================================

function PaymentMethodCard({ paymentMethod, onUpdate }: {
    paymentMethod: PaymentMethod | null;
    onUpdate: () => void;
}) {
    const brandLogos: Record<string, string> = {
        visa: '💳 Visa',
        mastercard: '💳 Mastercard',
        amex: '💳 Amex',
    };

    return (
        <Card dir="rtl">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5" />
                    طريقة الدفع
                </CardTitle>
            </CardHeader>
            <CardContent>
                {paymentMethod ? (
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">{brandLogos[paymentMethod.brand.toLowerCase()] || '💳'}</span>
                            <div>
                                <p className="font-medium">•••• {paymentMethod.last4}</p>
                                <p className="text-sm text-muted-foreground">
                                    تنتهي {paymentMethod.expiryMonth}/{paymentMethod.expiryYear}
                                </p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <p className="text-muted-foreground">لم تتم إضافة طريقة دفع</p>
                )}
            </CardContent>
            <CardFooter>
                <Button variant="outline" onClick={onUpdate}>
                    {paymentMethod ? 'تحديث' : 'إضافة بطاقة'}
                </Button>
            </CardFooter>
        </Card>
    );
}

// ============================================================
// INVOICE HISTORY
// ============================================================

function InvoiceHistory({ invoices }: { invoices: Invoice[] }) {
    const statusLabels: Record<string, { label: string; color: string }> = {
        PAID: { label: 'مدفوع', color: 'text-green-600' },
        OPEN: { label: 'مفتوح', color: 'text-yellow-600' },
        VOID: { label: 'ملغي', color: 'text-gray-600' },
        DRAFT: { label: 'مسودة', color: 'text-blue-600' },
    };

    return (
        <Card dir="rtl">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    سجل الفواتير
                </CardTitle>
            </CardHeader>
            <CardContent>
                {invoices.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">لا توجد فواتير</p>
                ) : (
                    <div className="space-y-2">
                        {invoices.map((invoice) => {
                            const statusConfig = statusLabels[invoice.status] || statusLabels.OPEN;
                            return (
                                <div key={invoice.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                                    <div>
                                        <p className="font-medium">{invoice.number}</p>
                                        <p className="text-sm text-muted-foreground">
                                            {new Date(invoice.date).toLocaleDateString('ar-SA')}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className={`text-sm ${statusConfig.color}`}>
                                            {statusConfig.label}
                                        </span>
                                        <span className="font-medium">{invoice.amount} ر.س</span>
                                        {invoice.pdfUrl && (
                                            <Button variant="ghost" size="icon" asChild>
                                                <a href={invoice.pdfUrl} target="_blank" rel="noopener noreferrer">
                                                    <FileText className="w-4 h-4" />
                                                </a>
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// ============================================================
// MAIN BILLING PAGE
// ============================================================

export function BillingPage() {
    const {
        subscription,
        paymentMethod,
        invoices,
        isLoading,
        error,
        getSubscription,
        getPaymentMethod,
        getInvoices,
        openCustomerPortal,
    } = useBilling();

    const [showUpgradeModal, setShowUpgradeModal] = useState(false);

    useEffect(() => {
        getSubscription();
        getPaymentMethod();
        getInvoices();
    }, [getSubscription, getPaymentMethod, getInvoices]);

    if (isLoading && !subscription) {
        return (
            <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8 text-center" dir="rtl">
                <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-red-500" />
                <h2 className="text-xl font-bold mb-2">خطأ في التحميل</h2>
                <p className="text-muted-foreground">{error.message}</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 p-6" dir="rtl">
            <div>
                <h1 className="text-2xl font-bold">الفوترة والاشتراك</h1>
                <p className="text-muted-foreground">إدارة خطتك وطريقة الدفع</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {subscription && (
                    <CurrentPlanCard
                        subscription={subscription}
                        onUpgrade={() => setShowUpgradeModal(true)}
                        onManage={openCustomerPortal}
                    />
                )}
                <PaymentMethodCard
                    paymentMethod={paymentMethod}
                    onUpdate={openCustomerPortal}
                />
            </div>

            <InvoiceHistory invoices={invoices} />
        </div>
    );
}
