/**
 * Validation Preview Component
 * Shows CSV validation results before import
 * 
 * Part of: GAP-07 Import CSV
 */

import {
    CheckCircle2,
    AlertCircle,
    AlertTriangle,
    FileCheck,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../UI/card';
import { Badge } from '../../UI/badge';
import { ValidationResult } from '../../../hooks/inventory/useInventoryImport';

interface ValidationPreviewProps {
    validation: ValidationResult;
}

export function ValidationPreview({ validation }: ValidationPreviewProps) {
    const hasErrors = validation.errorRows > 0;

    return (
        <div className="space-y-4" dir="rtl">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-4">
                <Card>
                    <CardContent className="p-4 text-center">
                        <p className="text-2xl font-bold">{validation.totalRows}</p>
                        <p className="text-sm text-muted-foreground">إجمالي الصفوف</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 text-center">
                        <p className="text-2xl font-bold text-green-600">{validation.validRows}</p>
                        <p className="text-sm text-muted-foreground">صفوف صالحة</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 text-center">
                        <p className="text-2xl font-bold text-red-600">{validation.errorRows}</p>
                        <p className="text-sm text-muted-foreground">صفوف بها أخطاء</p>
                    </CardContent>
                </Card>
            </div>

            {/* Validation Status */}
            <div className={`p-4 rounded-lg flex items-center gap-3 ${validation.valid
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                    : 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300'
                }`}>
                {validation.valid ? (
                    <>
                        <CheckCircle2 className="w-5 h-5" />
                        <span>جميع الصفوف صالحة للاستيراد</span>
                    </>
                ) : (
                    <>
                        <AlertTriangle className="w-5 h-5" />
                        <span>توجد أخطاء في بعض الصفوف. يمكن تخطيها والاستمرار.</span>
                    </>
                )}
            </div>

            {/* Errors */}
            {hasErrors && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-red-600 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" />
                            الأخطاء ({validation.errors.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="max-h-48 overflow-y-auto space-y-2">
                            {validation.errors.slice(0, 10).map((error, index) => (
                                <div
                                    key={index}
                                    className="p-2 bg-red-50 dark:bg-red-900/20 rounded text-sm"
                                >
                                    <span className="font-medium">صف {error.row}:</span>{' '}
                                    <span className="text-red-600 dark:text-red-400">{error.message}</span>
                                    {error.field && (
                                        <Badge variant="outline" className="mr-2 text-xs">
                                            {error.field}
                                        </Badge>
                                    )}
                                </div>
                            ))}
                            {validation.errors.length > 10 && (
                                <p className="text-sm text-muted-foreground text-center">
                                    و {validation.errors.length - 10} أخطاء أخرى...
                                </p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Preview */}
            {validation.preview && validation.preview.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileCheck className="w-4 h-4" />
                            معاينة (أول 5 صفوف)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-muted">
                                    <tr>
                                        {validation.headers.map((header) => (
                                            <th key={header} className="px-3 py-2 text-right">
                                                {header}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {validation.preview.map((row, index) => (
                                        <tr key={index} className="border-t">
                                            {validation.headers.map((header) => (
                                                <td key={header} className="px-3 py-2">
                                                    {row.data?.[header] || row[header] || '-'}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
