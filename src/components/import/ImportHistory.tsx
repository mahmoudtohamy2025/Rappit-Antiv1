/**
 * Import History Component
 * Displays past import operations
 * 
 * Part of: GAP-07 Import CSV
 */

import { useState, useEffect } from 'react';
import {
    History,
    FileSpreadsheet,
    CheckCircle2,
    AlertCircle,
    AlertTriangle,
    Download,
    RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../UI/card';
import { Button } from '../../UI/button';
import { Badge } from '../../UI/badge';
import { useInventoryImport, ImportHistory as ImportHistoryType, ImportType } from '../../../hooks/inventory/useInventoryImport';

const STATUS_CONFIG = {
    COMPLETED: {
        label: 'مكتمل',
        icon: CheckCircle2,
        color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    },
    PARTIAL: {
        label: 'جزئي',
        icon: AlertTriangle,
        color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    },
    FAILED: {
        label: 'فشل',
        icon: AlertCircle,
        color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    },
};

interface ImportHistoryProps {
    type?: ImportType;
}

export function ImportHistory({ type }: ImportHistoryProps) {
    const { history, getHistory, downloadErrorReport } = useInventoryImport();
    const [isLoading, setIsLoading] = useState(false);

    const loadHistory = async () => {
        setIsLoading(true);
        await getHistory(type);
        setIsLoading(false);
    };

    useEffect(() => {
        loadHistory();
    }, [type]);

    return (
        <Card dir="rtl">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <History className="w-5 h-5" />
                        سجل الاستيراد
                    </CardTitle>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={loadHistory}
                        disabled={isLoading}
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {history.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>لا توجد عمليات استيراد سابقة</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {history.map((item) => {
                            const statusConfig = STATUS_CONFIG[item.status];
                            const StatusIcon = statusConfig.icon;

                            return (
                                <div
                                    key={item.id}
                                    className="p-4 bg-muted rounded-lg flex items-center justify-between"
                                >
                                    <div className="flex items-center gap-3">
                                        <FileSpreadsheet className="w-8 h-8 text-muted-foreground" />
                                        <div>
                                            <p className="font-medium">{item.filename}</p>
                                            <p className="text-sm text-muted-foreground">
                                                {new Date(item.createdAt).toLocaleString('ar-SA')}
                                                {item.userName && ` • ${item.userName}`}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <div className="text-left">
                                            <p className="text-sm text-green-600 dark:text-green-400">
                                                ✓ {item.successRows}
                                            </p>
                                            {item.errorRows > 0 && (
                                                <p className="text-sm text-red-600 dark:text-red-400">
                                                    ✗ {item.errorRows}
                                                </p>
                                            )}
                                        </div>

                                        <Badge
                                            variant="secondary"
                                            className={`gap-1 ${statusConfig.color} border-0`}
                                        >
                                            <StatusIcon className="w-3 h-3" />
                                            {statusConfig.label}
                                        </Badge>

                                        {item.errorRows > 0 && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => downloadErrorReport(item.id)}
                                                title="تحميل تقرير الأخطاء"
                                            >
                                                <Download className="w-4 h-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
