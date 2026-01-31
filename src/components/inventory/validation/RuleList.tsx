/**
 * Rule List Component
 * Displays built-in and custom validation rules
 * 
 * Part of: UI-INV-04 (Backend: inventory-validation.service.ts)
 */

import {
    Edit,
    Trash2,
    Shield,
    Lock,
    Regex,
    Hash,
    Type,
    FileCheck
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../UI/card';
import { Button } from '../../UI/button';
import { Badge } from '../../UI/badge';
import { RuleToggle } from './RuleToggle';

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

interface RuleListProps {
    builtInRules: ValidationRule[];
    customRules: ValidationRule[];
    onEdit: (rule: ValidationRule) => void;
    onDelete: (ruleId: string) => void;
    onToggle: (ruleId: string, enabled: boolean) => void;
}

const TYPE_CONFIG = {
    format: { label: 'تنسيق', icon: Type, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
    range: { label: 'نطاق', icon: Hash, color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
    required: { label: 'مطلوب', icon: FileCheck, color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
    regex: { label: 'تعبير نمطي', icon: Regex, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
    custom: { label: 'مخصص', icon: Shield, color: 'bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-300' },
};

const FIELD_LABELS: Record<string, string> = {
    sku: 'رمز المنتج (SKU)',
    name: 'اسم المنتج',
    quantity: 'الكمية',
    warehouseId: 'المستودع',
    minStock: 'الحد الأدنى',
    maxStock: 'الحد الأقصى',
    category: 'الفئة',
    price: 'السعر',
};

export function RuleList({ builtInRules, customRules, onEdit, onDelete, onToggle }: RuleListProps) {
    const renderRule = (rule: ValidationRule) => {
        const typeConfig = TYPE_CONFIG[rule.type] || TYPE_CONFIG.custom;
        const TypeIcon = typeConfig.icon;

        return (
            <Card key={rule.id} className={`transition-opacity ${!rule.enabled ? 'opacity-60' : ''}`}>
                <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                        {/* Rule Info */}
                        <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-medium">{rule.nameAr}</h3>
                                <Badge variant="secondary" className={`gap-1 ${typeConfig.color} border-0`}>
                                    <TypeIcon className="w-3 h-3" />
                                    {typeConfig.label}
                                </Badge>
                                {rule.isBuiltIn && (
                                    <Badge variant="outline" className="gap-1 text-xs">
                                        <Lock className="w-3 h-3" />
                                        أساسية
                                    </Badge>
                                )}
                            </div>

                            <div className="text-sm text-muted-foreground space-y-1">
                                <p>الحقل: <span className="font-medium">{FIELD_LABELS[rule.field] || rule.field}</span></p>
                                {rule.pattern && <p>النمط: <code className="text-xs bg-muted px-1 rounded">{rule.pattern}</code></p>}
                                {(rule.min !== undefined || rule.max !== undefined) && (
                                    <p>
                                        النطاق:
                                        {rule.min !== undefined && <span className="font-medium"> {rule.min}</span>}
                                        {rule.min !== undefined && rule.max !== undefined && ' - '}
                                        {rule.max !== undefined && <span className="font-medium">{rule.max}</span>}
                                    </p>
                                )}
                                <p className="text-xs text-orange-600 dark:text-orange-400">
                                    رسالة الخطأ: {rule.errorMessage}
                                </p>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                            <RuleToggle
                                enabled={rule.enabled}
                                onChange={(enabled) => onToggle(rule.id, enabled)}
                            />

                            {!rule.isBuiltIn && (
                                <>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => onEdit(rule)}
                                        className="h-8 w-8"
                                    >
                                        <Edit className="w-4 h-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => onDelete(rule.id)}
                                        className="h-8 w-8 text-destructive hover:text-destructive"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    };

    return (
        <div className="space-y-6">
            {/* Built-in Rules */}
            <div className="space-y-4">
                <h2 className="text-lg font-medium flex items-center gap-2">
                    <Lock className="w-5 h-5 text-blue-600" />
                    القواعد الأساسية
                </h2>
                <div className="grid gap-3">
                    {builtInRules.map(renderRule)}
                </div>
            </div>

            {/* Custom Rules */}
            <div className="space-y-4">
                <h2 className="text-lg font-medium flex items-center gap-2">
                    <Shield className="w-5 h-5 text-purple-600" />
                    القواعد المخصصة
                </h2>
                {customRules.length > 0 ? (
                    <div className="grid gap-3">
                        {customRules.map(renderRule)}
                    </div>
                ) : (
                    <Card>
                        <CardContent className="p-8 text-center text-muted-foreground">
                            لا توجد قواعد مخصصة. انقر على "قاعدة جديدة" لإضافة واحدة.
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
