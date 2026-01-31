// components/UI/BillingStatusBadge.tsx
// BILL-07: Subscription status display following existing StatusPill pattern

// Using inline SVG to avoid lucide-react type conflicts
const CreditCardIcon = () => (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" strokeWidth="2" />
        <line x1="1" y1="10" x2="23" y2="10" strokeWidth="2" />
    </svg>
);

export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELLED';

interface BillingStatusBadgeProps {
    status: SubscriptionStatus;
    trialDaysRemaining?: number;
    className?: string;
    showIcon?: boolean;
}

/**
 * BillingStatusBadge - Displays subscription status with appropriate styling
 * 
 * Colors follow existing StatusPill pattern:
 * - TRIAL: Blue (info)
 * - ACTIVE: Green (success)
 * - PAST_DUE: Orange (warning)
 * - SUSPENDED: Red (danger)
 * - CANCELLED: Gray (neutral)
 */
export function BillingStatusBadge({
    status,
    trialDaysRemaining,
    className = '',
    showIcon = false,
}: BillingStatusBadgeProps) {
    const getStatusColor = (status: SubscriptionStatus): string => {
        const colors: Record<SubscriptionStatus, string> = {
            TRIAL: 'bg-blue-100 text-blue-700 border-blue-200',
            ACTIVE: 'bg-green-100 text-green-700 border-green-200',
            PAST_DUE: 'bg-orange-100 text-orange-700 border-orange-200',
            SUSPENDED: 'bg-red-100 text-red-700 border-red-200',
            CANCELLED: 'bg-gray-100 text-gray-700 border-gray-200',
        };
        return colors[status] || colors.CANCELLED;
    };

    const getStatusLabel = (status: SubscriptionStatus): string => {
        const labels: Record<SubscriptionStatus, string> = {
            TRIAL: trialDaysRemaining !== undefined
                ? `تجريبي - ${trialDaysRemaining} يوم متبقي`
                : 'تجريبي',
            ACTIVE: 'نشط',
            PAST_DUE: 'مستحق الدفع',
            SUSPENDED: 'معلق',
            CANCELLED: 'ملغي',
        };
        return labels[status] || status;
    };

    return (
        <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                status
            )} ${className}`}
            data-testid="billing-status-badge"
            data-status={status}
        >
            {showIcon && <CreditCardIcon />}
            {getStatusLabel(status)}
        </span>
    );
}

/**
 * Calculate days remaining in trial
 * @param trialEndsAt - Trial end date
 * @returns Number of days remaining (0 if expired)
 */
export function calculateTrialDaysRemaining(trialEndsAt: Date | string | null): number {
    if (!trialEndsAt) return 0;

    const endDate = typeof trialEndsAt === 'string' ? new Date(trialEndsAt) : trialEndsAt;
    const now = new Date();
    const diffMs = endDate.getTime() - now.getTime();
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    return Math.max(0, days); // Don't return negative
}

export default BillingStatusBadge;
