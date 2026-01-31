/**
 * Inventory Filters Component
 * Unified filter controls for inventory panels
 * 
 * Part of: GAP-05 Enhanced Filters
 */

import { useState, useEffect } from 'react';
import {
    Filter,
    X,
    Warehouse,
    Tag,
    Calendar,
    AlertTriangle,
    Package,
    Check,
} from 'lucide-react';
import { Button } from '../UI/button';
import { Badge } from '../UI/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../UI/select';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '../UI/popover';
import { useFilters, FilterState, StockLevel } from '../../hooks/useFilters';
import { useWarehouses } from '../../hooks/useWarehouses';

// ============================================================
// TYPES
// ============================================================

interface InventoryFiltersProps {
    onFilterChange: (filters: FilterState) => void;
    categories?: string[];
    showStockLevel?: boolean;
    showDateRange?: boolean;
    showCategories?: boolean;
    className?: string;
}

interface Warehouse {
    id: string;
    name: string;
}

// ============================================================
// STOCK LEVEL CONFIG
// ============================================================

const STOCK_LEVELS: { value: StockLevel; label: string; icon: any; color: string }[] = [
    { value: 'all', label: 'الكل', icon: Package, color: '' },
    { value: 'low', label: 'منخفض', icon: AlertTriangle, color: 'text-yellow-600' },
    { value: 'out', label: 'نفذ', icon: X, color: 'text-red-600' },
    { value: 'normal', label: 'متوفر', icon: Check, color: 'text-green-600' },
];

// ============================================================
// COMPONENT
// ============================================================

export function InventoryFilters({
    onFilterChange,
    categories = [],
    showStockLevel = true,
    showDateRange = true,
    showCategories = true,
    className = '',
}: InventoryFiltersProps) {
    const {
        filters,
        setWarehouse,
        setCategory,
        setStockLevel,
        setDateRange,
        clearFilters,
        hasActiveFilters,
        activeFilterCount,
        activeFilterLabels,
        removeFilter,
    } = useFilters({ onFilterChange });

    // Fetch warehouses
    const { warehouses, fetch: fetchWarehouses } = useWarehouses();
    const [dateStart, setDateStart] = useState('');
    const [dateEnd, setDateEnd] = useState('');

    useEffect(() => {
        fetchWarehouses();
    }, []);

    const handleDateApply = () => {
        if (dateStart && dateEnd) {
            setDateRange(dateStart, dateEnd);
        }
    };

    const handleClearDates = () => {
        setDateStart('');
        setDateEnd('');
        setDateRange(undefined, undefined);
    };

    return (
        <div className={`space-y-3 ${className}`} dir="rtl">
            {/* Filter Controls */}
            <div className="flex flex-wrap gap-2 items-center">
                <div className="flex items-center gap-1 text-muted-foreground">
                    <Filter className="w-4 h-4" />
                    <span className="text-sm">فلترة:</span>
                </div>

                {/* Warehouse Filter */}
                <Select
                    value={filters.warehouseId || 'all'}
                    onValueChange={(value) => {
                        if (value === 'all') {
                            setWarehouse(undefined);
                        } else {
                            const wh = warehouses.find(w => w.id === value);
                            setWarehouse(value, wh?.name);
                        }
                    }}
                >
                    <SelectTrigger className="w-40">
                        <Warehouse className="w-4 h-4 ml-2" />
                        <SelectValue placeholder="المستودع" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">جميع المستودعات</SelectItem>
                        {warehouses.map((wh) => (
                            <SelectItem key={wh.id} value={wh.id}>
                                {wh.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* Category Filter */}
                {showCategories && categories.length > 0 && (
                    <Select
                        value={filters.category || 'all'}
                        onValueChange={(value) => setCategory(value === 'all' ? undefined : value)}
                    >
                        <SelectTrigger className="w-36">
                            <Tag className="w-4 h-4 ml-2" />
                            <SelectValue placeholder="الفئة" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">جميع الفئات</SelectItem>
                            {categories.map((cat) => (
                                <SelectItem key={cat} value={cat}>
                                    {cat}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}

                {/* Stock Level Filter */}
                {showStockLevel && (
                    <Select
                        value={filters.stockLevel || 'all'}
                        onValueChange={(value) => setStockLevel(value as StockLevel)}
                    >
                        <SelectTrigger className="w-32">
                            <SelectValue placeholder="المخزون" />
                        </SelectTrigger>
                        <SelectContent>
                            {STOCK_LEVELS.map((level) => {
                                const Icon = level.icon;
                                return (
                                    <SelectItem key={level.value} value={level.value}>
                                        <div className="flex items-center gap-2">
                                            <Icon className={`w-4 h-4 ${level.color}`} />
                                            {level.label}
                                        </div>
                                    </SelectItem>
                                );
                            })}
                        </SelectContent>
                    </Select>
                )}

                {/* Date Range Filter */}
                {showDateRange && (
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-2">
                                <Calendar className="w-4 h-4" />
                                {filters.startDate ? (
                                    `${filters.startDate.slice(5)} - ${filters.endDate?.slice(5)}`
                                ) : (
                                    'الفترة'
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72" dir="rtl">
                            <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-xs text-muted-foreground">من</label>
                                        <input
                                            type="date"
                                            value={dateStart}
                                            onChange={(e) => setDateStart(e.target.value)}
                                            className="w-full p-2 border rounded text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-muted-foreground">إلى</label>
                                        <input
                                            type="date"
                                            value={dateEnd}
                                            onChange={(e) => setDateEnd(e.target.value)}
                                            className="w-full p-2 border rounded text-sm"
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button size="sm" onClick={handleDateApply} className="flex-1">
                                        تطبيق
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={handleClearDates}>
                                        مسح
                                    </Button>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>
                )}

                {/* Clear Filters */}
                {hasActiveFilters && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearFilters}
                        className="text-muted-foreground hover:text-destructive"
                    >
                        <X className="w-4 h-4 ml-1" />
                        مسح الفلاتر
                    </Button>
                )}
            </div>

            {/* Active Filter Badges */}
            {activeFilterLabels.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {activeFilterLabels.map((filter) => (
                        <Badge
                            key={filter.key}
                            variant="secondary"
                            className="gap-1 pl-1"
                        >
                            <span className="text-muted-foreground">{filter.label}:</span>
                            <span>{filter.value}</span>
                            <button
                                onClick={() => removeFilter(filter.key)}
                                className="p-0.5 hover:bg-muted rounded-full"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </Badge>
                    ))}
                    <Badge variant="outline" className="gap-1">
                        {activeFilterCount} فلتر نشط
                    </Badge>
                </div>
            )}
        </div>
    );
}
