/**
 * Currency Utilities
 * GAP-20: Multi-Currency Support
 * 
 * Frontend helpers for currency formatting and display
 */

export interface Currency {
    code: string;
    symbol: string;
    nameAr: string;
    nameEn: string;
    decimalPlaces: number;
    symbolPosition: 'before' | 'after';
}

export const CURRENCIES: Currency[] = [
    {
        code: 'EGP',
        symbol: 'ج.م',
        nameAr: 'الجنيه المصري',
        nameEn: 'Egyptian Pound',
        decimalPlaces: 2,
        symbolPosition: 'after',
    },
    {
        code: 'SAR',
        symbol: 'ر.س',
        nameAr: 'الريال السعودي',
        nameEn: 'Saudi Riyal',
        decimalPlaces: 2,
        symbolPosition: 'after',
    },
    {
        code: 'AED',
        symbol: 'د.إ',
        nameAr: 'الدرهم الإماراتي',
        nameEn: 'UAE Dirham',
        decimalPlaces: 2,
        symbolPosition: 'after',
    },
    {
        code: 'USD',
        symbol: '$',
        nameAr: 'الدولار الأمريكي',
        nameEn: 'US Dollar',
        decimalPlaces: 2,
        symbolPosition: 'before',
    },
    {
        code: 'EUR',
        symbol: '€',
        nameAr: 'اليورو',
        nameEn: 'Euro',
        decimalPlaces: 2,
        symbolPosition: 'before',
    },
];

/**
 * Get currency by code
 */
export function getCurrency(code: string): Currency | undefined {
    return CURRENCIES.find(c => c.code === code?.toUpperCase());
}

/**
 * Format price with currency
 */
export function formatPrice(amount: number, currencyCode: string): string {
    const currency = getCurrency(currencyCode);
    if (!currency) {
        return amount.toLocaleString('en-US', { minimumFractionDigits: 2 });
    }

    const formattedNumber = amount.toLocaleString('en-US', {
        minimumFractionDigits: currency.decimalPlaces,
        maximumFractionDigits: currency.decimalPlaces,
    });

    return currency.symbolPosition === 'before'
        ? `${currency.symbol}${formattedNumber}`
        : `${formattedNumber} ${currency.symbol}`;
}

/**
 * Format price with full currency object
 */
export function formatPriceDetailed(amount: number, currencyCode: string): {
    raw: number;
    formatted: string;
    currency: Currency | undefined;
} {
    return {
        raw: amount,
        formatted: formatPrice(amount, currencyCode),
        currency: getCurrency(currencyCode),
    };
}

/**
 * Parse formatted price to number
 */
export function parsePrice(formattedPrice: string): number {
    const cleaned = formattedPrice.replace(/[^\d.,-]/g, '').replace(/,/g, '');
    return parseFloat(cleaned) || 0;
}

/**
 * Validate currency code
 */
export function isValidCurrency(code: string): boolean {
    return CURRENCIES.some(c => c.code === code?.toUpperCase());
}

/**
 * Get default currency (SAR)
 */
export function getDefaultCurrency(): Currency {
    return CURRENCIES.find(c => c.code === 'SAR')!;
}
