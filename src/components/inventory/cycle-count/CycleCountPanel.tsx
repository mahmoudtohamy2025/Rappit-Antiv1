/**
 * Cycle Count Panel
 * Physical inventory verification and variance management
 */

import { useState } from 'react';
import {
    Plus,
    Search,
    ClipboardCheck,
    CheckCircle2,
    XCircle,
    Clock,
    AlertTriangle,
    MoreVertical,
    Play,
    Eye,
    FileText
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
import { Progress } from '../../UI/progress';

const STATUS_CONFIG = {
    DRAFT: {
        label: 'مسودة',
        color: 'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-300',
        icon: FileText
    },
    IN_PROGRESS: {
        label: 'قيد التنفيذ',
        color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
        icon: Clock
    },
    PENDING_APPROVAL: {
        label: 'بانتظار الموافقة',
        color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
        icon: AlertTriangle
    },
    COMPLETED: {
        label: 'مكتمل',
        color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
        icon: CheckCircle2
    },
    CANCELLED: {
        label: 'ملغي',
        color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
        icon: XCircle
    },
};

interface CycleCount {
    id: string;
    name: string;
    warehouseName: string;
    status: keyof typeof STATUS_CONFIG;
    totalItems: number;
    countedItems: number;
    varianceItems: number;
    assignee: string;
    dueDate: string;
    createdAt: string;
}

export function CycleCountPanel() {
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    // Mock data
    const cycleCounts: CycleCount[] = [
        {
            id: 'cc-001',
            name: 'جرد Q1 2026 - الرياض',
            warehouseName: 'مستودع الرياض',
            status: 'IN_PROGRESS',
            totalItems: 150,
            countedItems: 87,
            varianceItems: 5,
            assignee: 'أحمد محمد',
            dueDate: '2026-01-05',
            createdAt: '2026-01-01',
        },
        {
            id: 'cc-002',
            name: 'جرد الإلكترونيات',
            warehouseName: 'مستودع جدة',
            status: 'PENDING_APPROVAL',
            totalItems: 45,
            countedItems: 45,
            varianceItems: 8,
            assignee: 'سارة أحمد',
            dueDate: '2026-01-03',
            createdAt: '2025-12-28',
        },
        {
            id: 'cc-003',
            name: 'جرد نهاية السنة',
            warehouseName: 'مستودع الدمام',
            status: 'COMPLETED',
            totalItems: 200,
            countedItems: 200,
            varianceItems: 12,
            assignee: 'محمد علي',
            dueDate: '2025-12-31',
            createdAt: '2025-12-25',
        },
        {
            id: 'cc-004',
            name: 'جرد الأزياء',
            warehouseName: 'مستودع الرياض',
            status: 'DRAFT',
            totalItems: 80,
            countedItems: 0,
            varianceItems: 0,
            assignee: 'فاطمة خالد',
            dueDate: '2026-01-10',
            createdAt: '2026-01-02',
        },
    ];

    // Filter cycle counts
    const filteredCounts = cycleCounts.filter(cc => {
        const matchesSearch =
            cc.name.includes(searchQuery) ||
            cc.warehouseName.includes(searchQuery) ||
            cc.assignee.includes(searchQuery);

        const matchesStatus = statusFilter === 'all' || cc.status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    // Stats
    const activeCount = cycleCounts.filter(c => c.status === 'IN_PROGRESS').length;
    const pendingApproval = cycleCounts.filter(c => c.status === 'PENDING_APPROVAL').length;
    const totalVariances = cycleCounts.reduce((sum, c) => sum + c.varianceItems, 0);

    return (
        <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">إجمالي الجرد</p>
                        <p className="text-2xl font-bold">{cycleCounts.length}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">قيد التنفيذ</p>
                        <p className="text-2xl font-bold text-blue-600">{activeCount}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">بانتظار الموافقة</p>
                        <p className="text-2xl font-bold text-yellow-600">{pendingApproval}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">إجمالي الفروقات</p>
                        <p className="text-2xl font-bold text-orange-600">{totalVariances}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Cycle Count List */}
            <Card>
                <CardHeader className="pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <CardTitle className="flex items-center gap-2">
                            <ClipboardCheck className="w-5 h-5" />
                            عمليات الجرد
                        </CardTitle>
                        <Button className="gap-2">
                            <Plus className="w-4 h-4" />
                            جرد جديد
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

                    {/* Cycle Count Cards */}
                    <div className="grid gap-4">
                        {filteredCounts.map((cc) => {
                            const statusConfig = STATUS_CONFIG[cc.status];
                            const StatusIcon = statusConfig.icon;
                            const progress = cc.totalItems > 0
                                ? Math.round((cc.countedItems / cc.totalItems) * 100)
                                : 0;

                            return (
                                <Card key={cc.id} className="hover:shadow-md transition-shadow">
                                    <CardContent className="p-4">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                            {/* Info */}
                                            <div className="flex-1 space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-medium">{cc.name}</h3>
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
                                                    <span>المسؤول: {cc.assignee}</span>
                                                    <span>الاستحقاق: {cc.dueDate}</span>
                                                </div>

                                                {/* Progress */}
                                                {cc.status === 'IN_PROGRESS' && (
                                                    <div className="space-y-1">
                                                        <div className="flex justify-between text-sm">
                                                            <span>التقدم</span>
                                                            <span>{cc.countedItems} / {cc.totalItems} ({progress}%)</span>
                                                        </div>
                                                        <Progress value={progress} className="h-2" />
                                                    </div>
                                                )}

                                                {/* Variance Warning */}
                                                {cc.varianceItems > 0 && cc.status !== 'DRAFT' && (
                                                    <div className="flex items-center gap-2 text-sm text-orange-600 dark:text-orange-400">
                                                        <AlertTriangle className="w-4 h-4" />
                                                        <span>{cc.varianceItems} منتجات بها فروقات</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center gap-2">
                                                {cc.status === 'DRAFT' && (
                                                    <Button size="sm" className="gap-1">
                                                        <Play className="w-4 h-4" />
                                                        بدء
                                                    </Button>
                                                )}
                                                {cc.status === 'IN_PROGRESS' && (
                                                    <Button size="sm" variant="outline" className="gap-1">
                                                        متابعة
                                                    </Button>
                                                )}
                                                {cc.status === 'PENDING_APPROVAL' && (
                                                    <Button size="sm" className="gap-1" variant="outline">
                                                        مراجعة
                                                    </Button>
                                                )}

                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                                            <MoreVertical className="w-4 h-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem className="gap-2">
                                                            <Eye className="w-4 h-4" />
                                                            عرض التفاصيل
                                                        </DropdownMenuItem>
                                                        {cc.varianceItems > 0 && (
                                                            <DropdownMenuItem className="gap-2">
                                                                <AlertTriangle className="w-4 h-4" />
                                                                تقرير الفروقات
                                                            </DropdownMenuItem>
                                                        )}
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem className="gap-2 text-destructive">
                                                            <XCircle className="w-4 h-4" />
                                                            إلغاء
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>

                    {filteredCounts.length === 0 && (
                        <div className="p-8 text-center text-muted-foreground">
                            لا توجد عمليات جرد مطابقة للبحث
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
