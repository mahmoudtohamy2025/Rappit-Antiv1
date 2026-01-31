/**
 * Cycle Count Wizard
 * Multi-step wizard for creating new cycle counts
 * 
 * Part of: UI-INV-03 (Backend: cycle-count.service.ts - 114 tests)
 */

import { useState } from 'react';
import {
    ClipboardCheck,
    ChevronLeft,
    ChevronRight,
    Warehouse,
    Package,
    Calendar,
    User,
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

interface CycleCountWizardProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onComplete: () => void;
}

const WAREHOUSES = [
    { id: 'wh-1', name: 'مستودع الرياض' },
    { id: 'wh-2', name: 'مستودع جدة' },
    { id: 'wh-3', name: 'مستودع الدمام' },
];

const ASSIGNEES = [
    { id: 'user-1', name: 'أحمد محمد' },
    { id: 'user-2', name: 'سارة أحمد' },
    { id: 'user-3', name: 'محمد علي' },
    { id: 'user-4', name: 'فاطمة خالد' },
];

export function CycleCountWizard({ open, onOpenChange, onComplete }: CycleCountWizardProps) {
    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form data
    const [warehouseId, setWarehouseId] = useState('');
    const [countType, setCountType] = useState<'all' | 'selected'>('all');
    const [selectedSkus, setSelectedSkus] = useState<string[]>([]);
    const [name, setName] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [assigneeId, setAssigneeId] = useState('');

    const totalSteps = 3;
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

    const handleSubmit = async () => {
        setIsSubmitting(true);
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        setIsSubmitting(false);

        // Reset form
        setStep(1);
        setWarehouseId('');
        setCountType('all');
        setSelectedSkus([]);
        setName('');
        setDueDate('');
        setAssigneeId('');

        onComplete();
    };

    const canProceed = () => {
        switch (step) {
            case 1:
                return !!warehouseId;
            case 2:
                return !!name && !!dueDate;
            case 3:
                return true;
            default:
                return false;
        }
    };

    const getStepTitle = () => {
        switch (step) {
            case 1: return 'اختيار المستودع';
            case 2: return 'تفاصيل الجرد';
            case 3: return 'مراجعة وتأكيد';
            default: return '';
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ClipboardCheck className="w-5 h-5" />
                        جرد جديد
                    </DialogTitle>
                    <DialogDescription>
                        الخطوة {step} من {totalSteps}: {getStepTitle()}
                    </DialogDescription>
                </DialogHeader>

                {/* Progress */}
                <Progress value={progress} className="h-2" />

                {/* Step Content */}
                <div className="min-h-[200px] pt-4">
                    {/* Step 1: Select Warehouse */}
                    {step === 1 && (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <Warehouse className="w-4 h-4" />
                                    المستودع *
                                </Label>
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

                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <Package className="w-4 h-4" />
                                    نطاق الجرد
                                </Label>
                                <div className="space-y-2">
                                    <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
                                        <input
                                            type="radio"
                                            name="countType"
                                            checked={countType === 'all'}
                                            onChange={() => setCountType('all')}
                                            className="w-4 h-4"
                                        />
                                        <div>
                                            <p className="font-medium">جميع المنتجات</p>
                                            <p className="text-sm text-muted-foreground">جرد كامل للمستودع</p>
                                        </div>
                                    </label>
                                    <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
                                        <input
                                            type="radio"
                                            name="countType"
                                            checked={countType === 'selected'}
                                            onChange={() => setCountType('selected')}
                                            className="w-4 h-4"
                                        />
                                        <div>
                                            <p className="font-medium">منتجات محددة</p>
                                            <p className="text-sm text-muted-foreground">اختيار SKUs معينة</p>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Count Details */}
                    {step === 2 && (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>اسم الجرد *</Label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="مثال: جرد Q1 2026"
                                    className="w-full px-3 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4" />
                                    تاريخ الاستحقاق *
                                </Label>
                                <input
                                    type="date"
                                    value={dueDate}
                                    onChange={(e) => setDueDate(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <User className="w-4 h-4" />
                                    المسؤول
                                </Label>
                                <Select value={assigneeId} onValueChange={setAssigneeId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="اختر المسؤول (اختياري)" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ASSIGNEES.map((user) => (
                                            <SelectItem key={user.id} value={user.id}>
                                                {user.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Review */}
                    {step === 3 && (
                        <div className="space-y-4">
                            <div className="p-4 bg-muted rounded-lg space-y-3">
                                <h3 className="font-medium">ملخص الجرد</h3>
                                <div className="space-y-2 text-sm">
                                    <p>
                                        <span className="text-muted-foreground">المستودع:</span>{' '}
                                        <span className="font-medium">
                                            {WAREHOUSES.find(w => w.id === warehouseId)?.name}
                                        </span>
                                    </p>
                                    <p>
                                        <span className="text-muted-foreground">النطاق:</span>{' '}
                                        <span className="font-medium">
                                            {countType === 'all' ? 'جميع المنتجات' : `${selectedSkus.length} منتجات محددة`}
                                        </span>
                                    </p>
                                    <p>
                                        <span className="text-muted-foreground">اسم الجرد:</span>{' '}
                                        <span className="font-medium">{name}</span>
                                    </p>
                                    <p>
                                        <span className="text-muted-foreground">تاريخ الاستحقاق:</span>{' '}
                                        <span className="font-medium">{dueDate}</span>
                                    </p>
                                    {assigneeId && (
                                        <p>
                                            <span className="text-muted-foreground">المسؤول:</span>{' '}
                                            <span className="font-medium">
                                                {ASSIGNEES.find(u => u.id === assigneeId)?.name}
                                            </span>
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Check className="w-4 h-4 text-green-500" />
                                <span>سيتم إنشاء الجرد بحالة "مسودة" ويمكن بدء العد في أي وقت</span>
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
                            {isSubmitting ? 'جاري الإنشاء...' : 'إنشاء الجرد'}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
