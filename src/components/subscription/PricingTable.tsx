/**
 * Pricing Table Component
 * Customer-facing pricing display
 * 
 * Part of: GAP-15 Subscription Tiers
 */

import { useState, useEffect } from 'react';
import { Check, X, Star, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../../UI/card';
import { Button } from '../../UI/button';
import { Badge } from '../../UI/badge';
import { Switch } from '../../UI/switch';
import { useSubscriptionPlans, SubscriptionPlan } from '../../../hooks/useSubscriptionPlans';

interface PricingTableProps {
    onSelectPlan?: (planId: string, isYearly: boolean) => void;
    currentPlanId?: string;
    showPublicOnly?: boolean;
}

const FEATURE_LABELS: Record<string, string> = {
    maxUsers: 'المستخدمين',
    maxWarehouses: 'المستودعات',
    maxSkus: 'المنتجات (SKU)',
    maxOrdersPerMonth: 'الطلبات/شهر',
    apiAccess: 'الوصول للـ API',
    supportLevel: 'الدعم الفني',
};

const SUPPORT_LABELS: Record<string, string> = {
    basic: 'أساسي',
    priority: 'أولوية',
    dedicated: 'مخصص',
};

export function PricingTable({ onSelectPlan, currentPlanId, showPublicOnly = true }: PricingTableProps) {
    const { plans, isLoading, getPlans, getPublicPlans } = useSubscriptionPlans();
    const [displayPlans, setDisplayPlans] = useState<SubscriptionPlan[]>([]);
    const [isYearly, setIsYearly] = useState(false);

    useEffect(() => {
        async function loadPlans() {
            if (showPublicOnly) {
                const publicPlans = await getPublicPlans();
                setDisplayPlans(publicPlans.filter(p => p.isActive).sort((a, b) => a.sortOrder - b.sortOrder));
            } else {
                await getPlans(true);
            }
        }
        loadPlans();
    }, [showPublicOnly, getPlans, getPublicPlans]);

    useEffect(() => {
        if (!showPublicOnly && plans.length > 0) {
            setDisplayPlans(plans.filter(p => p.isActive).sort((a, b) => a.sortOrder - b.sortOrder));
        }
    }, [plans, showPublicOnly]);

    const formatPrice = (price: number, currency = 'SAR') => {
        return `${price.toLocaleString('ar-SA')} ${currency === 'SAR' ? 'ر.س' : currency}`;
    };

    const getYearlySavings = (monthly: number, yearly: number) => {
        const monthlyCost = monthly * 12;
        const savings = monthlyCost - yearly;
        const percent = Math.round((savings / monthlyCost) * 100);
        return percent;
    };

    if (isLoading && displayPlans.length === 0) {
        return (
            <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6" dir="rtl">
            {/* Billing Toggle */}
            <div className="flex items-center justify-center gap-4">
                <span className={!isYearly ? 'font-medium' : 'text-muted-foreground'}>شهري</span>
                <Switch checked={isYearly} onCheckedChange={setIsYearly} />
                <span className={isYearly ? 'font-medium' : 'text-muted-foreground'}>
                    سنوي
                    <Badge variant="secondary" className="mr-2">وفر 20%</Badge>
                </span>
            </div>

            {/* Plans Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {displayPlans.map((plan) => {
                    const price = isYearly ? plan.priceYearly : plan.priceMonthly;
                    const savings = getYearlySavings(plan.priceMonthly, plan.priceYearly);
                    const isCurrentPlan = plan.id === currentPlanId;

                    return (
                        <Card
                            key={plan.id}
                            className={`relative ${plan.isPopular ? 'border-primary shadow-lg scale-105' : ''} ${isCurrentPlan ? 'ring-2 ring-primary' : ''
                                }`}
                        >
                            {/* Popular Badge */}
                            {plan.isPopular && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                    <Badge className="gap-1 bg-primary">
                                        <Star className="w-3 h-3" />
                                        الأكثر شيوعاً
                                    </Badge>
                                </div>
                            )}

                            <CardHeader className="text-center pb-2">
                                <CardTitle className="text-xl">{plan.nameAr || plan.name}</CardTitle>
                                {plan.descriptionAr && (
                                    <p className="text-sm text-muted-foreground">{plan.descriptionAr}</p>
                                )}
                            </CardHeader>

                            <CardContent className="text-center">
                                {/* Pricing */}
                                <div className="mb-6">
                                    <span className="text-4xl font-bold">{formatPrice(price)}</span>
                                    <span className="text-muted-foreground">
                                        /{isYearly ? 'سنة' : 'شهر'}
                                    </span>
                                    {isYearly && savings > 0 && (
                                        <p className="text-sm text-green-600 mt-1">
                                            وفر {savings}%
                                        </p>
                                    )}
                                </div>

                                {/* Features */}
                                <ul className="space-y-3 text-sm text-right">
                                    <li className="flex items-center gap-2">
                                        <Check className="w-4 h-4 text-green-600" />
                                        <span>{plan.features.maxUsers} {FEATURE_LABELS.maxUsers}</span>
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <Check className="w-4 h-4 text-green-600" />
                                        <span>{plan.features.maxWarehouses} {FEATURE_LABELS.maxWarehouses}</span>
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <Check className="w-4 h-4 text-green-600" />
                                        <span>{plan.features.maxSkus.toLocaleString()} {FEATURE_LABELS.maxSkus}</span>
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <Check className="w-4 h-4 text-green-600" />
                                        <span>{plan.features.maxOrdersPerMonth.toLocaleString()} {FEATURE_LABELS.maxOrdersPerMonth}</span>
                                    </li>
                                    <li className="flex items-center gap-2">
                                        {plan.features.apiAccess ? (
                                            <Check className="w-4 h-4 text-green-600" />
                                        ) : (
                                            <X className="w-4 h-4 text-gray-400" />
                                        )}
                                        <span className={!plan.features.apiAccess ? 'text-muted-foreground' : ''}>
                                            {FEATURE_LABELS.apiAccess}
                                        </span>
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <Check className="w-4 h-4 text-green-600" />
                                        <span>دعم {SUPPORT_LABELS[plan.features.supportLevel]}</span>
                                    </li>
                                    {plan.features.integrations.length > 0 && (
                                        <li className="flex items-center gap-2">
                                            <Check className="w-4 h-4 text-green-600" />
                                            <span>تكاملات: {plan.features.integrations.join(', ')}</span>
                                        </li>
                                    )}
                                </ul>
                            </CardContent>

                            <CardFooter>
                                <Button
                                    onClick={() => onSelectPlan?.(plan.id, isYearly)}
                                    className="w-full"
                                    variant={plan.isPopular ? 'default' : 'outline'}
                                    disabled={isCurrentPlan}
                                >
                                    {isCurrentPlan ? 'خطتك الحالية' : 'اختر هذه الخطة'}
                                </Button>
                            </CardFooter>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
