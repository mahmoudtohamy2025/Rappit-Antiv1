/**
 * BillingStatusBadge Unit Tests (BILL-07)
 * 
 * Tests billing status display:
 * - Badge renders correct color for each status
 * - Warning banner renders for SUSPENDED
 * - Trial countdown calculates correctly
 */

import { render, screen } from '@testing-library/react';
import {
    BillingStatusBadge,
    calculateTrialDaysRemaining,
    type SubscriptionStatus
} from '../BillingStatusBadge';
import { BillingWarningBanner } from '../BillingWarningBanner';

describe('BillingStatusBadge', () => {
    describe('renders correct color for each status', () => {
        const statusColors: Record<SubscriptionStatus, string> = {
            TRIAL: 'bg-blue-100',
            ACTIVE: 'bg-green-100',
            PAST_DUE: 'bg-orange-100',
            SUSPENDED: 'bg-red-100',
            CANCELLED: 'bg-gray-100',
        };

        Object.entries(statusColors).forEach(([status, expectedColor]) => {
            it(`renders ${expectedColor} for ${status} status`, () => {
                render(<BillingStatusBadge status={status as SubscriptionStatus} />);

                const badge = screen.getByTestId('billing-status-badge');
                expect(badge).toHaveClass(expectedColor);
                expect(badge).toHaveAttribute('data-status', status);
            });
        });
    });

    describe('Arabic labels', () => {
        it('renders "نشط" for ACTIVE status', () => {
            render(<BillingStatusBadge status="ACTIVE" />);
            expect(screen.getByText('نشط')).toBeInTheDocument();
        });

        it('renders "معلق" for SUSPENDED status', () => {
            render(<BillingStatusBadge status="SUSPENDED" />);
            expect(screen.getByText('معلق')).toBeInTheDocument();
        });

        it('renders "مستحق الدفع" for PAST_DUE status', () => {
            render(<BillingStatusBadge status="PAST_DUE" />);
            expect(screen.getByText('مستحق الدفع')).toBeInTheDocument();
        });

        it('renders "ملغي" for CANCELLED status', () => {
            render(<BillingStatusBadge status="CANCELLED" />);
            expect(screen.getByText('ملغي')).toBeInTheDocument();
        });
    });

    describe('trial countdown', () => {
        it('shows days remaining when provided', () => {
            render(<BillingStatusBadge status="TRIAL" trialDaysRemaining={7} />);
            expect(screen.getByText('تجريبي - 7 يوم متبقي')).toBeInTheDocument();
        });

        it('shows just "تجريبي" when no days provided', () => {
            render(<BillingStatusBadge status="TRIAL" />);
            expect(screen.getByText('تجريبي')).toBeInTheDocument();
        });
    });
});

describe('calculateTrialDaysRemaining', () => {
    it('calculates days remaining correctly', () => {
        const now = new Date();
        const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        const result = calculateTrialDaysRemaining(sevenDaysFromNow);

        expect(result).toBe(7);
    });

    it('returns 0 for past dates', () => {
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const result = calculateTrialDaysRemaining(yesterday);

        expect(result).toBe(0);
    });

    it('returns 0 for null', () => {
        expect(calculateTrialDaysRemaining(null)).toBe(0);
    });

    it('handles string dates', () => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 14);

        const result = calculateTrialDaysRemaining(futureDate.toISOString());

        expect(result).toBe(14);
    });
});

describe('BillingWarningBanner', () => {
    describe('renders for SUSPENDED', () => {
        it('renders warning banner with red styling', () => {
            render(<BillingWarningBanner status="SUSPENDED" />);

            const banner = screen.getByTestId('billing-warning-banner');
            expect(banner).toBeInTheDocument();
            expect(banner).toHaveAttribute('data-status', 'SUSPENDED');
            expect(banner).toHaveClass('bg-red-50');
        });

        it('shows "تم تعليق حسابك" message', () => {
            render(<BillingWarningBanner status="SUSPENDED" />);
            expect(screen.getByText('تم تعليق حسابك')).toBeInTheDocument();
        });
    });

    describe('renders for PAST_DUE', () => {
        it('renders warning banner with orange styling', () => {
            render(<BillingWarningBanner status="PAST_DUE" />);

            const banner = screen.getByTestId('billing-warning-banner');
            expect(banner).toBeInTheDocument();
            expect(banner).toHaveClass('bg-orange-50');
        });

        it('shows "الدفع مستحق" message', () => {
            render(<BillingWarningBanner status="PAST_DUE" />);
            expect(screen.getByText('الدفع مستحق')).toBeInTheDocument();
        });
    });

    describe('does not render for other statuses', () => {
        const otherStatuses: SubscriptionStatus[] = ['TRIAL', 'ACTIVE', 'CANCELLED'];

        otherStatuses.forEach((status) => {
            it(`does not render for ${status}`, () => {
                render(<BillingWarningBanner status={status} />);
                expect(screen.queryByTestId('billing-warning-banner')).not.toBeInTheDocument();
            });
        });
    });

    it('has "تحديث الدفع" button', () => {
        render(<BillingWarningBanner status="SUSPENDED" />);
        expect(screen.getByText('تحديث الدفع')).toBeInTheDocument();
    });
});
