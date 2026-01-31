/**
 * Count Entry Form Component
 * Form for entering physical counts during cycle count
 * 
 * Part of: UI-INV-03 (Backend: cycle-count.service.ts)
 */

import { useState } from 'react';
import {
    Package,
    Check,
    ArrowLeft,
    ArrowRight,
    AlertTriangle,
    CheckCircle2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../UI/card';
import { Button } from '../../UI/button';
import { Badge } from '../../UI/badge';
import { Progress } from '../../UI/progress';

interface CountItem {
    id: string;
    sku: string;
    productName: string;
    systemQty: number;
    countedQty: number | null;
    variance: number | null;
    counted: boolean;
}

interface CountEntryFormProps {
    cycleCountId: string;
    cycleCountName: string;
    items: CountItem[];
    onSave: (itemId: string, countedQty: number) => void;
    onComplete: () => void;
    onBack: () => void;
}

export function CountEntryForm({
    cycleCountId,
    cycleCountName,
    items,
    onSave,
    onComplete,
    onBack
}: CountEntryFormProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [countValue, setCountValue] = useState('');

    const currentItem = items[currentIndex];
    const countedItems = items.filter(i => i.counted).length;
    const progress = (countedItems / items.length) * 100;

    const handleSave = () => {
        const qty = parseInt(countValue);
        if (!isNaN(qty) && qty >= 0) {
            onSave(currentItem.id, qty);
            setCountValue('');

            // Move to next uncounted item
            const nextUncounted = items.findIndex((item, idx) => idx > currentIndex && !item.counted);
            if (nextUncounted !== -1) {
                setCurrentIndex(nextUncounted);
            } else if (currentIndex < items.length - 1) {
                setCurrentIndex(currentIndex + 1);
            }
        }
    };

    const handlePrevious = () => {
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
            setCountValue('');
        }
    };

    const handleNext = () => {
        if (currentIndex < items.length - 1) {
            setCurrentIndex(currentIndex + 1);
            setCountValue('');
        }
    };

    const getVarianceColor = (variance: number | null): string => {
        if (variance === null) return '';
        if (variance === 0) return 'text-green-600 dark:text-green-400';
        if (variance > 0) return 'text-blue-600 dark:text-blue-400';
        return 'text-red-600 dark:text-red-400';
    };

    const canComplete = countedItems === items.length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold">{cycleCountName}</h2>
                    <p className="text-muted-foreground">
                        المنتج {currentIndex + 1} من {items.length}
                    </p>
                </div>
                <Button variant="outline" onClick={onBack}>
                    العودة للقائمة
                </Button>
            </div>

            {/* Progress */}
            <div className="space-y-2">
                <div className="flex justify-between text-sm">
                    <span>التقدم الإجمالي</span>
                    <span className="font-medium">{countedItems} / {items.length} ({Math.round(progress)}%)</span>
                </div>
                <Progress value={progress} className="h-3" />
            </div>

            {/* Count Card */}
            <Card className="border-2">
                <CardHeader>
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-muted rounded-lg">
                                <Package className="w-6 h-6" />
                            </div>
                            <div>
                                <CardTitle>{currentItem.productName}</CardTitle>
                                <p className="text-sm text-muted-foreground font-mono">{currentItem.sku}</p>
                            </div>
                        </div>
                        {currentItem.counted && (
                            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-0 gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                تم العد
                            </Badge>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* System Quantity */}
                    <div className="p-4 bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground mb-1">الكمية في النظام</p>
                        <p className="text-3xl font-bold">{currentItem.systemQty}</p>
                    </div>

                    {/* Count Input */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">الكمية الفعلية *</label>
                        <div className="flex gap-2">
                            <input
                                type="number"
                                min="0"
                                value={countValue}
                                onChange={(e) => setCountValue(e.target.value)}
                                placeholder="أدخل الكمية"
                                className="flex-1 px-4 py-3 text-xl border-2 rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                autoFocus
                            />
                            <Button size="lg" onClick={handleSave} disabled={!countValue}>
                                <Check className="w-5 h-5" />
                            </Button>
                        </div>
                    </div>

                    {/* Variance Display (if counted) */}
                    {currentItem.counted && currentItem.variance !== null && (
                        <div className={`p-4 rounded-lg ${currentItem.variance === 0
                                ? 'bg-green-50 dark:bg-green-900/20'
                                : currentItem.variance > 0
                                    ? 'bg-blue-50 dark:bg-blue-900/20'
                                    : 'bg-red-50 dark:bg-red-900/20'
                            }`}>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground">الفرق</p>
                                    <p className={`text-2xl font-bold ${getVarianceColor(currentItem.variance)}`}>
                                        {currentItem.variance > 0 ? '+' : ''}{currentItem.variance}
                                    </p>
                                </div>
                                {currentItem.variance !== 0 && (
                                    <AlertTriangle className={`w-6 h-6 ${getVarianceColor(currentItem.variance)}`} />
                                )}
                            </div>
                            <p className="text-sm mt-2">
                                تم تسجيل: <strong>{currentItem.countedQty}</strong>
                            </p>
                        </div>
                    )}

                    {/* Navigation */}
                    <div className="flex justify-between pt-4 border-t">
                        <Button
                            variant="outline"
                            onClick={handlePrevious}
                            disabled={currentIndex === 0}
                            className="gap-1"
                        >
                            <ArrowRight className="w-4 h-4" />
                            السابق
                        </Button>
                        <Button
                            variant="outline"
                            onClick={handleNext}
                            disabled={currentIndex === items.length - 1}
                            className="gap-1"
                        >
                            التالي
                            <ArrowLeft className="w-4 h-4" />
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Complete Button */}
            {canComplete && (
                <Button
                    className="w-full"
                    size="lg"
                    onClick={onComplete}
                >
                    إنهاء الجرد وعرض التقرير
                </Button>
            )}

            {/* Items Quick List */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">قائمة المنتجات</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {items.map((item, idx) => (
                            <button
                                key={item.id}
                                onClick={() => { setCurrentIndex(idx); setCountValue(''); }}
                                className={`p-2 text-xs rounded border text-right transition-colors ${idx === currentIndex
                                        ? 'border-primary bg-primary/10'
                                        : item.counted
                                            ? 'border-green-300 bg-green-50 dark:bg-green-900/20'
                                            : 'hover:bg-muted'
                                    }`}
                            >
                                <p className="font-mono truncate">{item.sku}</p>
                                {item.counted && (
                                    <p className={`font-medium ${getVarianceColor(item.variance)}`}>
                                        {item.variance !== null && item.variance !== 0 && (item.variance > 0 ? '+' : '')}{item.variance}
                                    </p>
                                )}
                            </button>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
