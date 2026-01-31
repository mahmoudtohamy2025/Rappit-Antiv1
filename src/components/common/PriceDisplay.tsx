/**
 * Price Display Component
 * Formatted price display with currency
 */

import { formatPrice, getCurrency } from '../../lib/currency';

interface PriceDisplayProps {
    amount: number;
    currency?: string;
    className?: string;
    showCurrencyCode?: boolean;
}

export function PriceDisplay({
    amount,
    currency = 'SAR',
    className = '',
    showCurrencyCode = false,
}: PriceDisplayProps) {
    const formatted = formatPrice(amount, currency);
    const currencyInfo = getCurrency(currency);

    return (
        <span className={`font-medium ${className}`} dir="ltr">
            {formatted}
            {showCurrencyCode && currencyInfo && (
                <span className="text-muted-foreground text-xs mr-1">
                    ({currencyInfo.code})
                </span>
            )}
        </span>
    );
}
