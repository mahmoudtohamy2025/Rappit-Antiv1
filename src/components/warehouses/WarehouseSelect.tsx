/**
 * Warehouse Select Component
 * Reusable dropdown for selecting a warehouse
 */

import { useEffect, useState } from 'react';
import { Warehouse as WarehouseIcon } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../UI/select';
import { Label } from '../UI/label';
import { useWarehouses, Warehouse } from '../../hooks/useWarehouses';

interface WarehouseSelectProps {
    value?: string;
    onValueChange: (value: string) => void;
    label?: string;
    placeholder?: string;
    required?: boolean;
    disabled?: boolean;
    showStats?: boolean;
}

export function WarehouseSelect({
    value,
    onValueChange,
    label = 'المستودع',
    placeholder = 'اختر المستودع',
    required = false,
    disabled = false,
    showStats = false,
}: WarehouseSelectProps) {
    const { warehouses, fetch, isLoading } = useWarehouses();

    useEffect(() => {
        fetch({ isActive: true });
    }, []);

    return (
        <div className="space-y-2">
            {label && (
                <Label className="flex items-center gap-1">
                    <WarehouseIcon className="w-4 h-4" />
                    {label}
                    {required && <span className="text-red-500">*</span>}
                </Label>
            )}
            <Select
                value={value}
                onValueChange={onValueChange}
                disabled={disabled || isLoading}
            >
                <SelectTrigger>
                    <SelectValue placeholder={isLoading ? 'جاري التحميل...' : placeholder} />
                </SelectTrigger>
                <SelectContent>
                    {warehouses.map((warehouse) => (
                        <SelectItem key={warehouse.id} value={warehouse.id}>
                            <div className="flex items-center justify-between w-full gap-2">
                                <span>{warehouse.name}</span>
                                {warehouse.isDefault && (
                                    <span className="text-xs text-muted-foreground">(افتراضي)</span>
                                )}
                            </div>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
