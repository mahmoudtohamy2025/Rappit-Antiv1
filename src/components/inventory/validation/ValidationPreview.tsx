/**
 * Validation Preview Component
 * Test validation rules with sample data
 * 
 * Part of: UI-INV-04 (Backend: inventory-validation.service.ts)
 */

import { useState } from 'react';
import {
    Play,
    CheckCircle2,
    XCircle,
    AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../UI/card';
import { Button } from '../../UI/button';
import { Badge } from '../../UI/badge';

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

interface ValidationPreviewProps {
    rules: ValidationRule[];
}

interface ValidationResult {
    ruleId: string;
    ruleName: string;
    passed: boolean;
    message?: string;
}

export function ValidationPreview({ rules }: ValidationPreviewProps) {
    const [sampleData, setSampleData] = useState({
        sku: 'ELEC-001',
        name: 'سماعة لاسلكية',
        quantity: '50',
        warehouseId: 'wh-1',
        minStock: '10',
        maxStock: '500',
    });
    const [results, setResults] = useState<ValidationResult[]>([]);
    const [isValidating, setIsValidating] = useState(false);

    const runValidation = async () => {
        setIsValidating(true);

        // Simulate validation delay
        await new Promise(resolve => setTimeout(resolve, 500));

        const newResults: ValidationResult[] = [];

        for (const rule of rules) {
            const value = (sampleData as Record<string, string>)[rule.field];
            let passed = true;
            let message = '';

            switch (rule.type) {
                case 'required':
                    passed = !!value && value.trim() !== '';
                    if (!passed) message = rule.errorMessage;
                    break;

                case 'format':
                case 'regex':
                    if (rule.pattern && value) {
                        try {
                            const regex = new RegExp(rule.pattern);
                            passed = regex.test(value);
                            if (!passed) message = rule.errorMessage;
                        } catch {
                            passed = false;
                            message = 'تعبير نمطي غير صالح';
                        }
                    }
                    break;

                case 'range':
                    const numValue = parseFloat(value);
                    if (!isNaN(numValue)) {
                        if (rule.min !== undefined && numValue < rule.min) {
                            passed = false;
                            message = rule.errorMessage;
                        }
                        if (rule.max !== undefined && numValue > rule.max) {
                            passed = false;
                            message = rule.errorMessage;
                        }
                    } else if (value) {
                        passed = false;
                        message = 'يجب أن تكون قيمة رقمية';
                    }
                    break;
            }

            newResults.push({
                ruleId: rule.id,
                ruleName: rule.nameAr,
                passed,
                message,
            });
        }

        setResults(newResults);
        setIsValidating(false);
    };

    const passedCount = results.filter(r => r.passed).length;
    const failedCount = results.filter(r => !r.passed).length;

    return (
        <div className="space-y-6">
            {/* Sample Data Form */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">بيانات الاختبار</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">رمز المنتج (SKU)</label>
                            <input
                                type="text"
                                value={sampleData.sku}
                                onChange={(e) => setSampleData({ ...sampleData, sku: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">اسم المنتج</label>
                            <input
                                type="text"
                                value={sampleData.name}
                                onChange={(e) => setSampleData({ ...sampleData, name: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">الكمية</label>
                            <input
                                type="number"
                                value={sampleData.quantity}
                                onChange={(e) => setSampleData({ ...sampleData, quantity: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">المستودع</label>
                            <input
                                type="text"
                                value={sampleData.warehouseId}
                                onChange={(e) => setSampleData({ ...sampleData, warehouseId: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">الحد الأدنى</label>
                            <input
                                type="number"
                                value={sampleData.minStock}
                                onChange={(e) => setSampleData({ ...sampleData, minStock: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">الحد الأقصى</label>
                            <input
                                type="number"
                                value={sampleData.maxStock}
                                onChange={(e) => setSampleData({ ...sampleData, maxStock: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                        </div>
                    </div>

                    <Button onClick={runValidation} disabled={isValidating} className="gap-2">
                        <Play className="w-4 h-4" />
                        {isValidating ? 'جاري التحقق...' : 'تشغيل التحقق'}
                    </Button>
                </CardContent>
            </Card>

            {/* Results */}
            {results.length > 0 && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">نتائج التحقق</CardTitle>
                            <div className="flex gap-2">
                                <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-0 gap-1">
                                    <CheckCircle2 className="w-3 h-3" />
                                    {passedCount} نجح
                                </Badge>
                                {failedCount > 0 && (
                                    <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-0 gap-1">
                                        <XCircle className="w-3 h-3" />
                                        {failedCount} فشل
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {results.map((result) => (
                                <div
                                    key={result.ruleId}
                                    className={`flex items-start gap-3 p-3 rounded-lg ${result.passed
                                            ? 'bg-green-50 dark:bg-green-900/20'
                                            : 'bg-red-50 dark:bg-red-900/20'
                                        }`}
                                >
                                    {result.passed ? (
                                        <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                                    ) : (
                                        <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                                    )}
                                    <div className="flex-1">
                                        <p className={`font-medium ${result.passed
                                                ? 'text-green-900 dark:text-green-100'
                                                : 'text-red-900 dark:text-red-100'
                                            }`}>
                                            {result.ruleName}
                                        </p>
                                        {result.message && (
                                            <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                                                {result.message}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* No Results State */}
            {results.length === 0 && (
                <Card>
                    <CardContent className="p-8 text-center text-muted-foreground">
                        <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>أدخل بيانات الاختبار واضغط على "تشغيل التحقق" لرؤية النتائج</p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
