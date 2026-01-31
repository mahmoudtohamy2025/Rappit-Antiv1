/**
 * Transfer Status Badge Component
 * Colored badge showing transfer status
 * 
 * Part of: UI-INV-06 (Backend: transfer-reservation.service.ts)
 */

import {
    Clock,
    CheckCircle2,
    XCircle,
    Truck,
    Ban
} from 'lucide-react';
import { Badge } from '../../UI/badge';

type TransferStatus = 'PENDING' | 'APPROVED' | 'IN_TRANSIT' | 'COMPLETED' | 'REJECTED' | 'CANCELLED';

interface TransferStatusBadgeProps {
    status: TransferStatus;
}

const STATUS_CONFIG = {
    PENDING: {
        label: 'قيد الانتظار',
        icon: Clock,
        color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
    },
    APPROVED: {
        label: 'تمت الموافقة',
        icon: CheckCircle2,
        color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
    },
    IN_TRANSIT: {
        label: 'قيد التحويل',
        icon: Truck,
        color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
    },
    COMPLETED: {
        label: 'مكتمل',
        icon: CheckCircle2,
        color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
    },
    REJECTED: {
        label: 'مرفوض',
        icon: XCircle,
        color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
    },
    CANCELLED: {
        label: 'ملغي',
        icon: Ban,
        color: 'bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-300'
    },
};

export function TransferStatusBadge({ status }: TransferStatusBadgeProps) {
    const config = STATUS_CONFIG[status];
    const Icon = config.icon;

    return (
        <Badge
            variant="secondary"
            className={`gap-1 ${config.color} border-0`}
        >
            <Icon className="w-3 h-3" />
            {config.label}
        </Badge>
    );
}
