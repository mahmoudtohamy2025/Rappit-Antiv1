/**
 * Shipping Account List Component
 * Display and manage connected shipping carriers
 * 
 * Part of: GAP-21 Shipping Carrier Connect
 */

import { useEffect, useState } from 'react';
import {
    Truck,
    Plus,
    Trash2,
    CheckCircle2,
    AlertTriangle,
    Loader2,
    Star,
    MoreHorizontal,
    Zap,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../UI/card';
import { Button } from '../../UI/button';
import { Badge } from '../../UI/badge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from '../../UI/dropdown-menu';
import {
    useShippingAccounts,
    ShippingAccount,
    ShippingAccountStatus,
    CARRIER_CONFIG,
} from '../../../hooks/useShippingAccounts';

interface ShippingAccountListProps {
    onConnectNew?: () => void;
}

const STATUS_CONFIG: Record<ShippingAccountStatus, { label: string; icon: any; color: string }> = {
    CONNECTED: { label: 'متصل', icon: CheckCircle2, color: 'text-green-600' },
    ERROR: { label: 'خطأ', icon: AlertTriangle, color: 'text-red-600' },
    DISCONNECTED: { label: 'غير متصل', icon: AlertTriangle, color: 'text-gray-600' },
};

export function ShippingAccountList({ onConnectNew }: ShippingAccountListProps) {
    const {
        accounts,
        isLoading,
        getAccounts,
        disconnectAccount,
        setDefaultAccount,
        testConnection,
    } = useShippingAccounts();

    const [testingId, setTestingId] = useState<string | null>(null);

    useEffect(() => {
        getAccounts();
    }, [getAccounts]);

    const handleDisconnect = async (accountId: string) => {
        if (confirm('هل تريد إلغاء ربط هذا الحساب؟')) {
            try {
                await disconnectAccount(accountId);
            } catch (err) {
                console.error('Failed to disconnect:', err);
            }
        }
    };

    const handleSetDefault = async (accountId: string) => {
        try {
            await setDefaultAccount(accountId);
        } catch (err) {
            console.error('Failed to set default:', err);
        }
    };

    const handleTestConnection = async (accountId: string) => {
        setTestingId(accountId);
        try {
            const success = await testConnection(accountId);
            alert(success ? 'الاتصال يعمل بشكل صحيح ✓' : 'فشل اختبار الاتصال');
        } catch (err) {
            alert('فشل اختبار الاتصال');
        } finally {
            setTestingId(null);
        }
    };

    return (
        <Card dir="rtl">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <Truck className="w-5 h-5" />
                        حسابات الشحن
                    </CardTitle>
                    {onConnectNew && (
                        <Button onClick={onConnectNew} size="sm" className="gap-1">
                            <Plus className="w-4 h-4" />
                            ربط شركة شحن
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                ) : accounts.length === 0 ? (
                    <div className="text-center py-8">
                        <Truck className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-muted-foreground mb-4">لم تربط أي شركات شحن بعد</p>
                        {onConnectNew && (
                            <Button onClick={onConnectNew}>ربط شركة الآن</Button>
                        )}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {accounts.map((account) => {
                            const carrierConfig = CARRIER_CONFIG[account.carrier];
                            const statusConfig = STATUS_CONFIG[account.status];
                            const StatusIcon = statusConfig.icon;
                            const isTesting = testingId === account.id;

                            return (
                                <div
                                    key={account.id}
                                    className="flex items-center justify-between p-4 bg-muted rounded-lg"
                                >
                                    <div className="flex items-center gap-4">
                                        <div
                                            className="p-3 rounded-lg text-white font-bold"
                                            style={{ backgroundColor: carrierConfig.color }}
                                        >
                                            {carrierConfig.name.slice(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-medium">{carrierConfig.nameAr}</h4>
                                                {account.isDefault && (
                                                    <Badge variant="secondary" className="gap-1 text-xs">
                                                        <Star className="w-3 h-3" />
                                                        افتراضي
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-sm text-muted-foreground">
                                                رقم الحساب: {account.accountNumber}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <Badge variant="secondary" className={`gap-1 ${statusConfig.color}`}>
                                            <StatusIcon className="w-3 h-3" />
                                            {statusConfig.label}
                                        </Badge>

                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon">
                                                    <MoreHorizontal className="w-4 h-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" dir="rtl">
                                                <DropdownMenuItem
                                                    onClick={() => handleTestConnection(account.id)}
                                                    disabled={isTesting}
                                                >
                                                    <Zap className="w-4 h-4 ml-2" />
                                                    {isTesting ? 'جاري الاختبار...' : 'اختبار الاتصال'}
                                                </DropdownMenuItem>
                                                {!account.isDefault && (
                                                    <DropdownMenuItem onClick={() => handleSetDefault(account.id)}>
                                                        <Star className="w-4 h-4 ml-2" />
                                                        تعيين كافتراضي
                                                    </DropdownMenuItem>
                                                )}
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    onClick={() => handleDisconnect(account.id)}
                                                    className="text-red-600"
                                                >
                                                    <Trash2 className="w-4 h-4 ml-2" />
                                                    إلغاء الربط
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
