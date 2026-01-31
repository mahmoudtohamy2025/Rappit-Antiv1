/**
 * Import Preview Component
 * Preview parsed CSV data before import
 * 
 * Part of: UI-INV-01 (Backend: inventory-import.service.ts)
 */

import { CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../UI/card';
import { Badge } from '../../UI/badge';

interface PreviewRow {
    rowNumber: number;
    sku: string;
    name: string;
    quantity: number;
    warehouse: string;
    isValid: boolean;
    errors?: string[];
    action: 'create' | 'update' | 'skip';
}

interface ImportPreviewProps {
    fileName: string;
    totalRows: number;
    validRows: number;
    invalidRows: number;
    newItems: number;
    updateItems: number;
    previewData: PreviewRow[];
}

export function ImportPreview({
    fileName,
    totalRows,
    validRows,
    invalidRows,
    newItems,
    updateItems,
    previewData
}: ImportPreviewProps) {

    const getActionBadge = (action: string) => {
        switch (action) {
            case 'create':
                return (
                    <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-0">
                        جديد
                    </Badge>
                );
            case 'update':
                return (
                    <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-0">
                        تحديث
                    </Badge>
                );
            case 'skip':
                return (
                    <Badge className="bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-300 border-0">
                        تخطي
                    </Badge>
                );
        }
    };

    return (
        <div className="space-y-4">
            {/* Summary */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Info className="w-4 h-4" />
                        معاينة الملف: {fileName}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                        <div className="p-2 bg-muted rounded">
                            <p className="text-xl font-bold">{totalRows}</p>
                            <p className="text-xs text-muted-foreground">إجمالي</p>
                        </div>
                        <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded">
                            <p className="text-xl font-bold text-green-600">{validRows}</p>
                            <p className="text-xs text-muted-foreground">صالح</p>
                        </div>
                        <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded">
                            <p className="text-xl font-bold text-red-600">{invalidRows}</p>
                            <p className="text-xs text-muted-foreground">غير صالح</p>
                        </div>
                        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                            <p className="text-xl font-bold text-blue-600">{newItems}</p>
                            <p className="text-xs text-muted-foreground">جديد</p>
                        </div>
                        <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded">
                            <p className="text-xl font-bold text-purple-600">{updateItems}</p>
                            <p className="text-xs text-muted-foreground">تحديث</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Preview Table */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base">معاينة البيانات (أول 10 صفوف)</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-muted/50">
                                <tr>
                                    <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">#</th>
                                    <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">SKU</th>
                                    <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">الاسم</th>
                                    <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">الكمية</th>
                                    <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">المستودع</th>
                                    <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">الحالة</th>
                                    <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">الإجراء</th>
                                </tr>
                            </thead>
                            <tbody>
                                {previewData.map((row) => (
                                    <tr
                                        key={row.rowNumber}
                                        className={`border-t border-border ${!row.isValid ? 'bg-red-50 dark:bg-red-900/10' : ''
                                            }`}
                                    >
                                        <td className="px-3 py-2 text-xs text-muted-foreground">{row.rowNumber}</td>
                                        <td className="px-3 py-2 text-xs font-mono">{row.sku}</td>
                                        <td className="px-3 py-2 text-xs">{row.name}</td>
                                        <td className="px-3 py-2 text-xs">{row.quantity}</td>
                                        <td className="px-3 py-2 text-xs">{row.warehouse}</td>
                                        <td className="px-3 py-2">
                                            {row.isValid ? (
                                                <CheckCircle2 className="w-4 h-4 text-green-600" />
                                            ) : (
                                                <div className="flex items-center gap-1">
                                                    <AlertTriangle className="w-4 h-4 text-red-600" />
                                                    {row.errors && (
                                                        <span className="text-xs text-red-600">{row.errors[0]}</span>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-3 py-2">{getActionBadge(row.action)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
