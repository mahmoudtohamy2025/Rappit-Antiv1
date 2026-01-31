/**
 * Force Release Panel
 * Main panel for releasing stuck inventory reservations
 * 
 * Part of: UI-INV-05 (Backend: force-release.service.ts - 87 tests)
 */

import { useState } from 'react';
import {
    Unlock,
    AlertTriangle,
    Clock,
    CheckCircle2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../UI/card';
import { Button } from '../../UI/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../UI/tabs';
import { StuckReservationList } from './StuckReservationList';
import { ReleaseModal } from './ReleaseModal';
import { BatchReleaseModal } from './BatchReleaseModal';
import { ReleaseHistory } from './ReleaseHistory';

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

export function ForceReleasePanel() {
    const [activeTab, setActiveTab] = useState('stuck');
    const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isReleaseModalOpen, setIsReleaseModalOpen] = useState(false);
    const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);

    // Mock data
    const stuckReservations: Reservation[] = [
        {
            id: 'res-001',
            sku: 'ELEC-001',
            productName: 'سماعة لاسلكية',
            quantity: 5,
            orderId: 'order-123',
            orderNumber: '#ORD-1234',
            warehouseName: 'مستودع الرياض',
            createdAt: '2026-01-02 08:15',
            ageMinutes: 75,
        },
        {
            id: 'res-002',
            sku: 'FASH-234',
            productName: 'قميص رجالي',
            quantity: 3,
            orderId: 'order-456',
            orderNumber: '#ORD-1567',
            warehouseName: 'مستودع جدة',
            createdAt: '2026-01-02 07:45',
            ageMinutes: 105,
        },
        {
            id: 'res-003',
            sku: 'ACC-123',
            productName: 'حقيبة جلدية',
            quantity: 2,
            orderId: 'order-789',
            orderNumber: '#ORD-1890',
            warehouseName: 'مستودع الرياض',
            createdAt: '2026-01-02 06:30',
            ageMinutes: 180,
        },
        {
            id: 'res-004',
            sku: 'HOME-890',
            productName: 'طقم أواني',
            quantity: 1,
            orderId: 'order-101',
            orderNumber: '#ORD-2001',
            warehouseName: 'مستودع الدمام',
            createdAt: '2026-01-02 08:45',
            ageMinutes: 45,
        },
    ];

    // Filter stuck (> 30 min)
    const stuckCount = stuckReservations.filter(r => r.ageMinutes > 30).length;
    const criticalCount = stuckReservations.filter(r => r.ageMinutes > 60).length;

    const handleSingleRelease = (reservation: Reservation) => {
        setSelectedReservation(reservation);
        setIsReleaseModalOpen(true);
    };

    const handleBatchRelease = () => {
        if (selectedIds.length > 0) {
            setIsBatchModalOpen(true);
        }
    };

    const handleReleaseComplete = () => {
        // Refresh data after release
        setSelectedIds([]);
        setSelectedReservation(null);
        setIsReleaseModalOpen(false);
        setIsBatchModalOpen(false);
    };

    return (
        <div className="space-y-6" dir="rtl">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold flex items-center gap-2">
                        <Unlock className="w-6 h-6" />
                        إطلاق الحجوزات
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        معالجة الحجوزات المعلقة وإطلاقها
                    </p>
                </div>
                {selectedIds.length > 0 && (
                    <Button onClick={handleBatchRelease} variant="destructive" className="gap-2">
                        <Unlock className="w-4 h-4" />
                        إطلاق {selectedIds.length} محدد
                    </Button>
                )}
            </div>

            {/* Alert for stuck reservations */}
            {stuckCount > 0 && (
                <Card className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-yellow-100 dark:bg-yellow-900/50 rounded-lg">
                                <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                            </div>
                            <div className="flex-1">
                                <p className="font-medium text-yellow-900 dark:text-yellow-100">
                                    {stuckCount} حجوزات معلقة تحتاج انتباه
                                </p>
                                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                                    {criticalCount > 0 && `${criticalCount} منها معلقة أكثر من ساعة`}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">إجمالي الحجوزات</p>
                        <p className="text-2xl font-bold">{stuckReservations.length}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">معلقة (30+ دقيقة)</p>
                        <p className="text-2xl font-bold text-yellow-600">{stuckCount}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">حرجة (60+ دقيقة)</p>
                        <p className="text-2xl font-bold text-red-600">{criticalCount}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">تم إطلاقها اليوم</p>
                        <p className="text-2xl font-bold text-green-600">12</p>
                    </CardContent>
                </Card>
            </div>

            {/* Main Content */}
            <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl">
                <TabsList>
                    <TabsTrigger value="stuck" className="gap-2">
                        <Clock className="w-4 h-4" />
                        الحجوزات المعلقة
                        {stuckCount > 0 && (
                            <span className="mr-1 bg-yellow-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                                {stuckCount}
                            </span>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="history" className="gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        سجل الإطلاق
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="stuck" className="mt-6">
                    <StuckReservationList
                        reservations={stuckReservations.filter(r => r.ageMinutes > 30)}
                        selectedIds={selectedIds}
                        onSelectIds={setSelectedIds}
                        onRelease={handleSingleRelease}
                    />
                </TabsContent>

                <TabsContent value="history" className="mt-6">
                    <ReleaseHistory />
                </TabsContent>
            </Tabs>

            {/* Release Modal */}
            <ReleaseModal
                open={isReleaseModalOpen}
                onOpenChange={setIsReleaseModalOpen}
                reservation={selectedReservation}
                onComplete={handleReleaseComplete}
            />

            {/* Batch Release Modal */}
            <BatchReleaseModal
                open={isBatchModalOpen}
                onOpenChange={setIsBatchModalOpen}
                count={selectedIds.length}
                onComplete={handleReleaseComplete}
            />
        </div>
    );
}
