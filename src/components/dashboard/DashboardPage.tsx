/**
 * Dashboard Page Component
 * Main analytics dashboard with charts and metrics
 * 
 * Part of: GAP-12 Dashboard Analytics
 */

import { useEffect } from 'react';
import {
    TrendingUp,
    TrendingDown,
    DollarSign,
    ShoppingCart,
    Package,
    AlertTriangle,
    Loader2,
    RefreshCw,
    BarChart3,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../UI/card';
import { Button } from '../../UI/button';
import { Badge } from '../../UI/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../UI/select';
import {
    useDashboardAnalytics,
    DateRange,
    DashboardMetrics,
    OrderStats,
    TopProduct,
    ChannelRevenue,
} from '../../../hooks/useDashboardAnalytics';

// ============================================================
// METRIC CARD
// ============================================================

interface MetricCardProps {
    title: string;
    value: string | number;
    change?: number;
    icon: any;
    color: string;
    suffix?: string;
}

function MetricCard({ title, value, change, icon: Icon, color, suffix }: MetricCardProps) {
    const isPositive = change !== undefined && change >= 0;

    return (
        <Card>
            <CardContent className="p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm text-muted-foreground">{title}</p>
                        <p className="text-2xl font-bold mt-1">
                            {typeof value === 'number' ? value.toLocaleString('ar-SA') : value}
                            {suffix && <span className="text-lg font-normal text-muted-foreground mr-1">{suffix}</span>}
                        </p>
                        {change !== undefined && (
                            <div className={`flex items-center gap-1 text-xs mt-1 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                {Math.abs(change)}%
                            </div>
                        )}
                    </div>
                    <div className={`p-3 rounded-full ${color}`}>
                        <Icon className="w-6 h-6 text-white" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

// ============================================================
// ORDER STATS CARD
// ============================================================

function OrderStatsCard({ stats }: { stats: OrderStats }) {
    const total = stats.pending + stats.processing + stats.shipped + stats.delivered;
    const statusConfig = [
        { key: 'pending', label: 'قيد الانتظار', color: 'bg-yellow-500' },
        { key: 'processing', label: 'قيد المعالجة', color: 'bg-blue-500' },
        { key: 'shipped', label: 'تم الشحن', color: 'bg-purple-500' },
        { key: 'delivered', label: 'تم التسليم', color: 'bg-green-500' },
    ];

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                    <ShoppingCart className="w-5 h-5" />
                    حالة الطلبات
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {statusConfig.map(({ key, label, color }) => {
                        const count = stats[key as keyof OrderStats];
                        const percent = total > 0 ? Math.round((count / total) * 100) : 0;

                        return (
                            <div key={key}>
                                <div className="flex justify-between text-sm mb-1">
                                    <span>{label}</span>
                                    <span className="text-muted-foreground">{count} ({percent}%)</span>
                                </div>
                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                    <div className={`h-full ${color}`} style={{ width: `${percent}%` }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}

// ============================================================
// TOP PRODUCTS TABLE
// ============================================================

function TopProductsTable({ products }: { products: TopProduct[] }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Package className="w-5 h-5" />
                    المنتجات الأكثر مبيعاً
                </CardTitle>
            </CardHeader>
            <CardContent>
                {products.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">لا توجد بيانات</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="text-sm text-muted-foreground">
                                <tr>
                                    <th className="text-right pb-2">المنتج</th>
                                    <th className="text-right pb-2">المبيعات</th>
                                    <th className="text-right pb-2">الإيراد</th>
                                    <th className="text-right pb-2">المخزون</th>
                                </tr>
                            </thead>
                            <tbody>
                                {products.slice(0, 5).map((product, index) => (
                                    <tr key={product.id} className="border-t">
                                        <td className="py-2">
                                            <div className="flex items-center gap-2">
                                                <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs">
                                                    {index + 1}
                                                </span>
                                                <span className="font-medium">{product.name}</span>
                                            </div>
                                        </td>
                                        <td className="py-2">{product.unitsSold}</td>
                                        <td className="py-2">{product.revenue.toLocaleString()} ر.س</td>
                                        <td className="py-2">
                                            <Badge variant={product.stock < 10 ? 'destructive' : 'secondary'}>
                                                {product.stock}
                                            </Badge>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// ============================================================
// CHANNEL PERFORMANCE
// ============================================================

function ChannelPerformanceCard({ channels }: { channels: ChannelRevenue[] }) {
    const colors = ['bg-green-500', 'bg-purple-500', 'bg-blue-500', 'bg-orange-500'];

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                    <BarChart3 className="w-5 h-5" />
                    أداء القنوات
                </CardTitle>
            </CardHeader>
            <CardContent>
                {channels.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">لا توجد قنوات مرتبطة</p>
                ) : (
                    <div className="space-y-4">
                        {channels.map((channel, index) => (
                            <div key={channel.channel}>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="font-medium">{channel.channelName}</span>
                                    <span>{channel.revenue.toLocaleString()} ر.س ({channel.percentage}%)</span>
                                </div>
                                <div className="h-3 bg-muted rounded-full overflow-hidden">
                                    <div
                                        className={`h-full ${colors[index % colors.length]}`}
                                        style={{ width: `${channel.percentage}%` }}
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">{channel.orders} طلب</p>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// ============================================================
// MAIN DASHBOARD
// ============================================================

const DATE_RANGE_OPTIONS: { value: DateRange; label: string }[] = [
    { value: '7d', label: 'آخر 7 أيام' },
    { value: '30d', label: 'آخر 30 يوم' },
    { value: '90d', label: 'آخر 90 يوم' },
    { value: '12m', label: 'آخر 12 شهر' },
];

export function DashboardPage() {
    const {
        metrics,
        orderStats,
        topProducts,
        channelRevenue,
        isLoading,
        error,
        dateRange,
        setDateRange,
        refreshAll,
    } = useDashboardAnalytics();

    useEffect(() => {
        refreshAll();
    }, [refreshAll]);

    if (error) {
        return (
            <div className="p-8 text-center" dir="rtl">
                <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-red-500" />
                <h2 className="text-xl font-bold mb-2">خطأ في التحميل</h2>
                <p className="text-muted-foreground">{error.message}</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 p-6" dir="rtl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">لوحة التحكم</h1>
                    <p className="text-muted-foreground">نظرة عامة على أداء عملك</p>
                </div>
                <div className="flex items-center gap-2">
                    <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
                        <SelectTrigger className="w-40">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {DATE_RANGE_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button variant="outline" onClick={refreshAll} disabled={isLoading}>
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>

            {/* Loading or Metrics */}
            {isLoading && !metrics ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin" />
                </div>
            ) : metrics ? (
                <>
                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <MetricCard
                            title="إجمالي الإيرادات"
                            value={metrics.totalRevenue}
                            change={metrics.revenueChange}
                            icon={DollarSign}
                            color="bg-green-500"
                            suffix="ر.س"
                        />
                        <MetricCard
                            title="عدد الطلبات"
                            value={metrics.orderCount}
                            change={metrics.orderCountChange}
                            icon={ShoppingCart}
                            color="bg-blue-500"
                        />
                        <MetricCard
                            title="معدل التنفيذ"
                            value={`${metrics.fulfillmentRate}%`}
                            icon={Package}
                            color="bg-purple-500"
                        />
                        <MetricCard
                            title="منتجات منخفضة المخزون"
                            value={metrics.lowStockItems}
                            icon={AlertTriangle}
                            color={metrics.lowStockItems > 10 ? 'bg-red-500' : 'bg-orange-500'}
                        />
                    </div>

                    {/* Charts Row */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {orderStats && <OrderStatsCard stats={orderStats} />}
                        <ChannelPerformanceCard channels={channelRevenue} />
                    </div>

                    {/* Top Products */}
                    <TopProductsTable products={topProducts} />
                </>
            ) : null}
        </div>
    );
}
