/**
 * Organization List Component
 * Table of all organizations on the platform
 * 
 * Part of: GAP-14 Admin Platform Dashboard
 */

import { useState } from 'react';
import {
    Building2,
    Search,
    MoreHorizontal,
    Eye,
    Power,
    PowerOff,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../UI/card';
import { Button } from '../../UI/button';
import { Input } from '../../UI/input';
import { Badge } from '../../UI/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../UI/select';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '../../UI/dropdown-menu';
import { AdminOrganization, SubscriptionStatus } from '../../../hooks/useAdmin';

interface OrganizationListProps {
    organizations: AdminOrganization[];
    onViewDetails: (id: string) => void;
    onActivate: (id: string) => Promise<void>;
    onDeactivate: (id: string) => Promise<void>;
    onFilterChange: (status?: SubscriptionStatus, search?: string) => void;
    isLoading?: boolean;
}

const STATUS_CONFIG: Record<SubscriptionStatus, { label: string; color: string }> = {
    TRIAL: { label: 'تجريبي', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' },
    ACTIVE: { label: 'نشط', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
    PAST_DUE: { label: 'متأخر', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
    CANCELLED: { label: 'ملغي', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300' },
    EXPIRED: { label: 'منتهي', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' },
};

export function OrganizationList({
    organizations,
    onViewDetails,
    onActivate,
    onDeactivate,
    onFilterChange,
    isLoading,
}: OrganizationListProps) {
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    const handleSearch = (value: string) => {
        setSearch(value);
        onFilterChange(
            statusFilter === 'all' ? undefined : statusFilter as SubscriptionStatus,
            value || undefined
        );
    };

    const handleStatusFilter = (value: string) => {
        setStatusFilter(value);
        onFilterChange(
            value === 'all' ? undefined : value as SubscriptionStatus,
            search || undefined
        );
    };

    return (
        <Card dir="rtl">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <Building2 className="w-5 h-5" />
                        المنظمات
                    </CardTitle>
                    <div className="flex gap-2">
                        <div className="relative w-64">
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="بحث..."
                                value={search}
                                onChange={(e) => handleSearch(e.target.value)}
                                className="pr-9"
                            />
                        </div>
                        <Select value={statusFilter} onValueChange={handleStatusFilter}>
                            <SelectTrigger className="w-32">
                                <SelectValue placeholder="الحالة" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">الكل</SelectItem>
                                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                                    <SelectItem key={key} value={key}>
                                        {config.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="animate-pulse h-16 bg-muted rounded" />
                        ))}
                    </div>
                ) : organizations.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        لا توجد منظمات
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-muted text-sm">
                                <tr>
                                    <th className="text-right p-3">المنظمة</th>
                                    <th className="text-right p-3">الحالة</th>
                                    <th className="text-right p-3">الخطة</th>
                                    <th className="text-right p-3">المستخدمين</th>
                                    <th className="text-right p-3">الطلبات</th>
                                    <th className="text-right p-3">التاريخ</th>
                                    <th className="text-center p-3">إجراءات</th>
                                </tr>
                            </thead>
                            <tbody>
                                {organizations.map((org) => {
                                    const statusConfig = STATUS_CONFIG[org.subscriptionStatus];

                                    return (
                                        <tr key={org.id} className="border-t hover:bg-muted/50">
                                            <td className="p-3">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-2 h-2 rounded-full ${org.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                                                    <span className="font-medium">{org.name}</span>
                                                </div>
                                            </td>
                                            <td className="p-3">
                                                <Badge variant="secondary" className={`${statusConfig.color} border-0`}>
                                                    {statusConfig.label}
                                                </Badge>
                                            </td>
                                            <td className="p-3">{org.currentPlan}</td>
                                            <td className="p-3">{org.userCount}</td>
                                            <td className="p-3">{org.orderCount}</td>
                                            <td className="p-3 text-sm text-muted-foreground">
                                                {new Date(org.createdAt).toLocaleDateString('ar-SA')}
                                            </td>
                                            <td className="p-3 text-center">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon">
                                                            <MoreHorizontal className="w-4 h-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" dir="rtl">
                                                        <DropdownMenuItem onClick={() => onViewDetails(org.id)}>
                                                            <Eye className="w-4 h-4 ml-2" />
                                                            عرض التفاصيل
                                                        </DropdownMenuItem>
                                                        {org.isActive ? (
                                                            <DropdownMenuItem
                                                                onClick={() => onDeactivate(org.id)}
                                                                className="text-red-600"
                                                            >
                                                                <PowerOff className="w-4 h-4 ml-2" />
                                                                تعطيل
                                                            </DropdownMenuItem>
                                                        ) : (
                                                            <DropdownMenuItem
                                                                onClick={() => onActivate(org.id)}
                                                                className="text-green-600"
                                                            >
                                                                <Power className="w-4 h-4 ml-2" />
                                                                تفعيل
                                                            </DropdownMenuItem>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
