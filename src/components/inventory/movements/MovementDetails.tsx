/**
 * Movement Details Component
 * Detail view for a stock movement
 * 
 * Part of: UI-INV-02 (Backend: stock-movement.service.ts)
 */

import {
    PackagePlus,
    Truck,
    RotateCcw,
    ArrowRight,
    ArrowLeft,
    Plus,
    Minus,
    AlertTriangle,
    Clock,
    CheckCircle2,
    XCircle,
    Warehouse,
    User,
    FileText
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '../../UI/dialog';
import { Button } from '../../UI/button';
import { Badge } from '../../UI/badge';

interface MovementDetailsProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    movement: {
        id: string;
        type: 'RECEIVE' | 'SHIP' | 'RETURN' | 'TRANSFER_OUT' | 'TRANSFER_IN' | 'ADJUSTMENT_ADD' | 'ADJUSTMENT_REMOVE' | 'DAMAGE';
        sku: string;
        productName: string;
        quantity: number;
        warehouseName: string;
        status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
        reason: string;
        referenceType?: string;
        referenceId?: string;
        createdBy: string;
        createdAt: string;
        executedAt?: string;
        executedBy?: string;
    } | null;
    onExecute?: (id: string) => void;
    onCancel?: (id: string) => void;
}

const TYPE_CONFIG = {
    RECEIVE: { label: 'استلام', icon: PackagePlus, color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30' },
    SHIP: { label: 'شحن', icon: Truck, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30' },
    RETURN: { label: 'إرجاع', icon: RotateCcw, color: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-900/30' },
    TRANSFER_OUT: { label: 'تحويل صادر', icon: ArrowRight, color: 'text-purple-600', bg: 'bg-purple-100 dark:bg-purple-900/30' },
    TRANSFER_IN: { label: 'تحويل وارد', icon: ArrowLeft, color: 'text-purple-600', bg: 'bg-purple-100 dark:bg-purple-900/30' },
    ADJUSTMENT_ADD: { label: 'تعديل (+)', icon: Plus, color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30' },
    ADJUSTMENT_REMOVE: { label: 'تعديل (-)', icon: Minus, color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30' },
    DAMAGE: { label: 'تالف', icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30' },
};

const STATUS_CONFIG = {
    PENDING: { label: 'معلق', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300', icon: Clock },
    COMPLETED: { label: 'مكتمل', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300', icon: CheckCircle2 },
    CANCELLED: { label: 'ملغي', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300', icon: XCircle },
};

export function MovementDetails({ open, onOpenChange, movement, onExecute, onCancel }: MovementDetailsProps) {
    if (!movement) return null;

    const typeConfig = TYPE_CONFIG[movement.type];
    const statusConfig = STATUS_CONFIG[movement.status];
    const TypeIcon = typeConfig.icon;
    const StatusIcon = statusConfig.icon;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <div className={`p-2 rounded-lg ${typeConfig.bg}`}>
                            <TypeIcon className={`w-5 h-5 ${typeConfig.color}`} />
                        </div>
                        {typeConfig.label}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Status Badge */}
                    <Badge
                        variant="secondary"
                        className={`gap-1 ${statusConfig.color} border-0`}
                    >
                        <StatusIcon className="w-3 h-3" />
                        {statusConfig.label}
                    </Badge>

                    {/* Product Info */}
                    <div className="p-4 bg-muted rounded-lg space-y-3">
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-background rounded-lg">
                                <FileText className="w-5 h-5 text-muted-foreground" />
                            </div>
                            <div>
                                <p className="font-medium">{movement.productName}</p>
                                <p className="text-sm text-muted-foreground font-mono">{movement.sku}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                            <div>
                                <p className="text-xs text-muted-foreground">الكمية</p>
                                <p className="text-xl font-bold">{movement.quantity}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">المستودع</p>
                                <p className="font-medium">{movement.warehouseName}</p>
                            </div>
                        </div>
                    </div>

                    {/* Reason */}
                    <div>
                        <p className="text-sm text-muted-foreground mb-1">السبب</p>
                        <p className="text-sm">{movement.reason}</p>
                    </div>

                    {/* Reference */}
                    {movement.referenceType && (
                        <div>
                            <p className="text-sm text-muted-foreground mb-1">المرجع</p>
                            <p className="text-sm font-mono">
                                {movement.referenceType}: {movement.referenceId}
                            </p>
                        </div>
                    )}

                    {/* Timeline */}
                    <div className="space-y-3 pt-4 border-t">
                        <div className="flex items-center gap-3 text-sm">
                            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                <User className="w-4 h-4 text-blue-600" />
                            </div>
                            <div>
                                <p className="font-medium">أنشئت بواسطة {movement.createdBy}</p>
                                <p className="text-muted-foreground">{movement.createdAt}</p>
                            </div>
                        </div>

                        {movement.executedAt && (
                            <div className="flex items-center gap-3 text-sm">
                                <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                                </div>
                                <div>
                                    <p className="font-medium">نُفذت بواسطة {movement.executedBy}</p>
                                    <p className="text-muted-foreground">{movement.executedAt}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        إغلاق
                    </Button>
                    {movement.status === 'PENDING' && (
                        <>
                            <Button
                                variant="outline"
                                onClick={() => { onCancel?.(movement.id); onOpenChange(false); }}
                                className="text-destructive"
                            >
                                إلغاء الحركة
                            </Button>
                            <Button
                                onClick={() => { onExecute?.(movement.id); onOpenChange(false); }}
                            >
                                تنفيذ
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
