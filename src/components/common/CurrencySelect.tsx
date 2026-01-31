/**
 * Currency Select Component
 * Reusable dropdown for selecting a currency
 */

import { DollarSign } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../UI/select';
import { Label } from '../UI/label';
import { CURRENCIES, Currency } from '../../lib/currency';

interface CurrencySelectProps {
    value?: string;
    onValueChange: (value: string) => void;
    label?: string;
    placeholder?: string;
    required?: boolean;
    disabled?: boolean;
    supportedOnly?: string[];
}

export function CurrencySelect({
    value,
    onValueChange,
    label = 'العملة',
    placeholder = 'اختر العملة',
    required = false,
    disabled = false,
    supportedOnly,
}: CurrencySelectProps) {
    const currencies = supportedOnly
        ? CURRENCIES.filter(c => supportedOnly.includes(c.code))
        : CURRENCIES;

    return (
        <div className="space-y-2">
            {label && (
                <Label className="flex items-center gap-1">
                    <DollarSign className="w-4 h-4" />
                    {label}
                    {required && <span className="text-red-500">*</span>}
                </Label>
            )}
            <Select
                value={value}
                onValueChange={onValueChange}
                disabled={disabled}
            >
                <SelectTrigger>
                    <SelectValue placeholder={placeholder} />
                </SelectTrigger>
                <SelectContent>
                    {currencies.map((currency) => (
                        <SelectItem key={currency.code} value={currency.code}>
                            <div className="flex items-center gap-2">
                                <span className="font-bold">{currency.symbol}</span>
                                <span>{currency.nameAr}</span>
                                <span className="text-muted-foreground text-xs">({currency.code})</span>
                            </div>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
