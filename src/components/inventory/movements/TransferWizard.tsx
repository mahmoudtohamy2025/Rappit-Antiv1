/**
 * Transfer Wizard Component
 * Multi-step wizard for creating warehouse transfers
 * 
 * Part of: UI-INV-02 (Backend: stock-movement.service.ts)
 */

import { useState } from 'react';
import {
    ArrowLeftRight,
    ChevronLeft,
    ChevronRight,
    Warehouse,
    Package,
    Check
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
import { Progress } from '../../UI/progress';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../UI/select';

interface TransferWizardProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onComplete: () => void;
}

interface TransferItem {
    sku: string;
    productName: string;
    availableQty: number;
    transferQty: number;
}

const WAREHOUSES = [
    { id: 'wh-1', name: 'مستودع الرياض' },
    { id: 'wh-2', name: 'مستودع جدة' },
    { id: 'wh-3', name: 'مستودع الدمام' },
];

// Mock products
const MOCK_PRODUCTS = [
    { sku: 'ELEC-001', name: 'سماعة لاسلكية', availableQty: 50 },
    { sku: 'FASH-234', name: 'قميص رجالي', availableQty: 120 },
    { sku: 'ACC-123', name: 'حقيبة جلدية', availableQty: 30 },
    { sku: 'HOME-890', name: 'طقم أواني', availableQty: 45 },
];

