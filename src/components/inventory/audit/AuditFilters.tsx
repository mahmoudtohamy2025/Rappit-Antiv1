/**
 * Audit Filters Component
 * Filter controls for audit log
 * 
 * Part of: UI-INV-07 (Backend: inventory-audit.service.ts)
 */

import { Search, Filter, X, Calendar } from 'lucide-react';
import { Button } from '../../UI/button';
import { Badge } from '../../UI/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../UI/select';

interface AuditFiltersProps {
    searchQuery: string;
    onSearchChange: (query: string) => void;
    actionFilter: string;
    onActionChange: (action: string) => void;
    userFilter: string;
    onUserChange: (user: string) => void;
    dateRange: string;
    onDateRangeChange: (range: string) => void;
    onClear: () => void;
}

const ACTION_TYPES = [
    { value: 'CREATE', label: 'إنشاء' },
    { value: 'UPDATE', label: 'تحديث' },
    { value: 'DELETE', label: 'حذف' },
    { value: 'ADJUSTMENT', label: 'تعديل' },
    { value: 'IMPORT', label: 'استيراد' },
    { value: 'CYCLE_COUNT', label: 'جرد' },
    { value: 'FORCE_RELEASE', label: 'إطلاق قسري' },
    { value: 'TRANSFER', label: 'تحويل' },
];

const USERS = [
    { value: 'user-1', label: 'أحمد محمد' },
    { value: 'user-2', label: 'سارة أحمد' },
    { value: 'user-3', label: 'محمد علي' },
];

const DATE_RANGES = [
    { value: 'today', label: 'اليوم' },
    { value: '7d', label: '7 أيام' },
    { value: '30d', label: '30 يوم' },
    { value: '90d', label: '90 يوم' },
    { value: 'all', label: 'الكل' },
];

export function AuditFilters({
    searchQuery,
    onSearchChange,
    actionFilter,
    onActionChange,
    userFilter,
    onUserChange,
    dateRange,
    onDateRangeChange,
    onClear,
}: AuditFiltersProps) {
    const hasFilters = actionFilter !== 'all' || userFilter !== 'all' || dateRange !== 'all' || searchQuery;

    return (
        <div className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
                {/* Search */}
                <div className="relative flex-1">
                    <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="بحث بالـ SKU أو اسم المنتج..."
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="w-full pr-10 pl-4 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                </div>

                {/* Action Filter */}
                <Select value={actionFilter} onValueChange={onActionChange}>
                    <SelectTrigger className="w-full sm:w-36">
                        <SelectValue placeholder="الإجراء" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">جميع الإجراءات</SelectItem>
                        {ACTION_TYPES.map((action) => (
                            <SelectItem key={action.value} value={action.value}>
                                {action.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* User Filter */}
                <Select value={userFilter} onValueChange={onUserChange}>
                    <SelectTrigger className="w-full sm:w-32">
                        <SelectValue placeholder="المستخدم" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">جميع المستخدمين</SelectItem>
                        {USERS.map((user) => (
                            <SelectItem key={user.value} value={user.value}>
                                {user.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* Date Range */}
                <Select value={dateRange} onValueChange={onDateRangeChange}>
                    <SelectTrigger className="w-full sm:w-28">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {DATE_RANGES.map((range) => (
                            <SelectItem key={range.value} value={range.value}>
                                {range.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Active Filters */}
            {hasFilters && (
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <Filter className="w-4 h-4" />
                        الفلاتر النشطة:
                    </span>

                    {searchQuery && (
                        <Badge variant="secondary" className="gap-1">
                            بحث: {searchQuery}
                            <button onClick={() => onSearchChange('')}>
                                <X className="w-3 h-3" />
                            </button>
                        </Badge>
                    )}

                    {actionFilter !== 'all' && (
                        <Badge variant="secondary" className="gap-1">
                            الإجراء: {ACTION_TYPES.find(a => a.value === actionFilter)?.label}
                            <button onClick={() => onActionChange('all')}>
                                <X className="w-3 h-3" />
                            </button>
                        </Badge>
                    )}

                    {userFilter !== 'all' && (
                        <Badge variant="secondary" className="gap-1">
                            المستخدم: {USERS.find(u => u.value === userFilter)?.label}
                            <button onClick={() => onUserChange('all')}>
                                <X className="w-3 h-3" />
                            </button>
                        </Badge>
                    )}

                    {dateRange !== 'all' && (
                        <Badge variant="secondary" className="gap-1">
                            الفترة: {DATE_RANGES.find(d => d.value === dateRange)?.label}
                            <button onClick={() => onDateRangeChange('all')}>
                                <X className="w-3 h-3" />
                            </button>
                        </Badge>
                    )}

                    <Button variant="ghost" size="sm" onClick={onClear} className="text-xs">
                        مسح الكل
                    </Button>
                </div>
            )}
        </div>
    );
}
