/**
 * Sync Dashboard Component
 * Overview of order sync status per channel
 * 
 * Part of: GAP-19 Order Sync UI
 */

import { useEffect, useState } from 'react';
import {
    RefreshCw,
    CheckCircle2,
    AlertTriangle,
    Clock,
    Loader2,
    ShoppingBag,
    Store,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../UI/card';
import { Button } from '../../UI/button';
import { Badge } from '../../UI/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../UI/tabs';
import { useOrderSync, ChannelSyncStatus, SyncStatus } from '../../../hooks/useOrderSync';

// ============================================================
// CONFIG
// ============================================================

const STATUS_CONFIG: Record<SyncStatus, { label: string; icon: any; color: string }> = {
    IDLE: { label: 'جاهز', icon: Clock, color: 'text-gray-600' },
    SYNCING: { label: 'جاري المزامنة', icon: RefreshCw, color: 'text-blue-600' },
    SYNCED: { label: 'متزامن', icon: CheckCircle2, color: 'text-green-600' },
    ERROR: { label: 'خطأ', icon: AlertTriangle, color: 'text-red-600' },
};

const PLATFORM_ICONS: Record<string, any> = {
    SHOPIFY: ShoppingBag,
    WOOCOMMERCE: Store,
};

// ============================================================
// CHANNEL CARD
// ============================================================

function ChannelSyncCard({
    channel,
    onSync,
}: {
    channel: ChannelSyncStatus;
    onSync: () => void;
}) {
    const statusConfig = STATUS_CONFIG[channel.status];
    const StatusIcon = statusConfig.icon;
    const PlatformIcon = PLATFORM_ICONS[channel.platform] || ShoppingBag;
    const isSyncing = channel.status === 'SYNCING';

    const lastSyncTime = channel.lastSyncAt
        ? new Date(channel.lastSyncAt).toLocaleString('ar-SA')
        : 'لم تتم المزامنة بعد';

    return (
        <Card>
            <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-muted rounded-lg">
                            <PlatformIcon className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-semibold">{channel.channelName}</h3>
                            <p className="text-sm text-muted-foreground">{channel.platform}</p>
                        </div>
                    </div>
                    <Badge
                        variant="secondary"
                        className={`gap-1 ${statusConfig.color}`}
                    >
                        <StatusIcon className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                        {statusConfig.label}
                    </Badge>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4 text-center">
                    <div>
                        <p className="text-2xl font-bold">{channel.ordersImported}</p>
                        <p className="text-xs text-muted-foreground">طلبات مستوردة</p>
                    </div>
                    <div>
                        <p className="text-2xl font-bold">{channel.pendingOrders}</p>
                        <p className="text-xs text-muted-foreground">قيد الانتظار</p>
                    </div>
                    <div>
                        <p className={`text-2xl font-bold ${channel.errorCount > 0 ? 'text-red-600' : ''}`}>
                            {channel.errorCount}
                        </p>
                        <p className="text-xs text-muted-foreground">أخطاء</p>
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                        آخر مزامنة: {lastSyncTime}
                    </p>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={onSync}
                        disabled={isSyncing}
                        className="gap-1"
                    >
                        <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                        مزامنة
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

// ============================================================
// SYNC HISTORY TABLE
// ============================================================

function SyncHistoryTable() {
    const { syncHistory, getSyncHistory, isLoading } = useOrderSync();

    useEffect(() => {
        getSyncHistory();
    }, [getSyncHistory]);

    if (isLoading) {
        return (
            <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
            </div>
        );
    }

    if (syncHistory.length === 0) {
        return (
            <div className="text-center py-8 text-muted-foreground">
                لا يوجد سجل مزامنة
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full">
                <thead className="bg-muted text-sm">
                    <tr>
                        <th className="text-right p-3">القناة</th>
                        <th className="text-right p-3">بدأت</th>
                        <th className="text-right p-3">المدة</th>
                        <th className="text-right p-3">مستوردة</th>
                        <th className="text-right p-3">فاشلة</th>
                        <th className="text-center p-3">الحالة</th>
                    </tr>
                </thead>
                <tbody>
                    {syncHistory.map((item) => (
                        <tr key={item.id} className="border-t">
                            <td className="p-3">{item.channelName}</td>
                            <td className="p-3 text-sm">
                                {new Date(item.startedAt).toLocaleString('ar-SA')}
                            </td>
                            <td className="p-3 text-sm">
                                {item.duration ? `${item.duration}ث` : '-'}
                            </td>
                            <td className="p-3">{item.ordersImported}</td>
                            <td className="p-3 text-red-600">{item.ordersFailed}</td>
                            <td className="p-3 text-center">
                                <Badge
                                    variant="secondary"
                                    className={
                                        item.status === 'SUCCESS' ? 'bg-green-100 text-green-800' :
                                            item.status === 'PARTIAL' ? 'bg-yellow-100 text-yellow-800' :
                                                item.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                                                    'bg-blue-100 text-blue-800'
                                    }
                                >
                                    {item.status === 'SUCCESS' ? 'نجاح' :
                                        item.status === 'PARTIAL' ? 'جزئي' :
                                            item.status === 'FAILED' ? 'فشل' : 'جاري'}
                                </Badge>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ============================================================
// SYNC ERROR LIST
// ============================================================

function SyncErrorList() {
    const { syncErrors, getSyncErrors, resolveError, isLoading } = useOrderSync();

    useEffect(() => {
        getSyncErrors();
    }, [getSyncErrors]);

    const unresolvedErrors = syncErrors.filter(e => !e.resolved);

    if (isLoading) {
        return (
            <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
            </div>
        );
    }

    if (unresolvedErrors.length === 0) {
        return (
            <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-green-500" />
                لا توجد أخطاء
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {unresolvedErrors.map((error) => (
                <div key={error.id} className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="font-medium text-red-800 dark:text-red-300">
                                {error.orderNumber ? `طلب #${error.orderNumber}` : 'خطأ مزامنة'}
                            </p>
                            <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                                {error.message}
                            </p>
                            <p className="text-xs text-muted-foreground mt-2">
                                {new Date(error.createdAt).toLocaleString('ar-SA')}
                            </p>
                        </div>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => resolveError(error.id)}
                        >
                            تم الحل
                        </Button>
                    </div>
                </div>
            ))}
        </div>
    );
}

// ============================================================
// MAIN DASHBOARD
// ============================================================

export function SyncDashboard() {
    const {
        channelStatuses,
        isLoading,
        getChannelStatuses,
        triggerSync,
        triggerSyncAll,
    } = useOrderSync(true, 30000); // Auto-refresh every 30s

    useEffect(() => {
        getChannelStatuses();
    }, [getChannelStatuses]);

    const hasSyncing = channelStatuses.some(c => c.status === 'SYNCING');

    return (
        <div className="space-y-6 p-6" dir="rtl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">مزامنة الطلبات</h1>
                    <p className="text-muted-foreground">إدارة مزامنة الطلبات من قنوات البيع</p>
                </div>
                <Button
                    onClick={triggerSyncAll}
                    disabled={hasSyncing}
                    className="gap-2"
                >
                    <RefreshCw className={`w-4 h-4 ${hasSyncing ? 'animate-spin' : ''}`} />
                    مزامنة الكل
                </Button>
            </div>

            {/* Channel Cards */}
            {isLoading && channelStatuses.length === 0 ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin" />
                </div>
            ) : channelStatuses.length === 0 ? (
                <Card>
                    <CardContent className="p-8 text-center">
                        <Store className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-muted-foreground">لم تربط أي قنوات بيع بعد</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {channelStatuses.map((channel) => (
                        <ChannelSyncCard
                            key={channel.channelId}
                            channel={channel}
                            onSync={() => triggerSync(channel.channelId)}
                        />
                    ))}
                </div>
            )}

            {/* Tabs for History & Errors */}
            <Tabs defaultValue="history" dir="rtl">
                <TabsList>
                    <TabsTrigger value="history">سجل المزامنة</TabsTrigger>
                    <TabsTrigger value="errors">الأخطاء</TabsTrigger>
                </TabsList>
                <TabsContent value="history">
                    <Card>
                        <CardHeader>
                            <CardTitle>سجل المزامنة</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <SyncHistoryTable />
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="errors">
                    <Card>
                        <CardHeader>
                            <CardTitle>أخطاء المزامنة</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <SyncErrorList />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
