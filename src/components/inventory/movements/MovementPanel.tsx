/**
 * Movement Panel
 * Stock movement management interface
 * 
 * Features:
 * - Create new movements
 * - Movement history with filters
 * - Execute/cancel pending movements
 * - Movement type icons and colors
 */

import { useState, useEffect } from 'react';
import {
    Plus,
    Search,
    Filter,
    PackagePlus,
    Truck,
    RotateCcw,
    ArrowRight,
    ArrowLeft,
    AlertTriangle,
    Sliders,
    CheckCircle2,
    XCircle,
    Clock,
    MoreVertical,
    Play,
    X
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../UI/card';
import { Button } from '../../UI/button';
import { Badge } from '../../UI/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../UI/select';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '../../UI/dropdown-menu';
import { MovementFormModal } from './MovementFormModal';
import { useStockMovements } from '../../../hooks/inventory/useStockMovements';

// Movement types configuration
const MOVEMENT_TYPES = {
    RECEIVE: {
        label: 'استلام',
        icon: PackagePlus,
        color: 'text-green-600 dark:text-green-400',
        bg: 'bg-green-100 dark:bg-green-900/30',
        direction: 'inbound'
    },
    SHIP: {
        label: 'شحن',
        icon: Truck,
        color: 'text-blue-600 dark:text-blue-400',
        bg: 'bg-blue-100 dark:bg-blue-900/30',
        direction: 'outbound'
    },
    RETURN: {
        label: 'إرجاع',
        icon: RotateCcw,
        color: 'text-orange-600 dark:text-orange-400',
        bg: 'bg-orange-100 dark:bg-orange-900/30',
        direction: 'inbound'
    },
    TRANSFER_OUT: {
        label: 'تحويل صادر',
        icon: ArrowRight,
        color: 'text-purple-600 dark:text-purple-400',
        bg: 'bg-purple-100 dark:bg-purple-900/30',
        direction: 'outbound'
    },
    TRANSFER_IN: {
        label: 'تحويل وارد',
        icon: ArrowLeft,
        color: 'text-purple-600 dark:text-purple-400',
        bg: 'bg-purple-100 dark:bg-purple-900/30',
        direction: 'inbound'
    },
    ADJUSTMENT_ADD: {
        label: 'تعديل (+)',
        icon: Plus,
        color: 'text-green-600 dark:text-green-400',
        bg: 'bg-green-100 dark:bg-green-900/30',
        direction: 'inbound'
    },
    ADJUSTMENT_REMOVE: {
        label: 'تعديل (-)',
        icon: Sliders,
        color: 'text-red-600 dark:text-red-400',
        bg: 'bg-red-100 dark:bg-red-900/30',
        direction: 'outbound'
    },
    DAMAGE: {
        label: 'تالف',
        icon: AlertTriangle,
        color: 'text-red-600 dark:text-red-400',
        bg: 'bg-red-100 dark:bg-red-900/30',
        direction: 'outbound'
    },
};

const STATUS_CONFIG = {
    PENDING: { label: 'قيد الانتظار', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300', icon: Clock },
    COMPLETED: { label: 'مكتمل', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', icon: CheckCircle2 },
    CANCELLED: { label: 'ملغي', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-300', icon: XCircle },
    FAILED: { label: 'فشل', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', icon: XCircle },
};

interface Movement {
    id: string;
    type: keyof typeof MOVEMENT_TYPES;
    status: keyof typeof STATUS_CONFIG;
    sku: string;
    productName: string;
    quantity: number;
    warehouseName: string;
    reason: string;
    createdAt: string;
    executedAt?: string;
}

export function MovementPanel() {
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    // Wire to real API
    const { movements: apiMovements, isLoading, error, fetch } = useStockMovements();

    // Fetch on mount and when filters change
    useEffect(() => {
        fetch({
            type: typeFilter !== 'all' ? typeFilter : undefined,
            status: statusFilter !== 'all' ? statusFilter : undefined,
        });
    }, [typeFilter, statusFilter]);

    // Transform API data to component format
    const movements: Movement[] = (apiMovements || []).map(m => ({
        id: m.id,
        type: (m.type || 'RECEIVE') as keyof typeof MOVEMENT_TYPES,
        status: (m.status || 'PENDING') as keyof typeof STATUS_CONFIG,
        sku: m.skuCode || m.skuId || '',
        productName: m.skuName || m.itemName || 'منتج',
        quantity: m.quantity,
        warehouseName: m.warehouseName || 'مستودع',
        reason: m.reason || m.notes || '',
        createdAt: new Date(m.createdAt).toLocaleString('ar-SA'),
        executedAt: m.executedAt ? new Date(m.executedAt).toLocaleString('ar-SA') : undefined,
    }));

    // Filter movements by search
    const filteredMovements = movements.filter(mov => {
        const matchesSearch =
            mov.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
            mov.productName.includes(searchQuery) ||
            mov.reason.includes(searchQuery);

        return matchesSearch;
    });

    // Stats
    const pendingCount = movements.filter(m => m.status === 'PENDING').length;
    const todayCount = movements.filter(m => {
        const moveDate = new Date(m.createdAt);
        const today = new Date();
        return moveDate.toDateString() === today.toDateString();
    }).length;

    return (
        <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">إجمالي الحركات</p>
                        <p className="text-2xl font-bold">{movements.length}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">قيد الانتظار</p>
                        <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">اليوم</p>
                        <p className="text-2xl font-bold text-blue-600">{todayCount}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">مكتملة</p>
                        <p className="text-2xl font-bold text-green-600">
                            {movements.filter(m => m.status === 'COMPLETED').length}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Filters & Actions */}
            <Card>
                <CardHeader className="pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <CardTitle>سجل الحركات</CardTitle>
                        <Button onClick={() => setIsFormOpen(true)} className="gap-2">
                            <Plus className="w-4 h-4" />
                            حركة جديدة
                        </Button>
                    </div>
                </CardHeader>

                <CardContent className="space-y-4">
                    {/* Filters */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        {/* Search */}
                        <div className="relative flex-1">
                            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="بحث..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pr-10 pl-4 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                        </div>

                        {/* Type Filter */}
                        <Select value={typeFilter} onValueChange={setTypeFilter}>
                            <SelectTrigger className="w-full sm:w-40">
                                <SelectValue placeholder="النوع" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">جميع الأنواع</SelectItem>
                                {Object.entries(MOVEMENT_TYPES).map(([key, config]) => (
                                    <SelectItem key={key} value={key}>
                                        {config.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {/* Status Filter */}
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-full sm:w-40">
                                <SelectValue placeholder="الحالة" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">جميع الحالات</SelectItem>
                                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                                    <SelectItem key={key} value={key}>
                                        {config.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Movements Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-muted/50">
                                <tr>
                                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">النوع</th>
                                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">المنتج</th>
                                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">الكمية</th>
                                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground hidden md:table-cell">المستودع</th>
                                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground hidden lg:table-cell">السبب</th>
                                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">الحالة</th>
                                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground hidden sm:table-cell">التاريخ</th>
                                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground w-12"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredMovements.map((mov) => {
                                    const typeConfig = MOVEMENT_TYPES[mov.type];
                                    const statusConfig = STATUS_CONFIG[mov.status];
                                    const TypeIcon = typeConfig.icon;
                                    const StatusIcon = statusConfig.icon;

                                    return (
                                        <tr
                                            key={mov.id}
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
                                                <div>
                                                    <p className="font-medium">{mov.productName}</p>
                                                    <p className="text-xs text-muted-foreground font-mono">{mov.sku}</p>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <span className={`font-medium ${typeConfig.direction === 'inbound'
                                                    ? 'text-green-600 dark:text-green-400'
                                                    : 'text-red-600 dark:text-red-400'
                                                    }`}>
                                                    {typeConfig.direction === 'inbound' ? '+' : '-'}{mov.quantity}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 hidden md:table-cell text-sm">
                                                {mov.warehouseName}
                                            </td>
                                            <td className="px-4 py-4 hidden lg:table-cell">
                                                <span className="text-sm text-muted-foreground line-clamp-1">
                                                    {mov.reason}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4">
                                                <Badge
                                                    variant="secondary"
                                                    className={`gap-1 ${statusConfig.color} border-0`}
                                                >
                                                    <StatusIcon className="w-3 h-3" />
                                                    <span className="hidden sm:inline">{statusConfig.label}</span>
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-4 text-sm text-muted-foreground hidden sm:table-cell">
                                                {mov.createdAt}
                                            </td>
                                            <td className="px-4 py-4">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                                            <MoreVertical className="w-4 h-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        {mov.status === 'PENDING' && (
                                                            <>
                                                                <DropdownMenuItem className="gap-2 text-green-600">
                                                                    <Play className="w-4 h-4" />
                                                                    تنفيذ
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem className="gap-2 text-destructive">
                                                                    <X className="w-4 h-4" />
                                                                    إلغاء
                                                                </DropdownMenuItem>
                                                                <DropdownMenuSeparator />
                                                            </>
                                                        )}
                                                        <DropdownMenuItem className="gap-2">
                                                            عرض التفاصيل
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        {filteredMovements.length === 0 && (
                            <div className="p-8 text-center text-muted-foreground">
                                لا توجد حركات مطابقة للبحث
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Movement Form Modal */}
            <MovementFormModal
                open={isFormOpen}
                onOpenChange={setIsFormOpen}
            />
        </div>
    );
}
