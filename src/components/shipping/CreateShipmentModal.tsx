/**
 * Create Shipment Modal
 * Supports partial fulfillment - select specific items and quantities to ship
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

interface OrderItem {
    id: string;
    skuId: string;
    name: string;
    quantity: number;
    shippedQuantity: number;
}

interface CreateShipmentModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    orderId: string;
    orderItems: OrderItem[];
    onSubmit: (data: ShipmentData) => Promise<void>;
}

interface ShipmentData {
    orderId: string;
    provider: string;
    items: { skuId: string; quantity: number }[];
}

const CARRIERS = [
    { value: 'FEDEX', label: 'FedEx' },
    { value: 'DHL', label: 'DHL' },
];

export function CreateShipmentModal({
    open,
    onOpenChange,
    orderId,
    orderItems,
    onSubmit,
}: CreateShipmentModalProps) {
    const [provider, setProvider] = useState('FEDEX');
    const [selectedItems, setSelectedItems] = useState<Record<string, number>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Initialize selected items with remaining quantities
    useEffect(() => {
        if (open) {
            const initial: Record<string, number> = {};
            orderItems.forEach(item => {
                const remaining = item.quantity - item.shippedQuantity;
                if (remaining > 0) {
                    initial[item.skuId] = remaining;
                }
            });
            setSelectedItems(initial);
        }
    }, [open, orderItems]);

    const handleQuantityChange = (skuId: string, value: string) => {
        const qty = parseInt(value) || 0;
        const item = orderItems.find(i => i.skuId === skuId);
        if (!item) return;

        const maxQty = item.quantity - item.shippedQuantity;
        const validQty = Math.min(Math.max(0, qty), maxQty);

        setSelectedItems(prev => ({
            ...prev,
            [skuId]: validQty
        }));
    };

    const hasItemsToShip = Object.values(selectedItems).some(qty => qty > 0);

    const handleSubmit = async () => {
        if (!hasItemsToShip) return;

        setIsSubmitting(true);
        try {
            const items = Object.entries(selectedItems)
                .filter(([_, qty]) => qty > 0)
                .map(([skuId, quantity]) => ({ skuId, quantity }));

            await onSubmit({
                orderId,
                provider,
                items,
            });
            onOpenChange(false);
        } catch (error) {
            console.error('Failed to create shipment:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const totalItemsToShip = Object.values(selectedItems).reduce((a, b) => a + b, 0);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg" dir="rtl">
                <DialogHeader>
                    <DialogTitle>إنشاء شحنة جديدة</DialogTitle>
                    <DialogDescription>
                        اختر المنتجات والكميات لشحنها
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Carrier Selection */}
                    <div className="space-y-2">
                        <Label>شركة الشحن *</Label>
                        <Select value={provider} onValueChange={setProvider}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {CARRIERS.map((c) => (
                                    <SelectItem key={c.value} value={c.value}>
                                        {c.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Items Table */}
                    <div className="space-y-2">
                        <Label>المنتجات</Label>
                        <div className="border rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/50">
                                    <tr>
                                        <th className="px-3 py-2 text-right font-medium">المنتج</th>
                                        <th className="px-3 py-2 text-center font-medium">مطلوب</th>
                                        <th className="px-3 py-2 text-center font-medium">تم شحنه</th>
                                        <th className="px-3 py-2 text-center font-medium">للشحن</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {orderItems.map(item => {
                                        const remaining = item.quantity - item.shippedQuantity;
                                        const isFullyShipped = remaining === 0;

                                        return (
                                            <tr key={item.id} className={isFullyShipped ? 'opacity-50' : ''}>
                                                <td className="px-3 py-2">
                                                    <div className="font-medium">{item.name}</div>
                                                    <div className="text-xs text-muted-foreground">{item.skuId}</div>
                                                </td>
                                                <td className="px-3 py-2 text-center">{item.quantity}</td>
                                                <td className="px-3 py-2 text-center">
                                                    <span className={item.shippedQuantity > 0 ? 'text-green-600' : ''}>
                                                        {item.shippedQuantity}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    {isFullyShipped ? (
                                                        <span className="text-green-600">✓</span>
                                                    ) : (
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max={remaining}
                                                            value={selectedItems[item.skuId] || 0}
                                                            onChange={(e) => handleQuantityChange(item.skuId, e.target.value)}
                                                            className="w-16 px-2 py-1 border rounded text-center text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                                        />
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Summary */}
                    <div className="p-3 bg-muted/30 rounded-lg text-sm">
                        <div className="flex justify-between">
                            <span>إجمالي الكميات للشحن:</span>
                            <span className="font-semibold">{totalItemsToShip} وحدة</span>
                        </div>
                    </div>
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        إلغاء
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={!hasItemsToShip || isSubmitting}
                    >
                        {isSubmitting ? 'جاري الإنشاء...' : 'إنشاء الشحنة'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
