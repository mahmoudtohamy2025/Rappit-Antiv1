/**
 * Movement Type Badge Component
 * Colored badge showing movement type with icon
 * 
 * Part of: UI-INV-02 (Backend: stock-movement.service.ts)
 */

import {
    PackagePlus,
    Truck,
    RotateCcw,
    ArrowRight,
    ArrowLeft,
    Plus,
    Minus,
    AlertTriangle
} from 'lucide-react';
import { Badge } from '../../UI/badge';

type MovementType = 'RECEIVE' | 'SHIP' | 'RETURN' | 'TRANSFER_OUT' | 'TRANSFER_IN' | 'ADJUSTMENT_ADD' | 'ADJUSTMENT_REMOVE' | 'DAMAGE';

interface MovementTypeBadgeProps {
    type: MovementType;
    showLabel?: boolean;
}

const TYPE_CONFIG = {
    RECEIVE: {
        label: 'استلام',
        icon: PackagePlus,
        color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
    },
    SHIP: {
        label: 'شحن',
        icon: Truck,
        color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
    },
    RETURN: {
        label: 'إرجاع',
        icon: RotateCcw,
        color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
    },
    TRANSFER_OUT: {
        label: 'تحويل صادر',
        icon: ArrowRight,
        color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
    },
    TRANSFER_IN: {
        label: 'تحويل وارد',
        icon: ArrowLeft,
        color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
    },
    ADJUSTMENT_ADD: {
        label: 'تعديل (+)',
        icon: Plus,
        color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
    },
    ADJUSTMENT_REMOVE: {
        label: 'تعديل (-)',
        icon: Minus,
        color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
    },
    DAMAGE: {
        label: 'تالف',
        icon: AlertTriangle,
        color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
    },
};

export function MovementTypeBadge({ type, showLabel = true }: MovementTypeBadgeProps) {
    const config = TYPE_CONFIG[type];
    const Icon = config.icon;

    return (
        <Badge
            variant="secondary"
            className={`gap-1 ${config.color} border-0`}
        >
            <Icon className="w-3 h-3" />
            {showLabel && config.label}
        </Badge>
    );
}
