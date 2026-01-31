/**
 * Transfer Details Component
 * Detail view for a transfer request
 * 
 * Part of: UI-INV-06 (Backend: transfer-reservation.service.ts)
 */

import {
    ArrowLeftRight,
    Warehouse,
    Package,
    User,
    Calendar,
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
import { TransferStatusBadge } from './TransferStatusBadge';
import { TransferTimeline } from './TransferTimeline';

interface TransferDetailsProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    transfer: {
        id: string;
        sourceWarehouse: string;
        targetWarehouse: string;
        sku: string;
        productName: string;
        quantity: number;
        status: 'PENDING' | 'APPROVED' | 'IN_TRANSIT' | 'COMPLETED' | 'REJECTED' | 'CANCELLED';
        priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
        transferType: 'IMMEDIATE' | 'PENDING' | 'SCHEDULED';
        reason?: string;
        scheduledDate?: string;
        requestedBy: string;
        requestedAt: string;
        approvedBy?: string;
        approvedAt?: string;
        completedAt?: string;
    } | null;
    onApprove?: (id: string) => void;
    onReject?: (id: string) => void;
    onCancel?: (id: string) => void;
}

const PRIORITY_LABELS: Record<string, string> = {
    LOW: 'عادي',
    NORMAL: 'متوسط',
    HIGH: 'عالي',
    URGENT: 'عاجل',
};

const TYPE_LABELS: Record<string, string> = {
    IMMEDIATE: 'فوري',
    PENDING: 'يحتاج موافقة',
    SCHEDULED: 'مجدول',
};

export function TransferDetails({
    open,
    onOpenChange,
    transfer,
    onApprove,
    onReject,
    onCancel
}: TransferDetailsProps) {
    if (!transfer) return null;

    const timelineEvents = [
        { status: 'requested', label: 'تم إنشاء الطلب', by: transfer.requestedBy, at: transfer.requestedAt },
        ...(transfer.approvedAt ? [{ status: 'approved', label: 'تمت الموافقة', by: transfer.approvedBy, at: transfer.approvedAt }] : []),
        ...(transfer.completedAt ? [{ status: 'completed', label: 'اكتمل التحويل', at: transfer.completedAt }] : []),
    ];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ArrowLeftRight className="w-5 h-5" />
                        تفاصيل طلب التحويل
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Status */}
                    <div className="flex items-center gap-2">
                        <TransferStatusBadge status={transfer.status} />
                    </div>

                    {/* Warehouses */}
                    <div className="p-4 bg-muted rounded-lg">
                        <div className="flex items-center justify-between">
                            <div className="text-center">
                                <Warehouse className="w-6 h-6 mx-auto mb-1 text-muted-foreground" />
                                <p className="font-medium">{transfer.sourceWarehouse}</p>
                                <p className="text-xs text-muted-foreground">المصدر</p>
                            </div>
                            <ArrowLeftRight className="w-6 h-6 text-purple-500" />
                            <div className="text-center">
                                <Warehouse className="w-6 h-6 mx-auto mb-1 text-muted-foreground" />
                                <p className="font-medium">{transfer.targetWarehouse}</p>
                                <p className="text-xs text-muted-foreground">الهدف</p>
                            </div>
                        </div>
                    </div>

                    {/* Product Info */}
                    <div className="space-y-3">
                        <div className="flex items-start gap-3">
                            <Package className="w-5 h-5 text-muted-foreground mt-0.5" />
                            <div>
                                <p className="font-medium">{transfer.productName}</p>
                                <p className="text-sm text-muted-foreground font-mono">{transfer.sku}</p>
                            </div>
                            <div className="mr-auto text-left">
                                <p className="text-2xl font-bold">{transfer.quantity}</p>
                                <p className="text-xs text-muted-foreground">وحدة</p>
                            </div>
                        </div>
                    </div>

                    {/* Details */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                            <p className="text-muted-foreground">نوع التحويل</p>
                            <p className="font-medium">{TYPE_LABELS[transfer.transferType]}</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">الأولوية</p>
                            <p className="font-medium">{PRIORITY_LABELS[transfer.priority]}</p>
                        </div>
                        {transfer.scheduledDate && (
                            <div className="col-span-2">
                                <p className="text-muted-foreground flex items-center gap-1">
                                    <Calendar className="w-4 h-4" />
                                    التاريخ المجدول
                                </p>
                                <p className="font-medium">{transfer.scheduledDate}</p>
                            </div>
                        )}
                    </div>

                    {/* Reason */}
                    {transfer.reason && (
                        <div>
                            <p className="text-sm text-muted-foreground flex items-center gap-1 mb-1">
                                <FileText className="w-4 h-4" />
                                السبب
                            </p>
                            <p className="text-sm bg-muted p-2 rounded">{transfer.reason}</p>
                        </div>
                    )}

                    {/* Timeline */}
                    <TransferTimeline events={timelineEvents} />
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        إغلاق
                    </Button>
                    {transfer.status === 'PENDING' && (
                        <>
                            <Button
                                variant="outline"
                                onClick={() => { onReject?.(transfer.id); onOpenChange(false); }}
                                className="text-destructive"
                            >
                                رفض
                            </Button>
                            <Button
                                onClick={() => { onApprove?.(transfer.id); onOpenChange(false); }}
                            >
                                موافقة
                            </Button>
                        </>
                    )}
                    {(transfer.status === 'PENDING' || transfer.status === 'APPROVED') && (
                        <Button
                            variant="outline"
                            onClick={() => { onCancel?.(transfer.id); onOpenChange(false); }}
                            className="text-destructive"
                        >
                            إلغاء
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
