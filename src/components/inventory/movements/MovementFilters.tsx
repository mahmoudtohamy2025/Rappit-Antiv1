/**
 * Movement Filters Component
 * Filter controls for movement list
 * 
 * Part of: UI-INV-02 (Backend: stock-movement.service.ts)
 */

import { Search, Filter, X } from 'lucide-react';
import { Button } from '../../UI/button';
import { Badge } from '../../UI/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../UI/select';

interface MovementFiltersProps {
    searchQuery: string;
    onSearchChange: (query: string) => void;
    typeFilter: string;
    onTypeChange: (type: string) => void;
    statusFilter: string;
    onStatusChange: (status: string) => void;
    dateRange: string;
    onDateRangeChange: (range: string) => void;
    onClear: () => void;
}

const MOVEMENT_TYPES = [
    { value: 'RECEIVE', label: 'استلام' },
    { value: 'SHIP', label: 'شحن' },
    { value: 'RETURN', label: 'إرجاع' },
    { value: 'TRANSFER_OUT', label: 'تحويل صادر' },
    { value: 'TRANSFER_IN', label: 'تحويل وارد' },
    { value: 'ADJUSTMENT_ADD', label: 'تعديل (+)' },
    { value: 'ADJUSTMENT_REMOVE', label: 'تعديل (-)' },
    { value: 'DAMAGE', label: 'تالف' },
];

const STATUSES = [
    { value: 'PENDING', label: 'معلق' },
    { value: 'COMPLETED', label: 'مكتمل' },
    { value: 'CANCELLED', label: 'ملغي' },
];

const DATE_RANGES = [
    { value: 'today', label: 'اليوم' },
    { value: '7d', label: '7 أيام' },
    { value: '30d', label: '30 يوم' },
    { value: '90d', label: '90 يوم' },
    { value: 'all', label: 'الكل' },
];

export function MovementFilters({
    searchQuery,
    onSearchChange,
    typeFilter,
    onTypeChange,
    statusFilter,
    onStatusChange,
    dateRange,
    onDateRangeChange,
    onClear,
}: MovementFiltersProps) {
    const hasFilters = typeFilter !== 'all' || statusFilter !== 'all' || dateRange !== 'all' || searchQuery;

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

                {/* Type Filter */}
                <Select value={typeFilter} onValueChange={onTypeChange}>
                    <SelectTrigger className="w-full sm:w-36">
                        <SelectValue placeholder="النوع" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">جميع الأنواع</SelectItem>
                        {MOVEMENT_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                                {type.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* Status Filter */}
                <Select value={statusFilter} onValueChange={onStatusChange}>
                    <SelectTrigger className="w-full sm:w-32">
                        <SelectValue placeholder="الحالة" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">جميع الحالات</SelectItem>
                        {STATUSES.map((status) => (
                            <SelectItem key={status.value} value={status.value}>
                                {status.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* Date Range */}
                <Select value={dateRange} onValueChange={onDateRangeChange}>
                    <SelectTrigger className="w-full sm:w-28">
                        <SelectValue placeholder="الفترة" />
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

                    {typeFilter !== 'all' && (
                        <Badge variant="secondary" className="gap-1">
                            النوع: {MOVEMENT_TYPES.find(t => t.value === typeFilter)?.label}
                            <button onClick={() => onTypeChange('all')}>
                                <X className="w-3 h-3" />
                            </button>
                        </Badge>
                    )}

                    {statusFilter !== 'all' && (
                        <Badge variant="secondary" className="gap-1">
                            الحالة: {STATUSES.find(s => s.value === statusFilter)?.label}
                            <button onClick={() => onStatusChange('all')}>
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
