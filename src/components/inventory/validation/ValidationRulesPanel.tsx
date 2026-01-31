/**
 * Validation Rules Panel
 * Main settings panel for inventory validation rules
 * 
 * Part of: UI-INV-04 (Backend: inventory-validation.service.ts - 57 tests)
 */

import { useState } from 'react';
import {
    Shield,
    Plus,
    Settings,
    CheckCircle2,
    AlertTriangle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../UI/card';
import { Button } from '../../UI/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../UI/tabs';
import { RuleList } from './RuleList';
import { RuleEditor } from './RuleEditor';
import { ValidationPreview } from './ValidationPreview';

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

export function ValidationRulesPanel() {
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [selectedRule, setSelectedRule] = useState<ValidationRule | null>(null);
    const [activeTab, setActiveTab] = useState('rules');

    // Built-in rules (from backend)
    const builtInRules: ValidationRule[] = [
        {
            id: 'rule-sku-format',
            name: 'SKU Format',
            nameAr: 'تنسيق رمز المنتج',
            type: 'format',
            field: 'sku',
            pattern: '^[A-Z]{2,4}-\\d{3,6}$',
            enabled: true,
            isBuiltIn: true,
            errorMessage: 'تنسيق SKU غير صالح. يجب أن يكون: XXXX-000',
        },
        {
            id: 'rule-qty-positive',
            name: 'Quantity Non-Negative',
            nameAr: 'كمية غير سالبة',
            type: 'range',
            field: 'quantity',
            min: 0,
            enabled: true,
            isBuiltIn: true,
            errorMessage: 'الكمية يجب أن تكون صفر أو أكثر',
        },
        {
            id: 'rule-warehouse-required',
            name: 'Warehouse Required',
            nameAr: 'المستودع مطلوب',
            type: 'required',
            field: 'warehouseId',
            enabled: true,
            isBuiltIn: true,
            errorMessage: 'يجب تحديد المستودع',
        },
        {
            id: 'rule-name-required',
            name: 'Product Name Required',
            nameAr: 'اسم المنتج مطلوب',
            type: 'required',
            field: 'name',
            enabled: true,
            isBuiltIn: true,
            errorMessage: 'يجب إدخال اسم المنتج',
        },
    ];

    // Custom rules (user-created)
    const [customRules, setCustomRules] = useState<ValidationRule[]>([
        {
            id: 'rule-custom-1',
            name: 'Min Stock Alert',
            nameAr: 'تنبيه الحد الأدنى',
            type: 'range',
            field: 'minStock',
            min: 0,
            max: 1000,
            enabled: true,
            isBuiltIn: false,
            errorMessage: 'الحد الأدنى يجب أن يكون بين 0 و 1000',
        },
    ]);

    const allRules = [...builtInRules, ...customRules];
    const enabledCount = allRules.filter(r => r.enabled).length;

    const handleEditRule = (rule: ValidationRule) => {
        setSelectedRule(rule);
        setIsEditorOpen(true);
    };

    const handleSaveRule = (rule: ValidationRule) => {
        if (rule.isBuiltIn) {
            // Can only toggle enable/disable for built-in rules
            return;
        }

        if (selectedRule) {
            // Edit existing
            setCustomRules(prev =>
                prev.map(r => r.id === rule.id ? rule : r)
            );
        } else {
            // Add new
            setCustomRules(prev => [...prev, { ...rule, id: `rule-custom-${Date.now()}` }]);
        }
        setIsEditorOpen(false);
        setSelectedRule(null);
    };

    const handleDeleteRule = (ruleId: string) => {
        setCustomRules(prev => prev.filter(r => r.id !== ruleId));
    };

    const handleToggleRule = (ruleId: string, enabled: boolean) => {
        // For built-in rules, we'd call the backend
        // For custom rules, update local state
        setCustomRules(prev =>
            prev.map(r => r.id === ruleId ? { ...r, enabled } : r)
        );
    };

    return (
        <div className="space-y-6" dir="rtl">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold flex items-center gap-2">
                        <Shield className="w-6 h-6" />
                        قواعد التحقق
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        إدارة قواعد التحقق من صحة بيانات المخزون
                    </p>
                </div>
                <Button onClick={() => { setSelectedRule(null); setIsEditorOpen(true); }} className="gap-2">
                    <Plus className="w-4 h-4" />
                    قاعدة جديدة
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">إجمالي القواعد</p>
                        <p className="text-2xl font-bold">{allRules.length}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">مُفعّلة</p>
                        <p className="text-2xl font-bold text-green-600">{enabledCount}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">أساسية</p>
                        <p className="text-2xl font-bold text-blue-600">{builtInRules.length}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">مخصصة</p>
                        <p className="text-2xl font-bold text-purple-600">{customRules.length}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Main Content */}
            <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl">
                <TabsList>
                    <TabsTrigger value="rules" className="gap-2">
                        <Settings className="w-4 h-4" />
                        القواعد
                    </TabsTrigger>
                    <TabsTrigger value="preview" className="gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        اختبار
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="rules" className="mt-6">
                    <RuleList
                        builtInRules={builtInRules}
                        customRules={customRules}
                        onEdit={handleEditRule}
                        onDelete={handleDeleteRule}
                        onToggle={handleToggleRule}
                    />
                </TabsContent>

                <TabsContent value="preview" className="mt-6">
                    <ValidationPreview rules={allRules.filter(r => r.enabled)} />
                </TabsContent>
            </Tabs>

            {/* Rule Editor Modal */}
            <RuleEditor
                open={isEditorOpen}
                onOpenChange={setIsEditorOpen}
                rule={selectedRule}
                onSave={handleSaveRule}
            />
        </div>
    );
}
