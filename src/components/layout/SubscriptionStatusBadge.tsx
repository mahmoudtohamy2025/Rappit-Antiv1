/**
 * Subscription Status Badge Component
 * Displays subscription status in TopBar
 * 
 * Part of: GAP-17 Subscription TopBar
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Crown,
    AlertTriangle,
    Clock,
    Sparkles,
    ChevronDown,
} from 'lucide-react';
import { Badge } from '../UI/badge';
import { Button } from '../UI/button';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '../UI/tooltip';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '../UI/dropdown-menu';
import { useBilling, SubscriptionStatus } from '../../hooks/useBilling';

// ============================================================
// CONFIG
// ============================================================

const STATUS_CONFIG: Record<SubscriptionStatus, {
    label: string;
    icon: any;
    color: string;
    bgColor: string;
}> = {
    TRIAL: {
        label: 'تجريبي',
        icon: Clock,
        color: 'text-blue-700 dark:text-blue-300',
        bgColor: 'bg-blue-100 dark:bg-blue-900/40',
    },
    ACTIVE: {
        label: 'نشط',
        icon: Crown,
        color: 'text-green-700 dark:text-green-300',
        bgColor: 'bg-green-100 dark:bg-green-900/40',
    },
    PAST_DUE: {
        label: 'متأخر',
        icon: AlertTriangle,
        color: 'text-red-700 dark:text-red-300',
        bgColor: 'bg-red-100 dark:bg-red-900/40',
    },
    CANCELLED: {
        label: 'ملغي',
        icon: AlertTriangle,
        color: 'text-gray-700 dark:text-gray-300',
        bgColor: 'bg-gray-100 dark:bg-gray-900/40',
    },
    EXPIRED: {
        label: 'منتهي',
        icon: AlertTriangle,
        color: 'text-orange-700 dark:text-orange-300',
        bgColor: 'bg-orange-100 dark:bg-orange-900/40',
    },
};

// ============================================================
// COMPONENT
// ============================================================

export function SubscriptionStatusBadge() {
    const navigate = useNavigate();
    const { subscription, isLoading, getSubscription } = useBilling();

    useEffect(() => {
        getSubscription();
    }, [getSubscription]);

    if (isLoading || !subscription) {
        return null;
    }

    const config = STATUS_CONFIG[subscription.status];
    const Icon = config.icon;

    // Calculate trial days
    const trialDays = subscription.trialEndsAt
        ? Math.max(0, Math.ceil((new Date(subscription.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : null;

    // Calculate renewal date
    const renewalDate = new Date(subscription.currentPeriodEnd).toLocaleDateString('ar-SA');

    // Tooltip text
    const tooltipText = subscription.status === 'TRIAL'
        ? `تجريبي - ${trialDays} أيام متبقية`
        : `${subscription.planNameAr || subscription.planName} - تتجدد في ${renewalDate}`;

    const goToBilling = () => navigate('/settings/billing');
    const goToUpgrade = () => navigate('/pricing');

    return (
        <div className="flex items-center gap-2" dir="rtl">
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className={`gap-2 ${config.bgColor} ${config.color} hover:opacity-80`}
                                >
                                    <Icon className="w-4 h-4" />
                                    <span className="hidden sm:inline">
                                        {subscription.status === 'TRIAL' && trialDays !== null
                                            ? `${trialDays} يوم`
                                            : config.label
                                        }
                                    </span>
                                    <ChevronDown className="w-3 h-3" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" dir="rtl">
                                <DropdownMenuItem onClick={goToBilling}>
                                    إدارة الاشتراك
                                </DropdownMenuItem>
                                {(subscription.status === 'TRIAL' || subscription.status === 'ACTIVE') && (
                                    <DropdownMenuItem onClick={goToUpgrade}>
                                        <Sparkles className="w-4 h-4 ml-2" />
                                        ترقية الخطة
                                    </DropdownMenuItem>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                        <p>{tooltipText}</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>

            {/* Past Due Warning Badge */}
            {subscription.status === 'PAST_DUE' && (
                <Badge
                    variant="destructive"
                    className="gap-1 cursor-pointer animate-pulse"
                    onClick={goToBilling}
                >
                    <AlertTriangle className="w-3 h-3" />
                    دفعة متأخرة
                </Badge>
            )}

            {/* Trial Ending Soon Warning */}
            {subscription.status === 'TRIAL' && trialDays !== null && trialDays <= 3 && (
                <Button
                    size="sm"
                    variant="default"
                    onClick={goToUpgrade}
                    className="gap-1"
                >
                    <Sparkles className="w-3 h-3" />
                    ترقية الآن
                </Button>
            )}
        </div>
    );
}
