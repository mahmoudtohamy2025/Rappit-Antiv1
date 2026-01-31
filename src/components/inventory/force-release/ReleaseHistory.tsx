/**
 * Release History Component
 * Audit log of past force releases
 * 
 * Part of: UI-INV-05 (Backend: force-release.service.ts)
 */

import {
    Unlock,
    Calendar,
    User,
    Package
} from 'lucide-react';
import { Card, CardContent } from '../../UI/card';
import { Badge } from '../../UI/badge';

interface ReleaseRecord {
    id: string;
    sku: string;
    productName: string;
    quantity: number;
    orderNumber: string;
    reasonCode: string;
    reasonLabel: string;
    notes?: string;
    releasedBy: string;
    releasedAt: string;
}

const REASON_COLORS: Record<string, string> = {
    STUCK_ORDER: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
    ORDER_CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    EXPIRED: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    DUPLICATE: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    ADMIN_OVERRIDE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    SYSTEM_RECOVERY: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
};

export function ReleaseHistory() {
    // Mock data
    const releaseHistory: ReleaseRecord[] = [
        {
            id: 'rel-001',
            sku: 'ELEC-002',
            productName: 'شاحن لاسلكي',
            quantity: 3,
            orderNumber: '#ORD-1100',
            reasonCode: 'ORDER_CANCELLED',
            reasonLabel: 'طلب ملغي',
            notes: 'ألغى العميل الطلب',
            releasedBy: 'أحمد محمد',
            releasedAt: '2026-01-02 08:30',
        },
        {
            id: 'rel-002',
            sku: 'FASH-123',
            productName: 'حذاء رياضي',
            quantity: 2,
            orderNumber: '#ORD-1089',
            reasonCode: 'STUCK_ORDER',
            reasonLabel: 'طلب معلق',
            releasedBy: 'سارة أحمد',
            releasedAt: '2026-01-02 07:15',
        },
        {
            id: 'rel-003',
            sku: 'HOME-456',
            productName: 'مصباح طاولة',
            quantity: 5,
            orderNumber: '#ORD-1050',
            reasonCode: 'EXPIRED',
            reasonLabel: 'منتهي الصلاحية',
            notes: 'تجاوز 24 ساعة',
            releasedBy: 'محمد علي',
            releasedAt: '2026-01-01 16:45',
        },
        {
            id: 'rel-004',
            sku: 'ACC-789',
            productName: 'ساعة ذكية',
            quantity: 1,
            orderNumber: '#ORD-1020',
            reasonCode: 'DUPLICATE',
            reasonLabel: 'مكرر',
            notes: 'حجز مكرر لنفس الطلب',
            releasedBy: 'أحمد محمد',
            releasedAt: '2026-01-01 14:20',
        },
        {
            id: 'rel-005',
            sku: 'ELEC-010',
            productName: 'كابل USB-C',
            quantity: 10,
            orderNumber: 'BATCH-001',
            reasonCode: 'SYSTEM_RECOVERY',
            reasonLabel: 'استعادة النظام',
            notes: 'إطلاق جماعي بعد صيانة النظام',
            releasedBy: 'النظام',
            releasedAt: '2026-01-01 10:00',
        },
    ];

    if (releaseHistory.length === 0) {
        return (
            <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                    <Unlock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>لا يوجد سجل إطلاق حتى الآن</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-3">
            {releaseHistory.map((record) => (
                <Card key={record.id} className="hover:shadow-sm transition-shadow">
                    <CardContent className="p-4">
                        <div className="space-y-3">
                            {/* Header */}
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-muted rounded-lg">
                                        <Unlock className="w-4 h-4 text-muted-foreground" />
                                    </div>
                                    <div>
                                        <p className="font-medium">{record.productName}</p>
                                        <p className="text-xs text-muted-foreground font-mono">{record.sku}</p>
                                    </div>
                                </div>
                                <Badge
                                    variant="secondary"
                                    className={`${REASON_COLORS[record.reasonCode] || 'bg-gray-100'} border-0`}
                                >
                                    {record.reasonLabel}
                                </Badge>
                            </div>

                            {/* Details */}
                            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                    <Package className="w-4 h-4" />
                                    الكمية: {record.quantity}
                                </span>
                                <span>الطلب: {record.orderNumber}</span>
                                <span className="flex items-center gap-1">
                                    <User className="w-4 h-4" />
                                    {record.releasedBy}
                                </span>
                                <span className="flex items-center gap-1">
                                    <Calendar className="w-4 h-4" />
                                    {record.releasedAt}
                                </span>
                            </div>

                            {/* Notes */}
                            {record.notes && (
                                <p className="text-sm text-muted-foreground bg-muted p-2 rounded">
                                    {record.notes}
                                </p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
