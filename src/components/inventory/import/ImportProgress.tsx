/**
 * Import Progress Component
 * Progress indicator during CSV import
 * 
 * Part of: UI-INV-01 (Backend: inventory-import.service.ts - 105 tests)
 */

import { Upload, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { Progress } from '../../UI/progress';
import { Card, CardContent } from '../../UI/card';

interface ImportProgressProps {
    fileName: string;
    totalRows: number;
    processedRows: number;
    successfulRows: number;
    failedRows: number;
    status: 'uploading' | 'processing' | 'completed' | 'failed';
}

export function ImportProgress({
    fileName,
    totalRows,
    processedRows,
    successfulRows,
    failedRows,
    status
}: ImportProgressProps) {
    const progress = totalRows > 0 ? Math.round((processedRows / totalRows) * 100) : 0;

    return (
        <Card>
            <CardContent className="p-4 space-y-4">
                {/* File Info */}
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${status === 'completed'
                            ? 'bg-green-100 dark:bg-green-900/30'
                            : status === 'failed'
                                ? 'bg-red-100 dark:bg-red-900/30'
                                : 'bg-blue-100 dark:bg-blue-900/30'
                        }`}>
                        {status === 'completed' ? (
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                        ) : status === 'failed' ? (
                            <XCircle className="w-5 h-5 text-red-600" />
                        ) : (
                            <Upload className="w-5 h-5 text-blue-600" />
                        )}
                    </div>
                    <div className="flex-1">
                        <p className="font-medium text-sm">{fileName}</p>
                        <p className="text-xs text-muted-foreground">
                            {status === 'uploading' && 'جاري رفع الملف...'}
                            {status === 'processing' && 'جاري معالجة البيانات...'}
                            {status === 'completed' && 'اكتمل الاستيراد'}
                            {status === 'failed' && 'فشل الاستيراد'}
                        </p>
                    </div>
                </div>

                {/* Progress Bar */}
                {(status === 'uploading' || status === 'processing') && (
                    <div className="space-y-2">
                        <Progress value={progress} className="h-2" />
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{processedRows} / {totalRows} صف</span>
                            <span>{progress}%</span>
                        </div>
                    </div>
                )}

                {/* Stats */}
                {(status === 'completed' || status === 'processing') && (
                    <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-2 bg-muted rounded">
                            <p className="text-lg font-bold">{totalRows}</p>
                            <p className="text-xs text-muted-foreground">إجمالي</p>
                        </div>
                        <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded">
                            <p className="text-lg font-bold text-green-600">{successfulRows}</p>
                            <p className="text-xs text-muted-foreground">نجح</p>
                        </div>
                        <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded">
                            <p className="text-lg font-bold text-red-600">{failedRows}</p>
                            <p className="text-xs text-muted-foreground">فشل</p>
                        </div>
                    </div>
                )}

                {/* Warning for failed rows */}
                {failedRows > 0 && (
                    <div className="flex items-center gap-2 text-sm text-orange-600 dark:text-orange-400">
                        <AlertTriangle className="w-4 h-4" />
                        <span>{failedRows} صفوف تحتوي على أخطاء</span>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
