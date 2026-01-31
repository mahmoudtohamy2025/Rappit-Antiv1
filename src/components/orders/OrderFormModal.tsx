/**
 * Order Form Modal
 * Manual order creation form
 * 
 * Part of: GAP-08 Orders Enhancements
 */

import { useState } from 'react';
import { Plus, Trash2, ShoppingCart, Loader2 } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '../../UI/dialog';
import { Button } from '../../UI/button';
import { Input } from '../../UI/input';
import { Label } from '../../UI/label';
import { Textarea } from '../../UI/textarea';
import { useOrders, CreateOrderDto } from '../../../hooks/useOrders';

interface OrderFormModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

interface OrderItemInput {
    skuId: string;
    skuName: string;
    quantity: number;
    price: number;
}

export function OrderFormModal({ open, onOpenChange, onSuccess }: OrderFormModalProps) {
    const { createOrder } = useOrders();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form state
    const [customerName, setCustomerName] = useState('');
    const [customerEmail, setCustomerEmail] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [street, setStreet] = useState('');
    const [city, setCity] = useState('');
    const [country, setCountry] = useState('السعودية');
    const [notes, setNotes] = useState('');
    const [items, setItems] = useState<OrderItemInput[]>([
        { skuId: '', skuName: '', quantity: 1, price: 0 },
    ]);

    const addItem = () => {
        setItems(prev => [...prev, { skuId: '', skuName: '', quantity: 1, price: 0 }]);
    };

    const removeItem = (index: number) => {
        setItems(prev => prev.filter((_, i) => i !== index));
    };

    const updateItem = (index: number, field: keyof OrderItemInput, value: string | number) => {
        setItems(prev => prev.map((item, i) =>
            i === index ? { ...item, [field]: value } : item
        ));
    };

    const calculateTotal = () => {
        return items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    };

    const resetForm = () => {
        setCustomerName('');
        setCustomerEmail('');
        setCustomerPhone('');
        setStreet('');
        setCity('');
        setCountry('السعودية');
        setNotes('');
        setItems([{ skuId: '', skuName: '', quantity: 1, price: 0 }]);
        setError(null);
    };

    const handleSubmit = async () => {
        // Validate
        if (!customerName.trim()) {
            setError('اسم العميل مطلوب');
            return;
        }

        const validItems = items.filter(i => i.skuId && i.quantity > 0);
        if (validItems.length === 0) {
            setError('يجب إضافة منتج واحد على الأقل');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            const dto: CreateOrderDto = {
                customerName,
                customerEmail: customerEmail || undefined,
                customerPhone: customerPhone || undefined,
                shippingAddress: street ? {
                    street,
                    city,
                    country,
                } : undefined,
                items: validItems.map(i => ({
                    skuId: i.skuId,
                    quantity: i.quantity,
                    price: i.price,
                })),
                notes: notes || undefined,
            };

            await createOrder(dto);
            resetForm();
            onOpenChange(false);
            onSuccess?.();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'فشل إنشاء الطلب');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ShoppingCart className="w-5 h-5" />
                        إنشاء طلب يدوي
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Customer Info */}
                    <div className="space-y-4">
                        <h3 className="font-medium">معلومات العميل</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="customerName">اسم العميل *</Label>
                                <Input
                                    id="customerName"
                                    value={customerName}
                                    onChange={(e) => setCustomerName(e.target.value)}
                                    placeholder="محمد أحمد"
                                />
                            </div>
                            <div>
                                <Label htmlFor="customerPhone">الهاتف</Label>
                                <Input
                                    id="customerPhone"
                                    value={customerPhone}
                                    onChange={(e) => setCustomerPhone(e.target.value)}
                                    placeholder="+966501234567"
                                    dir="ltr"
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <Label htmlFor="customerEmail">البريد الإلكتروني</Label>
                                <Input
                                    id="customerEmail"
                                    type="email"
                                    value={customerEmail}
                                    onChange={(e) => setCustomerEmail(e.target.value)}
                                    placeholder="customer@example.com"
                                    dir="ltr"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Shipping Address */}
                    <div className="space-y-4">
                        <h3 className="font-medium">عنوان الشحن</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="sm:col-span-2">
                                <Label htmlFor="street">العنوان</Label>
                                <Input
                                    id="street"
                                    value={street}
                                    onChange={(e) => setStreet(e.target.value)}
                                    placeholder="شارع الملك فهد"
                                />
                            </div>
                            <div>
                                <Label htmlFor="city">المدينة</Label>
                                <Input
                                    id="city"
                                    value={city}
                                    onChange={(e) => setCity(e.target.value)}
                                    placeholder="الرياض"
                                />
                            </div>
                            <div>
                                <Label htmlFor="country">الدولة</Label>
                                <Input
                                    id="country"
                                    value={country}
                                    onChange={(e) => setCountry(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Order Items */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-medium">المنتجات</h3>
                            <Button variant="outline" size="sm" onClick={addItem}>
                                <Plus className="w-4 h-4 ml-1" />
                                إضافة منتج
                            </Button>
                        </div>

                        <div className="space-y-3">
                            {items.map((item, index) => (
                                <div key={index} className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                                    <div className="flex-1 grid grid-cols-4 gap-2">
                                        <Input
                                            placeholder="SKU"
                                            value={item.skuId}
                                            onChange={(e) => updateItem(index, 'skuId', e.target.value)}
                                            className="col-span-2"
                                        />
                                        <Input
                                            type="number"
                                            placeholder="الكمية"
                                            value={item.quantity}
                                            onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                                            min={1}
                                        />
                                        <Input
                                            type="number"
                                            placeholder="السعر"
                                            value={item.price}
                                            onChange={(e) => updateItem(index, 'price', parseFloat(e.target.value) || 0)}
                                            min={0}
                                            step={0.01}
                                        />
                                    </div>
                                    {items.length > 1 && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removeItem(index)}
                                            className="text-destructive"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="text-left font-medium text-lg">
                            الإجمالي: {calculateTotal().toFixed(2)} ر.س
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <Label htmlFor="notes">ملاحظات</Label>
                        <Textarea
                            id="notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="ملاحظات إضافية..."
                            rows={3}
                        />
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
                            {error}
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        إلغاء
                    </Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                        إنشاء الطلب
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
