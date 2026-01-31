/**
 * Transfer Form Modal
 * Create new transfer requests
 */

import { useState } from 'react';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../UI/select';

interface TransferFormModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const WAREHOUSES = [
    { id: 'wh-1', name: 'مستودع الرياض' },
    { id: 'wh-2', name: 'مستودع جدة' },
    { id: 'wh-3', name: 'مستودع الدمام' },
];

const TRANSFER_TYPES = [
    { value: 'IMMEDIATE', label: 'فوري', description: 'تنفيذ مباشر بدون موافقة' },
    { value: 'PENDING', label: 'يحتاج موافقة', description: 'ينتظر موافقة مدير المستودع' },
    { value: 'SCHEDULED', label: 'مجدول', description: 'تنفيذ في تاريخ محدد' },
];

const PRIORITIES = [
    { value: 'LOW', label: 'عادي' },
    { value: 'NORMAL', label: 'متوسط' },
    { value: 'HIGH', label: 'عالي' },
    { value: 'URGENT', label: 'عاجل' },
];

export function TransferFormModal({ open, onOpenChange }: TransferFormModalProps) {
    const [sourceWarehouse, setSourceWarehouse] = useState('');
    const [targetWarehouse, setTargetWarehouse] = useState('');
    const [sku, setSku] = useState('');
    const [quantity, setQuantity] = useState('');
    const [transferType, setTransferType] = useState('PENDING');
    const [priority, setPriority] = useState('NORMAL');
    const [reason, setReason] = useState('');
    const [scheduledDate, setScheduledDate] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const isValid = sourceWarehouse && targetWarehouse &&
        sourceWarehouse !== targetWarehouse &&
        sku && quantity && reason;

    const handleSubmit = async () => {
        setIsSubmitting(true);
        await new Promise(resolve => setTimeout(resolve, 1000));
        setIsSubmitting(false);
        onOpenChange(false);
        resetForm();
    };

    const resetForm = () => {
        setSourceWarehouse('');
        setTargetWarehouse('');
        setSku('');
        setQuantity('');
        setTransferType('PENDING');
        setPriority('NORMAL');
        setReason('');
        setScheduledDate('');
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg" dir="rtl">
                <DialogHeader>
                    <DialogTitle>طلب تحويل جديد</DialogTitle>
                    <DialogDescription>
                        تحويل مخزون بين المستودعات
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Source & Target Warehouses */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>المستودع المصدر *</Label>
                            <Select value={sourceWarehouse} onValueChange={setSourceWarehouse}>
                                <SelectTrigger>
                                    <SelectValue placeholder="اختر" />
                                </SelectTrigger>
                                <SelectContent>
                                    {WAREHOUSES.map((wh) => (
                                        <SelectItem key={wh.id} value={wh.id}>
                                            {wh.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>المستودع الهدف *</Label>
                            <Select value={targetWarehouse} onValueChange={setTargetWarehouse}>
                                <SelectTrigger>
                                    <SelectValue placeholder="اختر" />
                                </SelectTrigger>
                                <SelectContent>
                                    {WAREHOUSES.filter(wh => wh.id !== sourceWarehouse).map((wh) => (
                                        <SelectItem key={wh.id} value={wh.id}>
                                            {wh.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* SKU & Quantity */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>SKU *</Label>
                            <input
                                type="text"
                                value={sku}
                                onChange={(e) => setSku(e.target.value)}
                                placeholder="مثال: ELEC-001"
                                className="w-full px-3 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>الكمية *</Label>
                            <input
                                type="number"
                                min="1"
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                                placeholder="0"
                                className="w-full px-3 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                        </div>
                    </div>

                    {/* Transfer Type & Priority */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>نوع التحويل</Label>
                            <Select value={transferType} onValueChange={setTransferType}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {TRANSFER_TYPES.map((type) => (
                                        <SelectItem key={type.value} value={type.value}>
                                            {type.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>الأولوية</Label>
                            <Select value={priority} onValueChange={setPriority}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {PRIORITIES.map((p) => (
                                        <SelectItem key={p.value} value={p.value}>
                                            {p.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Scheduled Date (for scheduled transfers) */}
                    {transferType === 'SCHEDULED' && (
                        <div className="space-y-2">
                            <Label>تاريخ التنفيذ</Label>
                            <input
                                type="datetime-local"
                                value={scheduledDate}
                                onChange={(e) => setScheduledDate(e.target.value)}
                                className="w-full px-3 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                        </div>
                    )}

                    {/* Reason */}
                    <div className="space-y-2">
                        <Label>السبب *</Label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="سبب طلب التحويل..."
                            rows={2}
                            className="w-full px-3 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                        />
                    </div>
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        إلغاء
                    </Button>
                    <Button onClick={handleSubmit} disabled={!isValid || isSubmitting}>
                        {isSubmitting ? 'جاري الإنشاء...' : 'إنشاء الطلب'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
