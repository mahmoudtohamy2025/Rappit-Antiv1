/**
 * Import Results Component
 * Shows results after import completion
 * 
 * Part of: UI-INV-01 (Backend: inventory-import.service.ts)
 */

import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Download,
  RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../UI/card';
import { Button } from '../../UI/button';
import { Badge } from '../../UI/badge';

interface ImportError {
  row: number;
  field: string;
  message: string;
  value?: string;
}

interface ImportResultsProps {
  totalRows: number;
  successfulRows: number;
  failedRows: number;
  skippedRows: number;
  errors: ImportError[];
  onDownloadErrors: () => void;
  onImportAgain: () => void;
}

export function ImportResults({ 
  totalRows,
  successfulRows, 
  failedRows,
  skippedRows,
  errors,
  onDownloadErrors,
  onImportAgain
}: ImportResultsProps) {
  const isFullSuccess = failedRows === 0;
  const isPartialSuccess = successfulRows > 0 && failedRows > 0;

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <Card className={
        isFullSuccess 
          ? 'border-green-200 dark:border-green-800' 
          : isPartialSuccess
          ? 'border-yellow-200 dark:border-yellow-800'
          : 'border-red-200 dark:border-red-800'
      }>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            {isFullSuccess ? (
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            ) : isPartialSuccess ? (
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
            ) : (
              <XCircle className="w-5 h-5 text-red-600" />
            )}
            {isFullSuccess 
              ? 'اكتمل الاستيراد بنجاح' 
              : isPartialSuccess
              ? 'اكتمل الاستيراد مع أخطاء'
              : 'فشل الاستيراد'
            }
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold">{totalRows}</p>
              <p className="text-sm text-muted-foreground">إجمالي الصفوف</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{successfulRows}</p>
              <p className="text-sm text-muted-foreground">تم بنجاح</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">{failedRows}</p>
              <p className="text-sm text-muted-foreground">فشل</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-600">{skippedRows}</p>
              <p className="text-sm text-muted-foreground">تم تخطيه</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Errors List */}
      {errors.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2 text-red-600">
                <XCircle className="w-4 h-4" />
                الأخطاء ({errors.length})
              </CardTitle>
              <Button variant="outline" size="sm" onClick={onDownloadErrors} className="gap-2">
                <Download className="w-4 h-4" />
                تحميل الأخطاء
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-60 overflow-y-auto space-y-2">
              {errors.slice(0, 10).map((error, index) => (
                <div 
                  key={index}
                  className="flex items-start gap-3 p-2 bg-red-50 dark:bg-red-900/20 rounded text-sm"
                >
                  <Badge variant="outline" className="shrink-0">
                    صف {error.row}
                  </Badge>
                  <div className="flex-1">
                    <p className="font-medium">{error.field}</p>
                    <p className="text-red-600 dark:text-red-400">{error.message}</p>
                    {error.value && (
                      <p className="text-xs text-muted-foreground">
                        القيمة: "{error.value}"
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {errors.length > 10 && (
                <p className="text-sm text-muted-foreground text-center py-2">
                  و {errors.length - 10} أخطاء أخرى...
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex justify-end">
        <Button onClick={onImportAgain} variant="outline" className="gap-2">
          <RefreshCw className="w-4 h-4" />
          استيراد ملف آخر
        </Button>
      </div>
    </div>
  );
}
