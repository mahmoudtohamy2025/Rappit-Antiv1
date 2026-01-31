/**
 * Audit Trail Panel
 * View and export inventory audit logs
 */

import { useState } from 'react';
import {
    Search,
    History,
    Download,
    Filter,
    Plus,
    Edit,
    Trash2,
    Upload,
    ClipboardCheck,
    Unlock,
    ArrowLeftRight,
    Sliders,
    Eye,
    FileJson,
    FileText as FileCsv
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
    DropdownMenuTrigger,
} from '../../UI/dropdown-menu';

const ACTION_CONFIG = {
    CREATE: { label: 'إنشاء', icon: Plus, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/30' },
    UPDATE: { label: 'تحديث', icon: Edit, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30' },
    DELETE: { label: 'حذف', icon: Trash2, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30' },
    ADJUSTMENT: { label: 'تعديل', icon: Sliders, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/30' },
    IMPORT: { label: 'استيراد', icon: Upload, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-900/30' },
    CYCLE_COUNT: { label: 'جرد', icon: ClipboardCheck, color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-100 dark:bg-cyan-900/30' },
    FORCE_RELEASE: { label: 'إطلاق قسري', icon: Unlock, color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-100 dark:bg-yellow-900/30' },
    TRANSFER: { label: 'تحويل', icon: ArrowLeftRight, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-100 dark:bg-indigo-900/30' },
};

interface AuditEntry {
    id: string;
    action: keyof typeof ACTION_CONFIG;
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

export function AuditTrailPanel() {
    const [searchQuery, setSearchQuery] = useState('');
    const [actionFilter, setActionFilter] = useState<string>('all');
    const [dateRange, setDateRange] = useState<string>('7d');

    // Mock data
    const auditEntries: AuditEntry[] = [
        {
            id: 'audit-001',
            action: 'ADJUSTMENT',
            sku: 'ELEC-001',
            productName: 'سماعة لاسلكية',
            previousQty: 95,
            newQty: 100,
            variance: 5,
            warehouseName: 'مستودع الرياض',
            userId: 'user-001',
            userName: 'أحمد محمد',
            notes: 'تصحيح بعد الجرد',
            createdAt: '2026-01-02 10:30:45',
        },
        {
            id: 'audit-002',
            action: 'TRANSFER',
            sku: 'FASH-234',
            productName: 'قميص رجالي',
            previousQty: 150,
            newQty: 120,
            variance: -30,
            warehouseName: 'مستودع الرياض',
            userId: 'user-002',
            userName: 'سارة أحمد',
            notes: 'تحويل إلى مستودع جدة',
            createdAt: '2026-01-02 09:15:22',
        },
        {
            id: 'audit-003',
            action: 'IMPORT',
            sku: 'HOME-890',
            productName: 'طقم أواني',
            previousQty: 0,
            newQty: 50,
            variance: 50,
            warehouseName: 'مستودع الدمام',
            userId: 'user-001',
            userName: 'أحمد محمد',
            notes: 'استيراد CSV',
            createdAt: '2026-01-02 08:00:10',
        },
        {
            id: 'audit-004',
            action: 'FORCE_RELEASE',
            sku: 'ACC-123',
            productName: 'حقيبة جلدية',
            previousQty: 10,
            newQty: 10,
            variance: 0,
            warehouseName: 'مستودع جدة',
            userId: 'user-003',
            userName: 'محمد علي',
            notes: 'إطلاق حجز معلق - طلب ملغي',
            createdAt: '2026-01-01 16:45:33',
        },
        {
            id: 'audit-005',
            action: 'CYCLE_COUNT',
            sku: 'ELEC-045',
            productName: 'شاحن USB-C',
            previousQty: 25,
            newQty: 23,
            variance: -2,
            warehouseName: 'مستودع الرياض',
            userId: 'user-002',
            userName: 'سارة أحمد',
            notes: 'نتيجة جرد Q1',
            createdAt: '2026-01-01 14:20:00',
        },
        {
            id: 'audit-006',
            action: 'DELETE',
            sku: 'OLD-001',
            productName: 'منتج قديم',
            previousQty: 5,
            newQty: 0,
            variance: -5,
            warehouseName: 'مستودع الرياض',
            userId: 'user-001',
            userName: 'أحمد محمد',
            notes: 'إزالة منتج متوقف',
            createdAt: '2026-01-01 11:30:15',
        },
    ];

    // Filter entries
    const filteredEntries = auditEntries.filter(entry => {
        const matchesSearch =
            entry.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
            entry.productName.includes(searchQuery) ||
            entry.userName.includes(searchQuery) ||
            entry.notes.includes(searchQuery);

        const matchesAction = actionFilter === 'all' || entry.action === actionFilter;

        return matchesSearch && matchesAction;
    });

    // Stats
    const totalChanges = auditEntries.length;
    const positiveChanges = auditEntries.filter(e => e.variance > 0).length;
    const negativeChanges = auditEntries.filter(e => e.variance < 0).length;
    const netVariance = auditEntries.reduce((sum, e) => sum + e.variance, 0);

    // Export functions
    const handleExportCSV = () => {
        const headers = 'التاريخ,الإجراء,SKU,المنتج,الكمية السابقة,الكمية الجديدة,الفرق,المستودع,المستخدم,الملاحظات';
        const rows = filteredEntries.map(e =>
            `${e.createdAt},${ACTION_CONFIG[e.action].label},${e.sku},${e.productName},${e.previousQty},${e.newQty},${e.variance},${e.warehouseName},${e.userName},"${e.notes}"`
        );
        const csv = [headers, ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `audit_trail_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    const handleExportJSON = () => {
        const json = JSON.stringify(filteredEntries, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `audit_trail_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
    };

    return (
        <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">إجمالي التغييرات</p>
                        <p className="text-2xl font-bold">{totalChanges}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">صافي الفرق</p>
                        <p className={`text-2xl font-bold ${netVariance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {netVariance >= 0 ? '+' : ''}{netVariance}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">زيادات</p>
                        <p className="text-2xl font-bold text-green-600">{positiveChanges}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">نقصان</p>
                        <p className="text-2xl font-bold text-red-600">{negativeChanges}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Audit Log */}
            <Card>
                <CardHeader className="pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <CardTitle className="flex items-center gap-2">
                            <History className="w-5 h-5" />
                            سجل التدقيق
                        </CardTitle>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="gap-2">
                                    <Download className="w-4 h-4" />
                                    تصدير
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={handleExportCSV} className="gap-2">
                                    <FileCsv className="w-4 h-4" />
                                    تصدير CSV
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={handleExportJSON} className="gap-2">
                                    <FileJson className="w-4 h-4" />
                                    تصدير JSON
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </CardHeader>

                <CardContent className="space-y-4">
                    {/* Filters */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="بحث بالـ SKU، المنتج، المستخدم..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pr-10 pl-4 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                        </div>

                        <Select value={actionFilter} onValueChange={setActionFilter}>
                            <SelectTrigger className="w-full sm:w-40">
                                <SelectValue placeholder="الإجراء" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">جميع الإجراءات</SelectItem>
                                {Object.entries(ACTION_CONFIG).map(([key, config]) => (
                                    <SelectItem key={key} value={key}>
                                        {config.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={dateRange} onValueChange={setDateRange}>
                            <SelectTrigger className="w-full sm:w-32">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="1d">اليوم</SelectItem>
                                <SelectItem value="7d">7 أيام</SelectItem>
                                <SelectItem value="30d">30 يوم</SelectItem>
                                <SelectItem value="90d">90 يوم</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Audit Table */}
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
                                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground hidden xl:table-cell">الملاحظات</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredEntries.map((entry) => {
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
                                                <div>
                                                    <p className="font-medium">{entry.productName}</p>
                                                    <p className="text-xs text-muted-foreground font-mono">{entry.sku}</p>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="text-sm">
                                                    <span className="text-muted-foreground">{entry.previousQty}</span>
                                                    <span className="mx-1">→</span>
                                                    <span>{entry.newQty}</span>
                                                    <Badge
                                                        variant="secondary"
                                                        className={`mr-2 ${entry.variance > 0
                                                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                                                : entry.variance < 0
                                                                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                                                    : 'bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-300'
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
                                            <td className="px-4 py-4 text-sm text-muted-foreground hidden xl:table-cell">
                                                <span className="line-clamp-1">{entry.notes}</span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        {filteredEntries.length === 0 && (
                            <div className="p-8 text-center text-muted-foreground">
                                لا توجد سجلات مطابقة للبحث
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
