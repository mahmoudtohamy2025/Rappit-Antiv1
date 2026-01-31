/**
 * Active Filter Badges Component
 * Displays currently applied filters as removable badges
 * 
 * Part of: GAP-05 Enhanced Filters
 */

import { X } from 'lucide-react';
import { Badge } from '../UI/badge';
import { FilterLabel } from '../../hooks/useFilters';

interface ActiveFilterBadgesProps {
    filters: FilterLabel[];
    count: number;
    onRemove: (key: string) => void;
    className?: string;
}

export function ActiveFilterBadges({
    filters,
    count,
    onRemove,
    className = '',
}: ActiveFilterBadgesProps) {
    if (filters.length === 0) {
        return null;
    }

    return (
        <div className={`flex flex-wrap gap-2 ${className}`} dir="rtl">
            {filters.map((filter) => (
                <Badge
                    key={filter.key}
                    variant="secondary"
                    className="gap-1 pl-1"
                >
                    <span className="text-muted-foreground">{filter.label}:</span>
                    <span>{filter.value}</span>
                    <button
                        onClick={() => onRemove(filter.key)}
                        className="p-0.5 hover:bg-muted rounded-full transition-colors"
                        aria-label={`إزالة فلتر ${filter.label}`}
                    >
                        <X className="w-3 h-3" />
                    </button>
                </Badge>
            ))}
            <Badge variant="outline" className="gap-1">
                {count} فلتر نشط
            </Badge>
        </div>
    );
}
