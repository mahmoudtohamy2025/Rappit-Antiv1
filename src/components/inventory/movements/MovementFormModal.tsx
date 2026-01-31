/**
 * Movement Form Modal
 * Create new stock movements
 */

import { useState } from 'react';
import {
    PackagePlus,
    Truck,
    RotateCcw,
    ArrowRight,
    AlertTriangle,
    Plus,
    Minus
} from 'lucide-react';
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

interface MovementFormModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const MOVEMENT_TYPES = [
    { value: 'RECEIVE', label: 'استلام', icon: PackagePlus, description: 'استلام مخزون من المورد' },
    { value: 'SHIP', label: 'شحن', icon: Truck, description: 'شحن مخزون للعميل' },
    { value: 'RETURN', label: 'إرجاع', icon: RotateCcw, description: 'إرجاع منتج من العميل' },
    { value: 'TRANSFER_OUT', label: 'تحويل صادر', icon: ArrowRight, description: 'تحويل إلى مستودع آخر' },
    { value: 'ADJUSTMENT_ADD', label: 'تعديل (+)', icon: Plus, description: 'زيادة المخزون' },
    { value: 'ADJUSTMENT_REMOVE', label: 'تعديل (-)', icon: Minus, description: 'تقليل المخزون' },
    { value: 'DAMAGE', label: 'تالف', icon: AlertTriangle, description: 'شطب منتجات تالفة' },
];

const WAREHOUSES = [
    { id: 'wh-1', name: 'مستودع الرياض' },
    { id: 'wh-2', name: 'مستودع جدة' },
    { id: 'wh-3', name: 'مستودع الدمام' },
];

const REFERENCE_TYPES = [
    { value: 'ORDER', label: 'طلب عميل' },
    { value: 'PURCHASE_ORDER', label: 'أمر شراء' },
    { value: 'RETURN', label: 'إرجاع' },
    { value: 'TRANSFER', label: 'تحويل' },
    { value: 'ADJUSTMENT', label: 'تعديل' },
];

export function MovementFormModal({ open, onOpenChange }: MovementFormModalProps) {
    const [movementType, setMovementType] = useState('');
    const [warehouseId, setWarehouseId] = useState('');
    const [targetWarehouseId, setTargetWarehouseId] = useState('');
    const [sku, setSku] = useState('');
    const [quantity, setQuantity] = useState('');
    const [reason, setReason] = useState('');
    const [referenceType, setReferenceType] = useState('');
    const [referenceId, setReferenceId] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const selectedType = MOVEMENT_TYPES.find(t => t.value === movementType);
    const isTransfer = movementType === 'TRANSFER_OUT';

    const handleSubmit = async () => {
        setIsSubmitting(true);
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        setIsSubmitting(false);
        onOpenChange(false);
        resetForm();
    };

    const resetForm = () => {
        setMovementType('');
        setWarehouseId('');
        setTargetWarehouseId('');
        setSku('');
        setQuantity('');
        setReason('');
        setReferenceType('');
        setReferenceId('');
    };

    const isValid = movementType && warehouseId && sku && quantity && reason &&
        (!isTransfer || targetWarehouseId);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg" dir="rtl">
                <DialogHeader>
                    <DialogTitle>حركة جديدة</DialogTitle>
                    <DialogDescription>
                        إنشاء حركة مخزون جديدة
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Movement Type */}
                    <div className="space-y-2">
                        <Label>نوع الحركة *</Label>
                        <Select value={movementType} onValueChange={setMovementType}>
                            <SelectTrigger>
                                <SelectValue placeholder="اختر نوع الحركة" />
                            </SelectTrigger>
                            <SelectContent>
                                {MOVEMENT_TYPES.map((type) => {
                                    const Icon = type.icon;
                                    return (
                                        <SelectItem key={type.value} value={type.value}>
                                            <div className="flex items-center gap-2">
                                                <Icon className="w-4 h-4" />
                                                <span>{type.label}</span>
                                            </div>
                                        </SelectItem>
                                    );
                                })}
                            </SelectContent>
                        </Select>
                        {selectedType && (
                            <p className="text-xs text-muted-foreground">{selectedType.description}</p>
                        )}
                    </div>

                    {/* Warehouse */}
                    <div className="space-y-2">
                        <Label>{isTransfer ? 'المستودع المصدر *' : 'المستودع *'}</Label>
                        <Select value={warehouseId} onValueChange={setWarehouseId}>
                            <SelectTrigger>
                                <SelectValue placeholder="اختر المستودع" />
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

                    {/* Target Warehouse (for transfers) */}
                    {isTransfer && (
                        <div className="space-y-2">
                            <Label>المستودع الهدف *</Label>
                            <Select value={targetWarehouseId} onValueChange={setTargetWarehouseId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="اختر المستودع الهدف" />
                                </SelectTrigger>
                                <SelectContent>
                                    {WAREHOUSES.filter(wh => wh.id !== warehouseId).map((wh) => (
                                        <SelectItem key={wh.id} value={wh.id}>
                                            {wh.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

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

                    {/* Reason */}
                    <div className="space-y-2">
                        <Label>السبب *</Label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="سبب الحركة..."
                            rows={2}
                            className="w-full px-3 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                        />
                    </div>

                    {/* Reference (Optional) */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>نوع المرجع</Label>
                            <Select value={referenceType} onValueChange={setReferenceType}>
                                <SelectTrigger>
                                    <SelectValue placeholder="اختياري" />
                                </SelectTrigger>
                                <SelectContent>
                                    {REFERENCE_TYPES.map((ref) => (
                                        <SelectItem key={ref.value} value={ref.value}>
                                            {ref.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>رقم المرجع</Label>
                            <input
                                type="text"
                                value={referenceId}
                                onChange={(e) => setReferenceId(e.target.value)}
                                placeholder="مثال: #12345"
                                className="w-full px-3 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                        </div>
                    </div>
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        إلغاء
                    </Button>
                    <Button onClick={handleSubmit} disabled={!isValid || isSubmitting}>
                        {isSubmitting ? 'جاري الإنشاء...' : 'إنشاء الحركة'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
