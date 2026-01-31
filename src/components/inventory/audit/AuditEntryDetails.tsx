/**
 * Audit Entry Details Component
 * Detail modal for an audit entry
 * 
 * Part of: UI-INV-07 (Backend: inventory-audit.service.ts)
 */

import {
    Plus,
    Edit,
    Trash2,
    Upload,
    ClipboardCheck,
    Unlock,
    ArrowLeftRight,
    Sliders,
    User,
    Calendar,
    Warehouse,
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

interface AuditEntryDetailsProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    entry: {
        id: string;
        action: 'CREATE' | 'UPDATE' | 'DELETE' | 'ADJUSTMENT' | 'IMPORT' | 'CYCLE_COUNT' | 'FORCE_RELEASE' | 'TRANSFER';
        sku: string;
        productName: string;
        previousQty: number;
        newQty: number;
        variance: number;
        warehouseName: string;
        userId: string;
        userName: string;
        notes: string;
        createdAt: string;
        referenceType?: string;
        referenceId?: string;
    } | null;
}

const ACTION_CONFIG = {
    CREATE: { label: 'إنشاء', icon: Plus, color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30' },
    UPDATE: { label: 'تحديث', icon: Edit, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30' },
    DELETE: { label: 'حذف', icon: Trash2, color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30' },
    ADJUSTMENT: { label: 'تعديل', icon: Sliders, color: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-900/30' },
    IMPORT: { label: 'استيراد', icon: Upload, color: 'text-purple-600', bg: 'bg-purple-100 dark:bg-purple-900/30' },
    CYCLE_COUNT: { label: 'جرد', icon: ClipboardCheck, color: 'text-cyan-600', bg: 'bg-cyan-100 dark:bg-cyan-900/30' },
    FORCE_RELEASE: { label: 'إطلاق قسري', icon: Unlock, color: 'text-yellow-600', bg: 'bg-yellow-100 dark:bg-yellow-900/30' },
    TRANSFER: { label: 'تحويل', icon: ArrowLeftRight, color: 'text-indigo-600', bg: 'bg-indigo-100 dark:bg-indigo-900/30' },
};

export function AuditEntryDetails({ open, onOpenChange, entry }: AuditEntryDetailsProps) {
    if (!entry) return null;

    const actionConfig = ACTION_CONFIG[entry.action];
    const ActionIcon = actionConfig.icon;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <div className={`p-2 rounded-lg ${actionConfig.bg}`}>
                            <ActionIcon className={`w-5 h-5 ${actionConfig.color}`} />
                        </div>
                        {actionConfig.label}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Product Info */}
                    <div className="p-4 bg-muted rounded-lg">
                        <p className="font-medium">{entry.productName}</p>
                        <p className="text-sm text-muted-foreground font-mono">{entry.sku}</p>
                    </div>

                    {/* Change */}
                    <div className="text-center p-4 rounded-lg border">
                        <p className="text-sm text-muted-foreground mb-2">التغيير في الكمية</p>
                        <div className="flex items-center justify-center gap-4">
                            <div>
                                <p className="text-2xl font-bold text-muted-foreground">{entry.previousQty}</p>
                                <p className="text-xs text-muted-foreground">السابق</p>
                            </div>
                            <span className="text-2xl">→</span>
                            <div>
                                <p className="text-2xl font-bold">{entry.newQty}</p>
                                <p className="text-xs text-muted-foreground">الجديد</p>
                            </div>
                        </div>
                        <Badge
                            variant="secondary"
                            className={`mt-3 ${entry.variance > 0
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                    : entry.variance < 0
                                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                        : 'bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-300'
                                } border-0`}
                        >
                            {entry.variance > 0 ? '+' : ''}{entry.variance}
                        </Badge>
                    </div>

                    {/* Details */}
                    <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                            <Warehouse className="w-4 h-4 text-muted-foreground" />
                            <span className="text-muted-foreground">المستودع:</span>
                            <span className="font-medium">{entry.warehouseName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-muted-foreground" />
                            <span className="text-muted-foreground">بواسطة:</span>
                            <span className="font-medium">{entry.userName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            <span className="text-muted-foreground">التاريخ:</span>
                            <span className="font-medium">{entry.createdAt}</span>
                        </div>
                        {entry.referenceType && (
                            <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-muted-foreground" />
                                <span className="text-muted-foreground">المرجع:</span>
                                <span className="font-mono text-xs">
                                    {entry.referenceType}: {entry.referenceId}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Notes */}
                    {entry.notes && (
                        <div>
                            <p className="text-sm text-muted-foreground mb-1">الملاحظات</p>
                            <p className="text-sm p-2 bg-muted rounded">{entry.notes}</p>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        إغلاق
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
