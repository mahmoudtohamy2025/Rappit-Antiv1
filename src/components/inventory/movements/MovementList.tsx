/**
 * Movement List Component
 * Reusable movement history table
 * 
 * Part of: UI-INV-02 (Backend: stock-movement.service.ts - 84 tests)
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
    MoreVertical,
    Play,
    XCircle,
    Eye
} from 'lucide-react';
import { Badge } from '../../UI/badge';
import { Button } from '../../UI/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '../../UI/dropdown-menu';

interface Movement {
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
    createdAt: string;
    executedAt?: string;
}

interface MovementListProps {
    movements: Movement[];
    onExecute: (id: string) => void;
    onCancel: (id: string) => void;
    onView: (id: string) => void;
}

const TYPE_CONFIG = {
    RECEIVE: {
        label: 'استلام',
        icon: PackagePlus,
        color: 'text-green-600 dark:text-green-400',
        bg: 'bg-green-100 dark:bg-green-900/30',
        direction: '+'
    },
    SHIP: {
        label: 'شحن',
        icon: Truck,
        color: 'text-blue-600 dark:text-blue-400',
        bg: 'bg-blue-100 dark:bg-blue-900/30',
        direction: '-'
    },
    RETURN: {
        label: 'إرجاع',
        icon: RotateCcw,
        color: 'text-orange-600 dark:text-orange-400',
        bg: 'bg-orange-100 dark:bg-orange-900/30',
        direction: '+'
    },
    TRANSFER_OUT: {
        label: 'تحويل صادر',
        icon: ArrowRight,
        color: 'text-purple-600 dark:text-purple-400',
        bg: 'bg-purple-100 dark:bg-purple-900/30',
        direction: '-'
    },
    TRANSFER_IN: {
        label: 'تحويل وارد',
        icon: ArrowLeft,
        color: 'text-purple-600 dark:text-purple-400',
        bg: 'bg-purple-100 dark:bg-purple-900/30',
        direction: '+'
    },
    ADJUSTMENT_ADD: {
        label: 'تعديل (+)',
        icon: Plus,
        color: 'text-green-600 dark:text-green-400',
        bg: 'bg-green-100 dark:bg-green-900/30',
        direction: '+'
    },
    ADJUSTMENT_REMOVE: {
        label: 'تعديل (-)',
        icon: Minus,
        color: 'text-red-600 dark:text-red-400',
        bg: 'bg-red-100 dark:bg-red-900/30',
        direction: '-'
    },
    DAMAGE: {
        label: 'تالف',
        icon: AlertTriangle,
        color: 'text-red-600 dark:text-red-400',
        bg: 'bg-red-100 dark:bg-red-900/30',
        direction: '-'
    },
};

const STATUS_CONFIG = {
    PENDING: { label: 'معلق', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' },
    COMPLETED: { label: 'مكتمل', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
    CANCELLED: { label: 'ملغي', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
};

export function MovementList({ movements, onExecute, onCancel, onView }: MovementListProps) {
    if (movements.length === 0) {
        return (
            <div className="p-8 text-center text-muted-foreground">
                <Truck className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>لا توجد حركات مخزون</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full">
                <thead className="bg-muted/50">
                    <tr>
                        <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">النوع</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">المنتج</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">الكمية</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground hidden md:table-cell">المستودع</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">الحالة</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground hidden lg:table-cell">التاريخ</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">إجراءات</th>
                    </tr>
                </thead>
                <tbody>
                    {movements.map((movement) => {
                        const typeConfig = TYPE_CONFIG[movement.type];
                        const statusConfig = STATUS_CONFIG[movement.status];
                        const TypeIcon = typeConfig.icon;

                        return (
                            <tr
                                key={movement.id}
                                className="border-t border-border hover:bg-muted/30 transition-colors"
                            >
                                <td className="px-4 py-4">
                                    <div className="flex items-center gap-2">
                                        <div className={`p-1.5 rounded ${typeConfig.bg}`}>
                                            <TypeIcon className={`w-4 h-4 ${typeConfig.color}`} />
                                        </div>
                                        <span className="hidden sm:inline text-sm">{typeConfig.label}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-4">
                                    <p className="font-medium text-sm">{movement.productName}</p>
                                    <p className="text-xs text-muted-foreground font-mono">{movement.sku}</p>
                                </td>
                                <td className="px-4 py-4">
                                    <span className={`font-medium ${typeConfig.direction === '+'
                                            ? 'text-green-600 dark:text-green-400'
                                            : 'text-red-600 dark:text-red-400'
                                        }`}>
                                        {typeConfig.direction}{movement.quantity}
                                    </span>
                                </td>
                                <td className="px-4 py-4 text-sm hidden md:table-cell">
                                    {movement.warehouseName}
                                </td>
                                <td className="px-4 py-4">
                                    <Badge
                                        variant="secondary"
                                        className={`${statusConfig.color} border-0`}
                                    >
                                        {statusConfig.label}
                                    </Badge>
                                </td>
                                <td className="px-4 py-4 text-sm text-muted-foreground hidden lg:table-cell">
                                    {movement.createdAt}
                                </td>
                                <td className="px-4 py-4">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                <MoreVertical className="w-4 h-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => onView(movement.id)} className="gap-2">
                                                <Eye className="w-4 h-4" />
                                                عرض التفاصيل
                                            </DropdownMenuItem>
                                            {movement.status === 'PENDING' && (
                                                <>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem onClick={() => onExecute(movement.id)} className="gap-2 text-green-600">
                                                        <Play className="w-4 h-4" />
                                                        تنفيذ
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => onCancel(movement.id)} className="gap-2 text-destructive">
                                                        <XCircle className="w-4 h-4" />
                                                        إلغاء
                                                    </DropdownMenuItem>
                                                </>
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
