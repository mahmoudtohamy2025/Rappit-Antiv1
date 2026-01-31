/**
 * Variance Report Component
 * Displays variance summary and details after cycle count
 * 
 * Part of: UI-INV-03 (Backend: cycle-count.service.ts)
 */

import {
    AlertTriangle,
    CheckCircle2,
    TrendingUp,
    TrendingDown,
    FileText
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../UI/card';
import { Button } from '../../UI/button';
import { Badge } from '../../UI/badge';

interface VarianceItem {
    id: string;
    sku: string;
    productName: string;
    systemQty: number;
    countedQty: number;
    variance: number;
    variancePercent: number;
    needsApproval: boolean;
}

interface VarianceReportProps {
    cycleCountId: string;
    cycleCountName: string;
    items: VarianceItem[];
    onApproveAll: () => void;
    onApplyAdjustments: () => void;
    onExport: () => void;
}

export function VarianceReport({
    cycleCountId,
    cycleCountName,
    items,
    onApproveAll,
    onApplyAdjustments,
    onExport
}: VarianceReportProps) {
    const totalItems = items.length;
    const noVarianceItems = items.filter(i => i.variance === 0).length;
    const positiveVarianceItems = items.filter(i => i.variance > 0);
    const negativeVarianceItems = items.filter(i => i.variance < 0);
    const needsApprovalItems = items.filter(i => i.needsApproval);

    const totalPositive = positiveVarianceItems.reduce((sum, i) => sum + i.variance, 0);
    const totalNegative = negativeVarianceItems.reduce((sum, i) => sum + i.variance, 0);
    const netVariance = totalPositive + totalNegative;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-xl font-semibold">تقرير الفروقات</h2>
                    <p className="text-muted-foreground">{cycleCountName}</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={onExport} className="gap-2">
                        <FileText className="w-4 h-4" />
                        تصدير التقرير
                    </Button>
                </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">إجمالي المنتجات</p>
                        <p className="text-2xl font-bold">{totalItems}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">بدون فرق</p>
                        <p className="text-2xl font-bold text-green-600">{noVarianceItems}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <TrendingUp className="w-4 h-4 text-blue-500" />
                            زيادة
                        </p>
                        <p className="text-2xl font-bold text-blue-600">+{totalPositive}</p>
                        <p className="text-xs text-muted-foreground">{positiveVarianceItems.length} منتج</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <TrendingDown className="w-4 h-4 text-red-500" />
                            نقص
                        </p>
                        <p className="text-2xl font-bold text-red-600">{totalNegative}</p>
                        <p className="text-xs text-muted-foreground">{negativeVarianceItems.length} منتج</p>
                    </CardContent>
                </Card>
            </div>

            {/* Net Variance */}
            <Card className={netVariance === 0
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200'
                : netVariance > 0
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200'
                    : 'bg-red-50 dark:bg-red-900/20 border-red-200'
            }>
                <CardContent className="p-6 text-center">
                    <p className="text-lg text-muted-foreground mb-2">صافي الفرق</p>
                    <p className={`text-4xl font-bold ${netVariance === 0
                            ? 'text-green-600'
                            : netVariance > 0
                                ? 'text-blue-600'
                                : 'text-red-600'
                        }`}>
                        {netVariance > 0 ? '+' : ''}{netVariance}
                    </p>
                </CardContent>
            </Card>

            {/* Items Needing Approval */}
            {needsApprovalItems.length > 0 && (
                <Card className="border-yellow-200 dark:border-yellow-800">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
                                <AlertTriangle className="w-5 h-5" />
                                تحتاج موافقة ({needsApprovalItems.length})
                            </CardTitle>
                            <Button onClick={onApproveAll} size="sm">
                                الموافقة على الكل
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {needsApprovalItems.map((item) => (
                                <div
                                    key={item.id}
                                    className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg"
                                >
                                    <div>
                                        <p className="font-medium">{item.productName}</p>
                                        <p className="text-sm text-muted-foreground font-mono">{item.sku}</p>
                                    </div>
                                    <div className="text-left">
                                        <p className="text-sm text-muted-foreground">
                                            {item.systemQty} → {item.countedQty}
                                        </p>
                                        <Badge className={`${item.variance > 0
                                                ? 'bg-blue-100 text-blue-700'
                                                : 'bg-red-100 text-red-700'
                                            } border-0`}>
                                            {item.variance > 0 ? '+' : ''}{item.variance} ({item.variancePercent}%)
                                        </Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* All Items Table */}
            <Card>
                <CardHeader>
                    <CardTitle>جميع المنتجات</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-muted/50">
                                <tr>
                                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">المنتج</th>
                                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">النظام</th>
                                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">الفعلي</th>
                                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">الفرق</th>
                                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">الحالة</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item) => (
                                    <tr key={item.id} className="border-t border-border">
                                        <td className="px-4 py-3">
                                            <p className="font-medium">{item.productName}</p>
                                            <p className="text-xs text-muted-foreground font-mono">{item.sku}</p>
                                        </td>
                                        <td className="px-4 py-3 text-sm">{item.systemQty}</td>
                                        <td className="px-4 py-3 text-sm font-medium">{item.countedQty}</td>
                                        <td className="px-4 py-3">
                                            <span className={`font-medium ${item.variance === 0
                                                    ? 'text-green-600'
                                                    : item.variance > 0
                                                        ? 'text-blue-600'
                                                        : 'text-red-600'
                                                }`}>
                                                {item.variance > 0 ? '+' : ''}{item.variance}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {item.variance === 0 ? (
                                                <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-0 gap-1">
                                                    <CheckCircle2 className="w-3 h-3" />
                                                    متطابق
                                                </Badge>
                                            ) : item.needsApproval ? (
                                                <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 border-0 gap-1">
                                                    <AlertTriangle className="w-3 h-3" />
                                                    يحتاج موافقة
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline">فرق</Badge>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 justify-end">
                <Button variant="outline" onClick={onExport}>
                    تصدير التقرير
                </Button>
                <Button onClick={onApplyAdjustments}>
                    تطبيق التعديلات على المخزون
                </Button>
            </div>
        </div>
    );
}
