/**
 * Cycle Count Details Component
 * Detail view for a cycle count
 * 
 * Part of: UI-INV-03 (Backend: cycle-count.service.ts)
 */

import {
    ClipboardCheck,
    Calendar,
    User,
    Warehouse,
    Clock,
    CheckCircle2,
    AlertTriangle,
    XCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../UI/card';
import { Badge } from '../../UI/badge';
import { Progress } from '../../UI/progress';

interface CycleCountDetailsProps {
    cycleCount: {
        id: string;
        name: string;
        warehouseName: string;
        status: 'DRAFT' | 'IN_PROGRESS' | 'PENDING_APPROVAL' | 'COMPLETED' | 'CANCELLED';
        totalItems: number;
        countedItems: number;
        varianceItems: number;
        assignee?: string;
        dueDate: string;
        createdAt: string;
        completedAt?: string;
    };
}

const STATUS_CONFIG = {
    DRAFT: {
        label: 'مسودة',
        color: 'bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-300',
        icon: ClipboardCheck
    },
    IN_PROGRESS: {
        label: 'قيد التنفيذ',
        color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
        icon: Clock
    },
    PENDING_APPROVAL: {
        label: 'بانتظار الموافقة',
        color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
        icon: AlertTriangle
    },
    COMPLETED: {
        label: 'مكتمل',
        color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
        icon: CheckCircle2
    },
    CANCELLED: {
        label: 'ملغي',
        color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
        icon: XCircle
    },
};

export function CycleCountDetails({ cycleCount }: CycleCountDetailsProps) {
    const statusConfig = STATUS_CONFIG[cycleCount.status];
    const StatusIcon = statusConfig.icon;
    const progress = cycleCount.totalItems > 0
        ? Math.round((cycleCount.countedItems / cycleCount.totalItems) * 100)
        : 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <Card>
                <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-muted rounded-lg">
                                <ClipboardCheck className="w-8 h-8" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-semibold mb-2">{cycleCount.name}</h1>
                                <Badge
                                    variant="secondary"
                                    className={`gap-1 ${statusConfig.color} border-0`}
                                >
                                    <StatusIcon className="w-3 h-3" />
                                    {statusConfig.label}
                                </Badge>
                            </div>
                        </div>
                    </div>

                    {/* Details */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
                        <div className="flex items-center gap-2 text-sm">
                            <Warehouse className="w-4 h-4 text-muted-foreground" />
                            <span>{cycleCount.warehouseName}</span>
                        </div>
                        {cycleCount.assignee && (
                            <div className="flex items-center gap-2 text-sm">
                                <User className="w-4 h-4 text-muted-foreground" />
                                <span>{cycleCount.assignee}</span>
                            </div>
                        )}
                        <div className="flex items-center gap-2 text-sm">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            <span>الاستحقاق: {cycleCount.dueDate}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="w-4 h-4" />
                            <span>أنشئ: {cycleCount.createdAt}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Progress */}
            <Card>
                <CardHeader>
                    <CardTitle>التقدم</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span>المنتجات المعدودة</span>
                            <span className="font-medium">
                                {cycleCount.countedItems} / {cycleCount.totalItems}
                            </span>
                        </div>
                        <Progress value={progress} className="h-3" />
                    </div>

                    <div className="grid grid-cols-3 gap-4 pt-4">
                        <div className="text-center p-4 bg-muted rounded-lg">
                            <p className="text-2xl font-bold">{cycleCount.totalItems}</p>
                            <p className="text-sm text-muted-foreground">إجمالي</p>
                        </div>
                        <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                            <p className="text-2xl font-bold text-green-600">{cycleCount.countedItems}</p>
                            <p className="text-sm text-muted-foreground">معدود</p>
                        </div>
                        <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                            <p className="text-2xl font-bold text-orange-600">{cycleCount.varianceItems}</p>
                            <p className="text-sm text-muted-foreground">فروقات</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Timeline placeholder */}
            <Card>
                <CardHeader>
                    <CardTitle>الجدول الزمني</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="flex gap-3">
                            <div className="w-2 h-2 mt-2 bg-green-500 rounded-full" />
                            <div>
                                <p className="font-medium">تم إنشاء الجرد</p>
                                <p className="text-sm text-muted-foreground">{cycleCount.createdAt}</p>
                            </div>
                        </div>
                        {cycleCount.status !== 'DRAFT' && (
                            <div className="flex gap-3">
                                <div className="w-2 h-2 mt-2 bg-blue-500 rounded-full" />
                                <div>
                                    <p className="font-medium">بدء عملية العد</p>
                                    <p className="text-sm text-muted-foreground">تم بدء العد الفعلي</p>
                                </div>
                            </div>
                        )}
                        {cycleCount.completedAt && (
                            <div className="flex gap-3">
                                <div className="w-2 h-2 mt-2 bg-green-500 rounded-full" />
                                <div>
                                    <p className="font-medium">اكتمال الجرد</p>
                                    <p className="text-sm text-muted-foreground">{cycleCount.completedAt}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
