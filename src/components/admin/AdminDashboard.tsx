/**
 * Admin Dashboard Component
 * Main platform admin dashboard
 * 
 * Part of: GAP-14 Admin Platform Dashboard
 */

import { useEffect } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { PlatformStatsCards } from './PlatformStatsCards';
import { OrganizationList } from './OrganizationList';
import { useAdmin, SubscriptionStatus } from '../../hooks/useAdmin';

interface AdminDashboardProps {
    onViewOrganization?: (id: string) => void;
}

export function AdminDashboard({ onViewOrganization }: AdminDashboardProps) {
    const {
        stats,
        organizations,
        isLoading,
        error,
        getStats,
        getOrganizations,
        activateOrganization,
        deactivateOrganization,
    } = useAdmin();

    useEffect(() => {
        getStats();
        getOrganizations();
    }, [getStats, getOrganizations]);

    const handleFilterChange = (status?: SubscriptionStatus, search?: string) => {
        getOrganizations({ status, search });
    };

    const handleViewDetails = (id: string) => {
        if (onViewOrganization) {
            onViewOrganization(id);
        } else {
            // Navigate to detail page
            window.location.href = `/admin/organizations/${id}`;
        }
    };

    if (error) {
        return (
            <div className="p-8 text-center" dir="rtl">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
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
                    <h1 className="text-2xl font-bold">لوحة تحكم المنصة</h1>
                    <p className="text-muted-foreground">إدارة المنظمات والاشتراكات</p>
                </div>
            </div>

            {/* Stats Cards */}
            {stats ? (
                <PlatformStatsCards stats={stats} isLoading={isLoading} />
            ) : isLoading ? (
                <div className="flex justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin" />
                </div>
            ) : null}

            {/* Organization List */}
            <OrganizationList
                organizations={organizations}
                onViewDetails={handleViewDetails}
                onActivate={activateOrganization}
                onDeactivate={deactivateOrganization}
                onFilterChange={handleFilterChange}
                isLoading={isLoading}
            />
        </div>
    );
}
