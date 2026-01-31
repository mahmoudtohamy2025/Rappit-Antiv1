/**
 * Process Return Modal
 * Handle customer returns with condition tracking (Sellable/Damaged)
 */

import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '../UI/dialog';
import { Button } from '../UI/button';
import { Label } from '../UI/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../UI/select';

interface ShippedItem {
    id: string;
    skuId: string;
    name: string;
    shippedQuantity: number;
    returnedQuantity: number;
}

interface Warehouse {
    id: string;
    name: string;
}

interface ProcessReturnModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    orderId: string;
    shippedItems: ShippedItem[];
    warehouses: Warehouse[];
    onSubmit: (data: ReturnData) => Promise<void>;
}

interface ReturnItemData {
    skuId: string;
    quantity: number;
    condition: 'SELLABLE' | 'DAMAGED';
    warehouseId: string;
}

interface ReturnData {
    orderId: string;
    items: ReturnItemData[];
}

const CONDITIONS = [
    { value: 'SELLABLE', label: 'قابل للبيع', description: 'سيتم إرجاعه للمخزون المتاح' },
    { value: 'DAMAGED', label: 'تالف', description: 'سيتم تسجيله كتالف' },
];

export function ProcessReturnModal({
    open,
    onOpenChange,
    orderId,
    shippedItems,
    warehouses,
    onSubmit,
}: ProcessReturnModalProps) {
    const [selectedItems, setSelectedItems] = useState<Record<string, ReturnItemData>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Initialize selected items
    useEffect(() => {
        if (open) {
            const initial: Record<string, ReturnItemData> = {};
            shippedItems.forEach(item => {
                const returnable = item.shippedQuantity - item.returnedQuantity;
                if (returnable > 0) {
                    initial[item.skuId] = {
                        skuId: item.skuId,
                        quantity: 0,
                        condition: 'SELLABLE',
                        warehouseId: warehouses[0]?.id || '',
                    };
                }
            });
            setSelectedItems(initial);
        }
    }, [open, shippedItems, warehouses]);

    const handleQuantityChange = (skuId: string, value: string) => {
        const qty = parseInt(value) || 0;
        const item = shippedItems.find(i => i.skuId === skuId);
        if (!item) return;

        const maxQty = item.shippedQuantity - item.returnedQuantity;
        const validQty = Math.min(Math.max(0, qty), maxQty);

        setSelectedItems(prev => ({
            ...prev,
            [skuId]: { ...prev[skuId], quantity: validQty }
        }));
    };

    const handleConditionChange = (skuId: string, condition: 'SELLABLE' | 'DAMAGED') => {
        setSelectedItems(prev => ({
            ...prev,
            [skuId]: { ...prev[skuId], condition }
        }));
    };

    const handleWarehouseChange = (skuId: string, warehouseId: string) => {
        setSelectedItems(prev => ({
            ...prev,
            [skuId]: { ...prev[skuId], warehouseId }
        }));
    };

    const hasItemsToReturn = Object.values(selectedItems).some(item => item.quantity > 0);

    const handleSubmit = async () => {
        if (!hasItemsToReturn) return;

        setIsSubmitting(true);
        try {
            const items = Object.values(selectedItems).filter(item => item.quantity > 0);

            await onSubmit({
                orderId,
                items,
            });
            onOpenChange(false);
        } catch (error) {
            console.error('Failed to process return:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const totalItemsToReturn = Object.values(selectedItems).reduce((a, b) => a + b.quantity, 0);
    const sellableCount = Object.values(selectedItems)
        .filter(i => i.condition === 'SELLABLE')
        .reduce((a, b) => a + b.quantity, 0);
    const damagedCount = Object.values(selectedItems)
        .filter(i => i.condition === 'DAMAGED')
        .reduce((a, b) => a + b.quantity, 0);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl" dir="rtl">
                <DialogHeader>
                    <DialogTitle>معالجة المرتجعات</DialogTitle>
                    <DialogDescription>
                        سجل المنتجات المرتجعة وحالتها
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Items Table */}
                    <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50">
                                <tr>
                                    <th className="px-3 py-2 text-right font-medium">المنتج</th>
                                    <th className="px-3 py-2 text-center font-medium">متاح للإرجاع</th>
                                    <th className="px-3 py-2 text-center font-medium">الكمية</th>
                                    <th className="px-3 py-2 text-center font-medium">الحالة</th>
                                    <th className="px-3 py-2 text-center font-medium">المستودع</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {shippedItems.map(item => {
                                    const returnable = item.shippedQuantity - item.returnedQuantity;
                                    const isFullyReturned = returnable === 0;
                                    const selected = selectedItems[item.skuId];

                                    return (
                                        <tr key={item.id} className={isFullyReturned ? 'opacity-50' : ''}>
                                            <td className="px-3 py-2">
                                                <div className="font-medium">{item.name}</div>
                                                <div className="text-xs text-muted-foreground">{item.skuId}</div>
                                            </td>
                                            <td className="px-3 py-2 text-center">{returnable}</td>
                                            <td className="px-3 py-2 text-center">
                                                {isFullyReturned ? (
                                                    <span className="text-green-600">✓</span>
                                                ) : (
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max={returnable}
                                                        value={selected?.quantity || 0}
                                                        onChange={(e) => handleQuantityChange(item.skuId, e.target.value)}
                                                        className="w-16 px-2 py-1 border rounded text-center text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                                    />
                                                )}
                                            </td>
                                            <td className="px-3 py-2">
                                                {!isFullyReturned && selected?.quantity > 0 && (
                                                    <Select
                                                        value={selected?.condition}
                                                        onValueChange={(v) => handleConditionChange(item.skuId, v as 'SELLABLE' | 'DAMAGED')}
                                                    >
                                                        <SelectTrigger className="h-8">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {CONDITIONS.map((c) => (
                                                                <SelectItem key={c.value} value={c.value}>
                                                                    {c.label}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                )}
                                            </td>
                                            <td className="px-3 py-2">
                                                {!isFullyReturned && selected?.quantity > 0 && (
                                                    <Select
                                                        value={selected?.warehouseId}
                                                        onValueChange={(v) => handleWarehouseChange(item.skuId, v)}
                                                    >
                                                        <SelectTrigger className="h-8">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {warehouses.map((wh) => (
                                                                <SelectItem key={wh.id} value={wh.id}>
                                                                    {wh.name}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Summary */}
                    <div className="p-3 bg-muted/30 rounded-lg text-sm space-y-1">
                        <div className="flex justify-between">
                            <span>إجمالي المرتجعات:</span>
                            <span className="font-semibold">{totalItemsToReturn} وحدة</span>
                        </div>
                        {sellableCount > 0 && (
                            <div className="flex justify-between text-green-600">
                                <span>قابل للبيع:</span>
                                <span>{sellableCount} وحدة</span>
                            </div>
                        )}
                        {damagedCount > 0 && (
                            <div className="flex justify-between text-red-500">
                                <span>تالف:</span>
                                <span>{damagedCount} وحدة</span>
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        إلغاء
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={!hasItemsToReturn || isSubmitting}
                    >
                        {isSubmitting ? 'جاري المعالجة...' : 'تأكيد المرتجعات'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
