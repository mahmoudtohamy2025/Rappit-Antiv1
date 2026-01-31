/**
 * Stuck Reservation List Component
 * Displays stuck reservations with selection and release actions
 * 
 * Part of: UI-INV-05 (Backend: force-release.service.ts)
 */

import {
    Unlock,
    Clock,
    AlertTriangle,
    Package
} from 'lucide-react';
import { Card, CardContent } from '../../UI/card';
import { Button } from '../../UI/button';
import { Badge } from '../../UI/badge';
import { Checkbox } from '../../UI/checkbox';

interface Reservation {
    id: string;
    sku: string;
    productName: string;
    quantity: number;
    orderId: string;
    orderNumber: string;
    warehouseName: string;
    createdAt: string;
    ageMinutes: number;
}

interface StuckReservationListProps {
    reservations: Reservation[];
    selectedIds: string[];
    onSelectIds: (ids: string[]) => void;
    onRelease: (reservation: Reservation) => void;
}

export function StuckReservationList({
    reservations,
    selectedIds,
    onSelectIds,
    onRelease
}: StuckReservationListProps) {

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            onSelectIds(reservations.map(r => r.id));
        } else {
            onSelectIds([]);
        }
    };

    const handleSelectOne = (id: string, checked: boolean) => {
        if (checked) {
            onSelectIds([...selectedIds, id]);
        } else {
            onSelectIds(selectedIds.filter(i => i !== id));
        }
    };

    const formatAge = (minutes: number): string => {
        if (minutes < 60) {
            return `${minutes} دقيقة`;
        } else {
            const hours = Math.floor(minutes / 60);
            const mins = minutes % 60;
            return `${hours} ساعة ${mins > 0 ? `و ${mins} دقيقة` : ''}`;
        }
    };

    const getAgeColor = (minutes: number): string => {
        if (minutes >= 120) return 'text-red-600 dark:text-red-400';
        if (minutes >= 60) return 'text-orange-600 dark:text-orange-400';
        return 'text-yellow-600 dark:text-yellow-400';
    };

    const getAgeBadge = (minutes: number): string => {
        if (minutes >= 120) return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
        if (minutes >= 60) return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300';
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300';
    };

    if (reservations.length === 0) {
        return (
            <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                    <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg mb-2">لا توجد حجوزات معلقة</p>
                    <p className="text-sm">جميع الحجوزات تعمل بشكل طبيعي</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            {/* Select All */}
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <Checkbox
                    checked={selectedIds.length === reservations.length && reservations.length > 0}
                    onCheckedChange={handleSelectAll}
                />
                <span className="text-sm">
                    {selectedIds.length > 0
                        ? `تم تحديد ${selectedIds.length} من ${reservations.length}`
                        : 'تحديد الكل'
                    }
                </span>
            </div>

            {/* Reservations List */}
            <div className="space-y-3">
                {reservations.map((reservation) => (
                    <Card
                        key={reservation.id}
                        className={`transition-colors ${selectedIds.includes(reservation.id)
                                ? 'border-primary bg-primary/5'
                                : ''
                            }`}
                    >
                        <CardContent className="p-4">
                            <div className="flex items-start gap-4">
                                {/* Checkbox */}
                                <Checkbox
                                    checked={selectedIds.includes(reservation.id)}
                                    onCheckedChange={(checked) => handleSelectOne(reservation.id, checked as boolean)}
                                    className="mt-1"
                                />

                                {/* Info */}
                                <div className="flex-1 space-y-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h3 className="font-medium">{reservation.productName}</h3>
                                        <Badge variant="secondary" className={`gap-1 ${getAgeBadge(reservation.ageMinutes)} border-0`}>
                                            <Clock className="w-3 h-3" />
                                            {formatAge(reservation.ageMinutes)}
                                        </Badge>
                                        {reservation.ageMinutes >= 60 && (
                                            <AlertTriangle className="w-4 h-4 text-orange-500" />
                                        )}
                                    </div>

                                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                                        <span>SKU: <span className="font-mono">{reservation.sku}</span></span>
                                        <span>الكمية: <span className="font-medium">{reservation.quantity}</span></span>
                                        <span>الطلب: <span className="font-medium">{reservation.orderNumber}</span></span>
                                        <span>المستودع: {reservation.warehouseName}</span>
                                    </div>

                                    <p className="text-xs text-muted-foreground">
                                        تاريخ الحجز: {reservation.createdAt}
                                    </p>
                                </div>

                                {/* Release Button */}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onRelease(reservation)}
                                    className="gap-1"
                                >
                                    <Unlock className="w-4 h-4" />
                                    إطلاق
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
