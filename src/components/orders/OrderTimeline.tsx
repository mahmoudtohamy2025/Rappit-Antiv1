/**
 * Order Timeline Component
 * Visual status history for orders
 * 
 * Part of: GAP-08 Orders Enhancements
 */

import { useEffect, useState } from 'react';
import {
    Clock,
    Package,
    Truck,
    CheckCircle2,
    XCircle,
    RefreshCw,
    CreditCard,
    Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../UI/card';
import { useOrders, TimelineEvent, OrderStatus } from '../../../hooks/useOrders';

interface OrderTimelineProps {
    orderId: string;
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; icon: any; color: string }> = {
    PENDING: { label: 'في الانتظار', icon: Clock, color: 'text-gray-500' },
    CONFIRMED: { label: 'مؤكد', icon: CheckCircle2, color: 'text-blue-600' },
    PROCESSING: { label: 'قيد التجهيز', icon: Package, color: 'text-yellow-600' },
    SHIPPED: { label: 'تم الشحن', icon: Truck, color: 'text-purple-600' },
    DELIVERED: { label: 'تم التسليم', icon: CheckCircle2, color: 'text-green-600' },
    CANCELLED: { label: 'ملغي', icon: XCircle, color: 'text-red-600' },
    REFUNDED: { label: 'مسترد', icon: CreditCard, color: 'text-orange-600' },
};

export function OrderTimeline({ orderId }: OrderTimelineProps) {
    const { getTimeline } = useOrders();
    const [events, setEvents] = useState<TimelineEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function loadTimeline() {
            setIsLoading(true);
            try {
                const data = await getTimeline(orderId);
                setEvents(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'فشل تحميل الجدول الزمني');
            } finally {
                setIsLoading(false);
            }
        }

        if (orderId) {
            loadTimeline();
        }
    }, [orderId, getTimeline]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-lg">
                {error}
            </div>
        );
    }

    return (
        <Card dir="rtl">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4" />
                    الجدول الزمني
                </CardTitle>
            </CardHeader>
            <CardContent>
                {events.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">
                        لا توجد أحداث
                    </p>
                ) : (
                    <div className="relative">
                        {/* Timeline line */}
                        <div className="absolute top-0 bottom-0 right-4 w-0.5 bg-border" />

                        <div className="space-y-4">
                            {events.map((event, index) => {
                                const config = STATUS_CONFIG[event.status];
                                const Icon = config?.icon || Clock;

                                return (
                                    <div key={event.id} className="relative flex items-start gap-4 pr-8">
                                        {/* Icon */}
                                        <div className={`absolute right-0 p-2 rounded-full bg-background border-2 ${index === 0 ? 'border-primary' : 'border-border'
                                            }`}>
                                            <Icon className={`w-4 h-4 ${config?.color || 'text-gray-500'}`} />
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 pr-6">
                                            <p className="font-medium">{config?.label || event.status}</p>
                                            {event.notes && (
                                                <p className="text-sm text-muted-foreground mt-1">
                                                    {event.notes}
                                                </p>
                                            )}
                                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                                <span>
                                                    {new Date(event.createdAt).toLocaleString('ar-SA')}
                                                </span>
                                                {event.userName && (
                                                    <>
                                                        <span>•</span>
                                                        <span>{event.userName}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
