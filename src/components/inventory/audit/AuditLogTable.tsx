/**
 * Audit Log Table Component
 * Reusable table for audit entries
 * 
 * Part of: UI-INV-07 (Backend: inventory-audit.service.ts - 90 tests)
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
    Eye
} from 'lucide-react';
import { Badge } from '../../UI/badge';
import { Button } from '../../UI/button';

interface AuditEntry {
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
}

interface AuditLogTableProps {
    entries: AuditEntry[];
    onView: (id: string) => void;
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

export function AuditLogTable({ entries, onView }: AuditLogTableProps) {
    if (entries.length === 0) {
        return (
            <div className="p-8 text-center text-muted-foreground">
                لا توجد سجلات مطابقة
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full">
                <thead className="bg-muted/50">
                    <tr>
                        <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">التاريخ</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">الإجراء</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">المنتج</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">التغيير</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground hidden md:table-cell">المستودع</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground hidden lg:table-cell">المستخدم</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground"></th>
                    </tr>
                </thead>
                <tbody>
                    {entries.map((entry) => {
                        const actionConfig = ACTION_CONFIG[entry.action];
                        const ActionIcon = actionConfig.icon;

                        return (
                            <tr
                                key={entry.id}
                                className="border-t border-border hover:bg-muted/30 transition-colors"
                            >
                                <td className="px-4 py-4 text-sm text-muted-foreground whitespace-nowrap">
                                    {entry.createdAt}
                                </td>
                                <td className="px-4 py-4">
                                    <div className="flex items-center gap-2">
                                        <div className={`p-1.5 rounded ${actionConfig.bg}`}>
                                            <ActionIcon className={`w-4 h-4 ${actionConfig.color}`} />
                                        </div>
                                        <span className="hidden sm:inline text-sm">{actionConfig.label}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-4">
                                    <p className="font-medium text-sm">{entry.productName}</p>
                                    <p className="text-xs text-muted-foreground font-mono">{entry.sku}</p>
                                </td>
                                <td className="px-4 py-4">
                                    <div className="text-sm">
                                        <span className="text-muted-foreground">{entry.previousQty}</span>
                                        <span className="mx-1">→</span>
                                        <span>{entry.newQty}</span>
                                        <Badge
                                            variant="secondary"
                                            className={`mr-2 ${entry.variance > 0
                                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30'
                                                    : entry.variance < 0
                                                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30'
                                                        : 'bg-gray-100 text-gray-700 dark:bg-gray-800/50'
                                                } border-0`}
                                        >
                                            {entry.variance > 0 ? '+' : ''}{entry.variance}
                                        </Badge>
                                    </div>
                                </td>
                                <td className="px-4 py-4 text-sm hidden md:table-cell">
                                    {entry.warehouseName}
                                </td>
                                <td className="px-4 py-4 text-sm hidden lg:table-cell">
                                    {entry.userName}
                                </td>
                                <td className="px-4 py-4">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => onView(entry.id)}
                                        className="h-8 w-8"
                                    >
                                        <Eye className="w-4 h-4" />
                                    </Button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
