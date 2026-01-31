/**
 * Transfer Panel
 * Transfer request management with inline approval queue
 */

import { useState } from 'react';
import {
    Plus,
    Search,
    ArrowLeftRight,
    CheckCircle2,
    XCircle,
    Clock,
    Truck,
    MoreVertical,
    Check,
    X,
    Eye
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
import { TransferFormModal } from './TransferFormModal';

const STATUS_CONFIG = {
    PENDING: {
        label: 'قيد الانتظار',
        color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
        icon: Clock
    },
    APPROVED: {
        label: 'تمت الموافقة',
        color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
        icon: CheckCircle2
    },
    IN_TRANSIT: {
        label: 'قيد التحويل',
        color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
        icon: Truck
    },
    COMPLETED: {
        label: 'مكتمل',
        color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
        icon: CheckCircle2
    },
    REJECTED: {
        label: 'مرفوض',
        color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
        icon: XCircle
    },
    CANCELLED: {
        label: 'ملغي',
        color: 'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-300',
        icon: XCircle
    },
};

const PRIORITY_CONFIG = {
    LOW: { label: 'عادي', color: 'text-gray-600' },
    NORMAL: { label: 'متوسط', color: 'text-blue-600' },
    HIGH: { label: 'عالي', color: 'text-orange-600' },
    URGENT: { label: 'عاجل', color: 'text-red-600' },
};

interface TransferRequest {
    id: string;
    sourceWarehouse: string;
    targetWarehouse: string;
    sku: string;
    productName: string;
    quantity: number;
    status: keyof typeof STATUS_CONFIG;
    priority: keyof typeof PRIORITY_CONFIG;
    reason: string;
    requestedBy: string;
    createdAt: string;
    needsApproval: boolean;
}

export function TransferPanel() {
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    // Mock data
    const transfers: TransferRequest[] = [
        {
            id: 'tr-001',
            sourceWarehouse: 'مستودع الرياض',
            targetWarehouse: 'مستودع جدة',
            sku: 'ELEC-001',
            productName: 'سماعة لاسلكية',
            quantity: 30,
            status: 'PENDING',
            priority: 'HIGH',
            reason: 'نفاد المخزون في جدة',
            requestedBy: 'أحمد محمد',
            createdAt: '2026-01-02 09:30',
            needsApproval: true,
        },
        {
            id: 'tr-002',
            sourceWarehouse: 'مستودع جدة',
            targetWarehouse: 'مستودع الدمام',
            sku: 'FASH-234',
            productName: 'قميص رجالي',
            quantity: 50,
            status: 'IN_TRANSIT',
            priority: 'NORMAL',
            reason: 'إعادة توزيع المخزون',
            requestedBy: 'سارة أحمد',
            createdAt: '2026-01-01 14:00',
            needsApproval: false,
        },
        {
            id: 'tr-003',
            sourceWarehouse: 'مستودع الرياض',
            targetWarehouse: 'مستودع الدمام',
            sku: 'HOME-890',
            productName: 'طقم أواني',
            quantity: 15,
            status: 'COMPLETED',
            priority: 'LOW',
            reason: 'طلب فرع الدمام',
            requestedBy: 'محمد علي',
            createdAt: '2025-12-30 11:15',
            needsApproval: false,
        },
        {
            id: 'tr-004',
            sourceWarehouse: 'مستودع جدة',
            targetWarehouse: 'مستودع الرياض',
            sku: 'ACC-123',
            productName: 'حقيبة جلدية',
            quantity: 25,
            status: 'PENDING',
            priority: 'URGENT',
            reason: 'عرض خاص في الرياض',
            requestedBy: 'فاطمة خالد',
            createdAt: '2026-01-02 11:00',
            needsApproval: true,
        },
    ];

    // Filter transfers
    const filteredTransfers = transfers.filter(tr => {
        const matchesSearch =
            tr.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
            tr.productName.includes(searchQuery) ||
            tr.sourceWarehouse.includes(searchQuery) ||
            tr.targetWarehouse.includes(searchQuery);

        const matchesStatus = statusFilter === 'all' || tr.status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    // Pending approvals
    const pendingApprovals = transfers.filter(t => t.status === 'PENDING' && t.needsApproval);

    return (
        <div className="space-y-6">
            {/* Pending Approvals Alert */}
            {pendingApprovals.length > 0 && (
                <Card className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-yellow-100 dark:bg-yellow-900/50 rounded-lg">
                                    <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                                </div>
                                <div>
                                    <p className="font-medium text-yellow-900 dark:text-yellow-100">
                                        {pendingApprovals.length} طلبات تحويل تنتظر الموافقة
                                    </p>
                                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                                        يرجى مراجعة الطلبات المعلقة
                                    </p>
                                </div>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                className="border-yellow-300 text-yellow-800 hover:bg-yellow-100 dark:border-yellow-700 dark:text-yellow-200"
                                onClick={() => setStatusFilter('PENDING')}
                            >
                                عرض الكل
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">إجمالي التحويلات</p>
                        <p className="text-2xl font-bold">{transfers.length}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">قيد الانتظار</p>
                        <p className="text-2xl font-bold text-yellow-600">
                            {transfers.filter(t => t.status === 'PENDING').length}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">قيد التحويل</p>
                        <p className="text-2xl font-bold text-purple-600">
                            {transfers.filter(t => t.status === 'IN_TRANSIT').length}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">مكتملة</p>
                        <p className="text-2xl font-bold text-green-600">
                            {transfers.filter(t => t.status === 'COMPLETED').length}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Transfers List */}
            <Card>
                <CardHeader className="pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <CardTitle className="flex items-center gap-2">
                            <ArrowLeftRight className="w-5 h-5" />
                            طلبات التحويل
                        </CardTitle>
                        <Button onClick={() => setIsFormOpen(true)} className="gap-2">
                            <Plus className="w-4 h-4" />
                            طلب تحويل جديد
                        </Button>
                    </div>
                </CardHeader>

                <CardContent className="space-y-4">
                    {/* Filters */}
                    <div className="flex flex-col sm:flex-row gap-3">
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

                    {/* Transfers Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-muted/50">
                                <tr>
                                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">المنتج</th>
                                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">من</th>
                                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">إلى</th>
                                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">الكمية</th>
                                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground hidden md:table-cell">الأولوية</th>
                                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">الحالة</th>
                                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground hidden lg:table-cell">التاريخ</th>
                                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground w-12"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredTransfers.map((tr) => {
                                    const statusConfig = STATUS_CONFIG[tr.status];
                                    const priorityConfig = PRIORITY_CONFIG[tr.priority];
                                    const StatusIcon = statusConfig.icon;

                                    return (
                                        <tr
                                            key={tr.id}
                                            className="border-t border-border hover:bg-muted/30 transition-colors"
                                        >
                                            <td className="px-4 py-4">
                                                <div>
                                                    <p className="font-medium">{tr.productName}</p>
                                                    <p className="text-xs text-muted-foreground font-mono">{tr.sku}</p>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-sm">
                                                {tr.sourceWarehouse}
                                            </td>
                                            <td className="px-4 py-4 text-sm">
                                                {tr.targetWarehouse}
                                            </td>
                                            <td className="px-4 py-4 font-medium">
                                                {tr.quantity}
                                            </td>
                                            <td className="px-4 py-4 hidden md:table-cell">
                                                <span className={`text-sm font-medium ${priorityConfig.color}`}>
                                                    {priorityConfig.label}
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
                                            <td className="px-4 py-4 text-sm text-muted-foreground hidden lg:table-cell">
                                                {tr.createdAt}
                                            </td>
                                            <td className="px-4 py-4">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                                            <MoreVertical className="w-4 h-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        {tr.status === 'PENDING' && tr.needsApproval && (
                                                            <>
                                                                <DropdownMenuItem className="gap-2 text-green-600">
                                                                    <Check className="w-4 h-4" />
                                                                    موافقة
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem className="gap-2 text-destructive">
                                                                    <X className="w-4 h-4" />
                                                                    رفض
                                                                </DropdownMenuItem>
                                                                <DropdownMenuSeparator />
                                                            </>
                                                        )}
                                                        <DropdownMenuItem className="gap-2">
                                                            <Eye className="w-4 h-4" />
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

                        {filteredTransfers.length === 0 && (
                            <div className="p-8 text-center text-muted-foreground">
                                لا توجد طلبات تحويل مطابقة للبحث
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Transfer Form Modal */}
            <TransferFormModal
                open={isFormOpen}
                onOpenChange={setIsFormOpen}
            />
        </div>
    );
}
