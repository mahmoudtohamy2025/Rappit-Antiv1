/**
 * Platform Stats Cards Component
 * Displays key platform metrics
 * 
 * Part of: GAP-14 Admin Platform Dashboard
 */

import {
    Building2,
    Users,
    DollarSign,
    TrendingUp,
    Clock,
    AlertTriangle,
} from 'lucide-react';
import { Card, CardContent } from '../../UI/card';
import { PlatformStats } from '../../../hooks/useAdmin';

interface PlatformStatsCardsProps {
    stats: PlatformStats;
    isLoading?: boolean;
}

interface StatCardProps {
    title: string;
    value: number | string;
    icon: any;
    color: string;
    bgColor: string;
    suffix?: string;
    trend?: string;
}

function StatCard({ title, value, icon: Icon, color, bgColor, suffix, trend }: StatCardProps) {
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
                        {trend && (
                            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                                <TrendingUp className="w-3 h-3" />
                                {trend}
                            </p>
                        )}
                    </div>
                    <div className={`p-3 rounded-full ${bgColor}`}>
                        <Icon className={`w-6 h-6 ${color}`} />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

export function PlatformStatsCards({ stats, isLoading }: PlatformStatsCardsProps) {
    if (isLoading) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                    <Card key={i}>
                        <CardContent className="p-6">
                            <div className="animate-pulse">
                                <div className="h-4 bg-muted rounded w-24 mb-2" />
                                <div className="h-8 bg-muted rounded w-16" />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" dir="rtl">
            <StatCard
                title="إجمالي المنظمات"
                value={stats.totalOrganizations}
                icon={Building2}
                color="text-blue-600"
                bgColor="bg-blue-100 dark:bg-blue-900/30"
                trend={`+${stats.newSignupsThisMonth} هذا الشهر`}
            />
            <StatCard
                title="الاشتراكات النشطة"
                value={stats.activeOrganizations}
                icon={TrendingUp}
                color="text-green-600"
                bgColor="bg-green-100 dark:bg-green-900/30"
            />
            <StatCard
                title="الإيراد الشهري (MRR)"
                value={stats.mrr.toLocaleString('ar-SA')}
                icon={DollarSign}
                color="text-emerald-600"
                bgColor="bg-emerald-100 dark:bg-emerald-900/30"
                suffix="ر.س"
            />
            <StatCard
                title="إجمالي المستخدمين"
                value={stats.totalUsers}
                icon={Users}
                color="text-purple-600"
                bgColor="bg-purple-100 dark:bg-purple-900/30"
            />
            <StatCard
                title="التجريبية"
                value={stats.trialOrganizations}
                icon={Clock}
                color="text-yellow-600"
                bgColor="bg-yellow-100 dark:bg-yellow-900/30"
            />
            <StatCard
                title="معدل الإلغاء"
                value={`${stats.churnRate}%`}
                icon={AlertTriangle}
                color="text-red-600"
                bgColor="bg-red-100 dark:bg-red-900/30"
            />
        </div>
    );
}