export function TransferWizard({ open, onOpenChange, onComplete }: TransferWizardProps) {
    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form data
    const [sourceWarehouse, setSourceWarehouse] = useState('');
    const [targetWarehouse, setTargetWarehouse] = useState('');
    const [items, setItems] = useState<TransferItem[]>([]);
    const [reason, setReason] = useState('');

    const totalSteps = 4;
    const progress = (step / totalSteps) * 100;

    const handleNext = () => {
        if (step < totalSteps) {
            setStep(step + 1);
        }
    };

    const handleBack = () => {
        if (step > 1) {
            setStep(step - 1);
        }
    };

    const handleAddItem = (product: typeof MOCK_PRODUCTS[0]) => {
        if (!items.find(i => i.sku === product.sku)) {
            setItems([...items, {
                sku: product.sku,
                productName: product.name,
                availableQty: product.availableQty,
                transferQty: 1
            }]);
        }
    };

    const handleUpdateQty = (sku: string, qty: number) => {
        setItems(items.map(i =>
            i.sku === sku
                ? { ...i, transferQty: Math.min(qty, i.availableQty) }
                : i
        ));
    };

    const handleRemoveItem = (sku: string) => {
        setItems(items.filter(i => i.sku !== sku));
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        await new Promise(resolve => setTimeout(resolve, 1000));
        setIsSubmitting(false);

        // Reset
        setStep(1);
        setSourceWarehouse('');
        setTargetWarehouse('');
        setItems([]);
        setReason('');

        onComplete();
    };

    const canProceed = () => {
        switch (step) {
            case 1: return !!sourceWarehouse;
            case 2: return !!targetWarehouse && targetWarehouse !== sourceWarehouse;
            case 3: return items.length > 0 && items.every(i => i.transferQty > 0);
            case 4: return true;
            default: return false;
        }
    };

    const getStepTitle = () => {
        switch (step) {
            case 1: return 'المستودع المصدر';
            case 2: return 'المستودع الهدف';
            case 3: return 'اختيار المنتجات';
            case 4: return 'مراجعة وتأكيد';
            default: return '';
        }
    };

    const totalItems = items.reduce((sum, i) => sum + i.transferQty, 0);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ArrowLeftRight className="w-5 h-5" />
                        تحويل بين المستودعات
                    </DialogTitle>
                    <DialogDescription>
                        الخطوة {step} من {totalSteps}: {getStepTitle()}
                    </DialogDescription>
                </DialogHeader>

                <Progress value={progress} className="h-2" />

                <div className="min-h-[250px] pt-4">
                    {/* Step 1: Source Warehouse */}
                    {step === 1 && (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <Warehouse className="w-4 h-4" />
                                    المستودع المصدر *
                                </Label>
                                <Select value={sourceWarehouse} onValueChange={setSourceWarehouse}>
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
                                <p className="text-xs text-muted-foreground">
                                    المستودع الذي سيتم سحب المنتجات منه
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Target Warehouse */}
                    {step === 2 && (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <Warehouse className="w-4 h-4" />
                                    المستودع الهدف *
                                </Label>
                                <Select value={targetWarehouse} onValueChange={setTargetWarehouse}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="اختر المستودع" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {WAREHOUSES.filter(wh => wh.id !== sourceWarehouse).map((wh) => (
                                            <SelectItem key={wh.id} value={wh.id}>
                                                {wh.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                    المستودع الذي سيتم إضافة المنتجات إليه
                                </p>
                            </div>

                            {/* Summary */}
                            <div className="p-3 bg-muted rounded-lg flex items-center justify-between">
                                <span className="font-medium">
                                    {WAREHOUSES.find(w => w.id === sourceWarehouse)?.name}
                                </span>
                                <ArrowLeftRight className="w-4 h-4" />
                                <span className="font-medium">
                                    {WAREHOUSES.find(w => w.id === targetWarehouse)?.name || '...'}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Select Products */}
                    {step === 3 && (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <Package className="w-4 h-4" />
                                    المنتجات للتحويل
                                </Label>

                                {/* Available products */}
                                <div className="max-h-32 overflow-y-auto space-y-1 border rounded-lg p-2">
                                    {MOCK_PRODUCTS.filter(p => !items.find(i => i.sku === p.sku)).map((product) => (
                                        <button
                                            key={product.sku}
                                            onClick={() => handleAddItem(product)}
                                            className="w-full flex items-center justify-between p-2 rounded hover:bg-muted text-right"
                                        >
                                            <div>
                                                <p className="text-sm font-medium">{product.name}</p>
                                                <p className="text-xs text-muted-foreground">{product.sku}</p>
                                            </div>
                                            <span className="text-xs text-muted-foreground">
                                                متاح: {product.availableQty}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Selected items */}
                            {items.length > 0 && (
                                <div className="space-y-2">
                                    <Label>المنتجات المحددة ({items.length})</Label>
                                    <div className="space-y-2">
                                        {items.map((item) => (
                                            <div key={item.sku} className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                                                <div className="flex-1">
                                                    <p className="text-sm font-medium">{item.productName}</p>
                                                    <p className="text-xs text-muted-foreground">متاح: {item.availableQty}</p>
                                                </div>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max={item.availableQty}
                                                    value={item.transferQty}
                                                    onChange={(e) => handleUpdateQty(item.sku, parseInt(e.target.value) || 0)}
                                                    className="w-20 px-2 py-1 border rounded text-sm"
                                                />
                                                <button
                                                    onClick={() => handleRemoveItem(item.sku)}
                                                    className="text-destructive text-sm"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 4: Review */}
                    {step === 4 && (
                        <div className="space-y-4">
                            <div className="p-4 bg-muted rounded-lg space-y-3">
                                <h3 className="font-medium">ملخص التحويل</h3>

                                <div className="flex items-center justify-between text-sm">
                                    <span>{WAREHOUSES.find(w => w.id === sourceWarehouse)?.name}</span>
                                    <ArrowLeftRight className="w-4 h-4" />
                                    <span>{WAREHOUSES.find(w => w.id === targetWarehouse)?.name}</span>
                                </div>

                                <div className="pt-2 border-t space-y-1">
                                    {items.map((item) => (
                                        <div key={item.sku} className="flex justify-between text-sm">
                                            <span>{item.productName}</span>
                                            <span className="font-medium">×{item.transferQty}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="pt-2 border-t flex justify-between font-medium">
                                    <span>إجمالي الوحدات</span>
                                    <span>{totalItems}</span>
                                </div>
                            </div>

                            {/* Reason */}
                            <div className="space-y-2">
                                <Label>سبب التحويل</Label>
                                <textarea
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    placeholder="اختياري..."
                                    rows={2}
                                    className="w-full px-3 py-2 border rounded-lg bg-background text-sm resize-none"
                                />
                            </div>

                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Check className="w-4 h-4 text-green-500" />
                                <span>سيتم إنشاء حركتين: صادر من {WAREHOUSES.find(w => w.id === sourceWarehouse)?.name} ووارد إلى {WAREHOUSES.find(w => w.id === targetWarehouse)?.name}</span>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2">
                    {step > 1 && (
                        <Button variant="outline" onClick={handleBack} className="gap-1">
                            <ChevronRight className="w-4 h-4" />
                            السابق
                        </Button>
                    )}

                    {step < totalSteps ? (
                        <Button onClick={handleNext} disabled={!canProceed()} className="gap-1">
                            التالي
                            <ChevronLeft className="w-4 h-4" />
                        </Button>
                    ) : (
                        <Button onClick={handleSubmit} disabled={isSubmitting}>
                            {isSubmitting ? 'جاري التحويل...' : 'تنفيذ التحويل'}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
