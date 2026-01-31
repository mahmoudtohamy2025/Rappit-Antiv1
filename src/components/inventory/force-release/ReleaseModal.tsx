/**
 * Release Modal Component
 * Single reservation release dialog
 * 
 * Part of: UI-INV-05 (Backend: force-release.service.ts)
 */

import { useState } from 'react';
import { Unlock, AlertTriangle } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '../../UI/dialog';
import { Button } from '../../UI/button';
import { Label } from '../../UI/label';
import { Checkbox } from '../../UI/checkbox';
import { ReasonCodeSelect } from './ReasonCodeSelect';

interface Reservation {
    id: string;
    sku: string;
    productName: string;
    quantity: number;
    orderId: string;
    orderNumber: string;
    warehouseName: string;
    createdAt: string;
    ageMinutes: number;
}

interface ReleaseModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    reservation: Reservation | null;
    onComplete: () => void;
}

export function ReleaseModal({ open, onOpenChange, reservation, onComplete }: ReleaseModalProps) {
    const [reasonCode, setReasonCode] = useState('');
    const [notes, setNotes] = useState('');
    const [notifyOwner, setNotifyOwner] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!reasonCode) return;

        setIsSubmitting(true);
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        setIsSubmitting(false);

        // Reset form
        setReasonCode('');
        setNotes('');
        setNotifyOwner(true);

        onComplete();
    };

    if (!reservation) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Unlock className="w-5 h-5" />
                        إطلاق الحجز
                    </DialogTitle>
                    <DialogDescription>
                        تأكيد إطلاق الحجز المعلق
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Warning */}
                    <div className="flex items-start gap-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                        <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
                        <div className="text-sm text-yellow-800 dark:text-yellow-200">
                            <p className="font-medium">تحذير</p>
                            <p>سيتم إطلاق الكمية المحجوزة وإعادتها للمخزون المتاح.</p>
                        </div>
                    </div>

                    {/* Reservation Info */}
                    <div className="p-3 bg-muted rounded-lg space-y-2">
                        <p><span className="text-muted-foreground">المنتج:</span> <span className="font-medium">{reservation.productName}</span></p>
                        <p><span className="text-muted-foreground">SKU:</span> <span className="font-mono">{reservation.sku}</span></p>
                        <p><span className="text-muted-foreground">الكمية:</span> <span className="font-medium">{reservation.quantity}</span></p>
                        <p><span className="text-muted-foreground">الطلب:</span> <span className="font-medium">{reservation.orderNumber}</span></p>
                        <p><span className="text-muted-foreground">المستودع:</span> {reservation.warehouseName}</p>
                    </div>

                    {/* Reason Code */}
                    <div className="space-y-2">
                        <Label>سبب الإطلاق *</Label>
                        <ReasonCodeSelect
                            value={reasonCode}
                            onChange={setReasonCode}
                        />
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                        <Label>ملاحظات إضافية</Label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="ملاحظات اختيارية..."
                            rows={2}
                            className="w-full px-3 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                        />
                    </div>

                    {/* Notify Owner */}
                    <div className="flex items-center gap-3">
                        <Checkbox
                            id="notifyOwner"
                            checked={notifyOwner}
                            onCheckedChange={(checked) => setNotifyOwner(checked as boolean)}
                        />
                        <Label htmlFor="notifyOwner" className="cursor-pointer">
                            إخطار صاحب الطلب
                        </Label>
                    </div>
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        إلغاء
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={!reasonCode || isSubmitting}
                        variant="destructive"
                    >
                        {isSubmitting ? 'جاري الإطلاق...' : 'تأكيد الإطلاق'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
