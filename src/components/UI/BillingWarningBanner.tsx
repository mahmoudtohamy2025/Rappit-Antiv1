// components/UI/BillingWarningBanner.tsx
// BILL-07: Warning banner for PAST_DUE and SUSPENDED subscription statuses

import { useState } from 'react';
import type { SubscriptionStatus } from './BillingStatusBadge';

// Inline SVG icons to avoid lucide-react type conflicts
const AlertTriangleIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
);

const CreditCardIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" strokeWidth="2" />
        <line x1="1" y1="10" x2="23" y2="10" strokeWidth="2" />
    </svg>
);

const XIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
    </svg>
);

interface BillingWarningBannerProps {
    status: SubscriptionStatus;
    billingPortalUrl?: string;
    onManageBilling?: () => void;
    dismissable?: boolean;
}

/**
 * BillingWarningBanner - Displays prominent warning for payment issues
 * 
 * Shows for:
 * - PAST_DUE: Orange warning - payment overdue, action needed
 * - SUSPENDED: Red critical - account suspended, immediate action required
 */
export function BillingWarningBanner({
    status,
    billingPortalUrl = '/settings/billing',
    onManageBilling,
    dismissable = false,
}: BillingWarningBannerProps) {
    const [dismissed, setDismissed] = useState(false);

    // Only show for PAST_DUE and SUSPENDED
    if (!['PAST_DUE', 'SUSPENDED'].includes(status) || dismissed) {
        return null;
    }

    const isPastDue = status === 'PAST_DUE';
    const isSuspended = status === 'SUSPENDED';

    const getBannerStyle = (): string => {
        if (isSuspended) {
            return 'bg-red-50 border-red-200 text-red-800';
        }
        return 'bg-orange-50 border-orange-200 text-orange-800';
    };

    const getIconColor = (): string => {
        return isSuspended ? 'text-red-500' : 'text-orange-500';
    };

    const getMessage = (): { title: string; description: string } => {
        if (isSuspended) {
            return {
                title: 'تم تعليق حسابك',
                description: 'يرجى تحديث طريقة الدفع لاستعادة الوصول الكامل إلى حسابك.',
            };
        }
        return {
            title: 'الدفع مستحق',
            description: 'لديك فاتورة مستحقة الدفع. يرجى تحديث معلومات الدفع لتجنب تعليق الحساب.',
        };
    };

    const { title, description } = getMessage();

    const handleClick = () => {
        if (onManageBilling) {
            onManageBilling();
        } else if (billingPortalUrl) {
            window.location.href = billingPortalUrl;
        }
    };

    return (
        <div
            className={`relative border-b ${getBannerStyle()} py-3 px-4`}
            role="alert"
            data-testid="billing-warning-banner"
            data-status={status}
        >
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <AlertTriangleIcon className={`w-5 h-5 flex-shrink-0 ${getIconColor()}`} />
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                        <span className="font-semibold">{title}</span>
                        <span className="text-sm opacity-90">{description}</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleClick}
                        className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${isSuspended
                            ? 'bg-red-600 text-white hover:bg-red-700'
                            : 'bg-orange-600 text-white hover:bg-orange-700'
                            }`}
                    >
                        <CreditCardIcon className="w-4 h-4" />
                        <span>تحديث الدفع</span>
                    </button>

                    {dismissable && (
                        <button
                            onClick={() => setDismissed(true)}
                            className="p-1 rounded hover:bg-black/10 transition-colors"
                            aria-label="إغلاق"
                        >
                            <XIcon className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default BillingWarningBanner;
