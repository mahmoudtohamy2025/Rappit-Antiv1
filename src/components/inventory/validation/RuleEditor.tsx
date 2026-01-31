/**
 * Rule Editor Component
 * Create and edit validation rules
 * 
 * Part of: UI-INV-04 (Backend: inventory-validation.service.ts)
 */

import { useState, useEffect } from 'react';
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

interface ValidationRule {
    id: string;
    name: string;
    nameAr: string;
    type: 'format' | 'range' | 'required' | 'regex' | 'custom';
    field: string;
    pattern?: string;
    min?: number;
    max?: number;
    enabled: boolean;
    isBuiltIn: boolean;
    errorMessage: string;
}

interface RuleEditorProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    rule: ValidationRule | null;
    onSave: (rule: ValidationRule) => void;
}

const RULE_TYPES = [
    { value: 'format', label: 'تنسيق', description: 'التحقق من تنسيق النص' },
    { value: 'range', label: 'نطاق', description: 'التحقق من نطاق القيم' },
    { value: 'required', label: 'مطلوب', description: 'التحقق من وجود القيمة' },
    { value: 'regex', label: 'تعبير نمطي', description: 'التحقق باستخدام Regex' },
];

const FIELDS = [
    { value: 'sku', label: 'رمز المنتج (SKU)' },
    { value: 'name', label: 'اسم المنتج' },
    { value: 'quantity', label: 'الكمية' },
    { value: 'minStock', label: 'الحد الأدنى للمخزون' },
    { value: 'maxStock', label: 'الحد الأقصى للمخزون' },
    { value: 'category', label: 'الفئة' },
    { value: 'price', label: 'السعر' },
    { value: 'warehouseId', label: 'المستودع' },
];

export function RuleEditor({ open, onOpenChange, rule, onSave }: RuleEditorProps) {
    const [nameAr, setNameAr] = useState('');
    const [type, setType] = useState<'format' | 'range' | 'required' | 'regex' | 'custom'>('required');
    const [field, setField] = useState('');
    const [pattern, setPattern] = useState('');
    const [min, setMin] = useState('');
    const [max, setMax] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Reset form when rule changes
    useEffect(() => {
        if (rule) {
            setNameAr(rule.nameAr);
            setType(rule.type);
            setField(rule.field);
            setPattern(rule.pattern || '');
            setMin(rule.min?.toString() || '');
            setMax(rule.max?.toString() || '');
            setErrorMessage(rule.errorMessage);
        } else {
            setNameAr('');
            setType('required');
            setField('');
            setPattern('');
            setMin('');
            setMax('');
            setErrorMessage('');
        }
    }, [rule, open]);

    const handleSubmit = async () => {
        setIsSubmitting(true);

        const newRule: ValidationRule = {
            id: rule?.id || '',
            name: nameAr, // We'll use Arabic name for both
            nameAr,
            type,
            field,
            pattern: type === 'format' || type === 'regex' ? pattern : undefined,
            min: type === 'range' && min ? parseInt(min) : undefined,
            max: type === 'range' && max ? parseInt(max) : undefined,
            enabled: rule?.enabled ?? true,
            isBuiltIn: false,
            errorMessage,
        };

        await new Promise(resolve => setTimeout(resolve, 500));
        onSave(newRule);
        setIsSubmitting(false);
    };

    const isValid = nameAr && field && errorMessage && (
        type === 'required' ||
        (type === 'format' && pattern) ||
        (type === 'regex' && pattern) ||
        (type === 'range' && (min || max))
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg" dir="rtl">
                <DialogHeader>
                    <DialogTitle>
                        {rule ? 'تعديل قاعدة التحقق' : 'قاعدة تحقق جديدة'}
                    </DialogTitle>
                    <DialogDescription>
                        {rule ? 'قم بتعديل إعدادات القاعدة' : 'أضف قاعدة تحقق مخصصة للمخزون'}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Rule Name */}
                    <div className="space-y-2">
                        <Label>اسم القاعدة *</Label>
                        <input
                            type="text"
                            value={nameAr}
                            onChange={(e) => setNameAr(e.target.value)}
                            placeholder="مثال: التحقق من السعر"
                            className="w-full px-3 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                    </div>

                    {/* Rule Type */}
                    <div className="space-y-2">
                        <Label>نوع التحقق *</Label>
                        <Select value={type} onValueChange={(v) => setType(v as any)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {RULE_TYPES.map((t) => (
                                    <SelectItem key={t.value} value={t.value}>
                                        <div>
                                            <span>{t.label}</span>
                                            <span className="text-xs text-muted-foreground mr-2">- {t.description}</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Field */}
                    <div className="space-y-2">
                        <Label>الحقل *</Label>
                        <Select value={field} onValueChange={setField}>
                            <SelectTrigger>
                                <SelectValue placeholder="اختر الحقل" />
                            </SelectTrigger>
                            <SelectContent>
                                {FIELDS.map((f) => (
                                    <SelectItem key={f.value} value={f.value}>
                                        {f.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Pattern (for format/regex) */}
                    {(type === 'format' || type === 'regex') && (
                        <div className="space-y-2">
                            <Label>النمط (Pattern) *</Label>
                            <input
                                type="text"
                                value={pattern}
                                onChange={(e) => setPattern(e.target.value)}
                                placeholder="مثال: ^[A-Z]{2,4}-\d{3,6}$"
                                dir="ltr"
                                className="w-full px-3 py-2 border rounded-lg bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                            <p className="text-xs text-muted-foreground">
                                استخدم تعبيرات Regex للتحقق من تنسيق النص
                            </p>
                        </div>
                    )}

                    {/* Range (for range type) */}
                    {type === 'range' && (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>الحد الأدنى</Label>
                                <input
                                    type="number"
                                    value={min}
                                    onChange={(e) => setMin(e.target.value)}
                                    placeholder="0"
                                    className="w-full px-3 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>الحد الأقصى</Label>
                                <input
                                    type="number"
                                    value={max}
                                    onChange={(e) => setMax(e.target.value)}
                                    placeholder="1000"
                                    className="w-full px-3 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                            </div>
                        </div>
                    )}

                    {/* Error Message */}
                    <div className="space-y-2">
                        <Label>رسالة الخطأ *</Label>
                        <textarea
                            value={errorMessage}
                            onChange={(e) => setErrorMessage(e.target.value)}
                            placeholder="الرسالة التي ستظهر عند فشل التحقق"
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
                        {isSubmitting ? 'جاري الحفظ...' : rule ? 'حفظ التعديلات' : 'إضافة القاعدة'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
