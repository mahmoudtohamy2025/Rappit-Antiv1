/**
 * Batch Release Modal Component
 * Release multiple reservations at once
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
import { Progress } from '../../UI/progress';
import { ReasonCodeSelect } from './ReasonCodeSelect';

interface BatchReleaseModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    count: number;
    onComplete: () => void;
}

export function BatchReleaseModal({ open, onOpenChange, count, onComplete }: BatchReleaseModalProps) {
    const [reasonCode, setReasonCode] = useState('');
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [progress, setProgress] = useState(0);

    const handleSubmit = async () => {
        if (!reasonCode) return;

        setIsSubmitting(true);

        // Simulate batch processing with progress
        for (let i = 0; i <= count; i++) {
            await new Promise(resolve => setTimeout(resolve, 200));
            setProgress(Math.round((i / count) * 100));
        }

        setIsSubmitting(false);
        setProgress(0);

        // Reset form
        setReasonCode('');
        setNotes('');

        onComplete();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Unlock className="w-5 h-5" />
                        إطلاق جماعي
                    </DialogTitle>
                    <DialogDescription>
                        إطلاق {count} حجوزات دفعة واحدة
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Warning */}
                    <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                        <div className="text-sm text-red-800 dark:text-red-200">
                            <p className="font-medium">تحذير: إجراء لا يمكن التراجع عنه</p>
                            <p>سيتم إطلاق <strong>{count}</strong> حجوزات وإعادة الكميات للمخزون المتاح.</p>
                        </div>
                    </div>

                    {/* Reason Code */}
                    <div className="space-y-2">
                        <Label>سبب الإطلاق الجماعي *</Label>
                        <ReasonCodeSelect
                            value={reasonCode}
                            onChange={setReasonCode}
                        />
                        <p className="text-xs text-muted-foreground">
                            سيتم تطبيق نفس السبب على جميع الحجوزات المحددة
                        </p>
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                        <Label>ملاحظات</Label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="ملاحظات اختيارية..."
                            rows={2}
                            className="w-full px-3 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                        />
                    </div>

                    {/* Progress */}
                    {isSubmitting && (
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span>جاري الإطلاق...</span>
                                <span>{progress}%</span>
                            </div>
                            <Progress value={progress} className="h-2" />
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                        إلغاء
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={!reasonCode || isSubmitting}
                        variant="destructive"
                    >
                        {isSubmitting ? `جاري الإطلاق... ${progress}%` : `إطلاق ${count} حجوزات`}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
