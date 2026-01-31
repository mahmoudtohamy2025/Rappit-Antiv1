/**
 * Cycle Count List Component
 * Displays list of cycle counts
 * 
 * Part of: UI-INV-03 (Backend: cycle-count.service.ts)
 */

import {
    ClipboardCheck,
    Clock,
    CheckCircle2,
    AlertTriangle,
    XCircle,
    Play,
    Eye
} from 'lucide-react';
import { Card, CardContent } from '../../UI/card';
import { Button } from '../../UI/button';
import { Badge } from '../../UI/badge';
import { Progress } from '../../UI/progress';

interface CycleCount {
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
}

interface CycleCountListProps {
    cycleCounts: CycleCount[];
    onStart: (id: string) => void;
    onContinue: (id: string) => void;
    onReview: (id: string) => void;
    onView: (id: string) => void;
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

export function CycleCountList({
    cycleCounts,
    onStart,
    onContinue,
    onReview,
    onView
}: CycleCountListProps) {

    if (cycleCounts.length === 0) {
        return (
            <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                    <ClipboardCheck className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg mb-2">لا توجد عمليات جرد</p>
                    <p className="text-sm">انقر على "جرد جديد" لإنشاء عملية جرد</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            {cycleCounts.map((cc) => {
                const statusConfig = STATUS_CONFIG[cc.status];
                const StatusIcon = statusConfig.icon;
                const progress = cc.totalItems > 0
                    ? Math.round((cc.countedItems / cc.totalItems) * 100)
                    : 0;

                return (
                    <Card key={cc.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                {/* Info */}
                                <div className="flex-1 space-y-3">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h3 className="font-medium text-lg">{cc.name}</h3>
                                        <Badge
                                            variant="secondary"
                                            className={`gap-1 ${statusConfig.color} border-0`}
                                        >
                                            <StatusIcon className="w-3 h-3" />
                                            {statusConfig.label}
                                        </Badge>
                                    </div>

                                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                                        <span>{cc.warehouseName}</span>
                                        {cc.assignee && <span>المسؤول: {cc.assignee}</span>}
                                        <span>الاستحقاق: {cc.dueDate}</span>
                                    </div>

                                    {/* Progress for active counts */}
                                    {(cc.status === 'IN_PROGRESS' || cc.status === 'PENDING_APPROVAL') && (
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span>التقدم</span>
                                                <span className="font-medium">
                                                    {cc.countedItems} / {cc.totalItems} ({progress}%)
                                                </span>
                                            </div>
                                            <Progress value={progress} className="h-2" />
                                        </div>
                                    )}

                                    {/* Variance warning */}
                                    {cc.varianceItems > 0 && cc.status !== 'DRAFT' && (
                                        <div className="flex items-center gap-2 text-sm text-orange-600 dark:text-orange-400">
                                            <AlertTriangle className="w-4 h-4" />
                                            <span>{cc.varianceItems} منتجات بها فروقات</span>
                                        </div>
                                    )}

                                    {/* Completed stats */}
                                    {cc.status === 'COMPLETED' && (
                                        <div className="flex gap-4 text-sm">
                                            <span className="text-green-600 dark:text-green-400">
                                                ✓ تم عد {cc.countedItems} منتج
                                            </span>
                                            {cc.varianceItems > 0 && (
                                                <span className="text-orange-600 dark:text-orange-400">
                                                    {cc.varianceItems} فروقات
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2">
                                    {cc.status === 'DRAFT' && (
                                        <Button size="sm" onClick={() => onStart(cc.id)} className="gap-1">
                                            <Play className="w-4 h-4" />
                                            بدء الجرد
                                        </Button>
                                    )}
                                    {cc.status === 'IN_PROGRESS' && (
                                        <Button size="sm" variant="outline" onClick={() => onContinue(cc.id)}>
                                            متابعة
                                        </Button>
                                    )}
                                    {cc.status === 'PENDING_APPROVAL' && (
                                        <Button size="sm" variant="outline" onClick={() => onReview(cc.id)}>
                                            مراجعة
                                        </Button>
                                    )}
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => onView(cc.id)}
                                        className="h-8 w-8"
                                    >
                                        <Eye className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}
