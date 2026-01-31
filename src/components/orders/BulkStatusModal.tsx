/**
 * Bulk Status Modal
 * Update status for multiple orders at once
 * 
 * Part of: GAP-08 Orders Enhancements
 */

import { useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '../../UI/dialog';
import { Button } from '../../UI/button';
import { Label } from '../../UI/label';
import { Textarea } from '../../UI/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../UI/select';
import { useOrders, OrderStatus } from '../../../hooks/useOrders';

interface BulkStatusModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedOrderIds: string[];
    onSuccess?: () => void;
}

const STATUS_OPTIONS: { value: OrderStatus; label: string; color: string }[] = [
    { value: 'CONFIRMED', label: 'مؤكد', color: 'text-blue-600' },
    { value: 'PROCESSING', label: 'قيد التجهيز', color: 'text-yellow-600' },
    { value: 'SHIPPED', label: 'تم الشحن', color: 'text-purple-600' },
    { value: 'DELIVERED', label: 'تم التسليم', color: 'text-green-600' },
    { value: 'CANCELLED', label: 'ملغي', color: 'text-red-600' },
];

export function BulkStatusModal({
    open,
    onOpenChange,
    selectedOrderIds,
    onSuccess,
}: BulkStatusModalProps) {
    const { bulkUpdateStatus } = useOrders();
    const [status, setStatus] = useState<OrderStatus | ''>('');
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async () => {
        if (!status) {
            setError('يرجى اختيار الحالة');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            await bulkUpdateStatus({
                orderIds: selectedOrderIds,
                status: status as OrderStatus,
                notes: notes || undefined,
            });

            setStatus('');
            setNotes('');
            onOpenChange(false);
            onSuccess?.();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'فشل تحديث الطلبات');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5" />
                        تحديث حالة الطلبات
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Selected Count */}
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-700 dark:text-blue-300">
                        سيتم تحديث <strong>{selectedOrderIds.length}</strong> طلب
                    </div>

                    {/* Status Select */}
                    <div>
                        <Label>الحالة الجديدة *</Label>
                        <Select value={status} onValueChange={(v) => setStatus(v as OrderStatus)}>
                            <SelectTrigger>
                                <SelectValue placeholder="اختر الحالة" />
                            </SelectTrigger>
                            <SelectContent>
                                {STATUS_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                        <span className={opt.color}>{opt.label}</span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Notes */}
                    <div>
                        <Label htmlFor="bulkNotes">ملاحظات (اختياري)</Label>
                        <Textarea
                            id="bulkNotes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="سبب التحديث..."
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
                    <Button onClick={handleSubmit} disabled={isSubmitting || !status}>
                        {isSubmitting && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                        تحديث الطلبات
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
