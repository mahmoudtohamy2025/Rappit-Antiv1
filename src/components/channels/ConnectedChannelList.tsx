/**
 * Connected Channel List Component
 * Displays all connected sales channels
 * 
 * Part of: GAP-18 Channel OAuth Flow
 */

import { useEffect } from 'react';
import {
    ShoppingBag,
    Store,
    RefreshCw,
    Trash2,
    CheckCircle2,
    AlertTriangle,
    Loader2,
    Plus,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../UI/card';
import { Button } from '../../UI/button';
import { Badge } from '../../UI/badge';
import { useChannels, Channel, ChannelPlatform, ChannelStatus } from '../../../hooks/useChannels';

interface ConnectedChannelListProps {
    onConnectNew?: () => void;
}

// ============================================================
// CONFIG
// ============================================================

const PLATFORM_CONFIG: Record<ChannelPlatform, { name: string; icon: any; color: string }> = {
    SHOPIFY: { name: 'Shopify', icon: ShoppingBag, color: 'text-green-600' },
    WOOCOMMERCE: { name: 'WooCommerce', icon: Store, color: 'text-purple-600' },
};

const STATUS_CONFIG: Record<ChannelStatus, { label: string; color: string; icon: any }> = {
    CONNECTED: { label: 'متصل', color: 'text-green-600', icon: CheckCircle2 },
    SYNCING: { label: 'جاري المزامنة', color: 'text-blue-600', icon: RefreshCw },
    ERROR: { label: 'خطأ', color: 'text-red-600', icon: AlertTriangle },
    DISCONNECTED: { label: 'غير متصل', color: 'text-gray-600', icon: AlertTriangle },
};

// ============================================================
// COMPONENT
// ============================================================

export function ConnectedChannelList({ onConnectNew }: ConnectedChannelListProps) {
    const { channels, isLoading, getChannels, syncChannel, disconnectChannel } = useChannels();

    useEffect(() => {
        getChannels();
    }, [getChannels]);

    const handleSync = async (channelId: string) => {
        try {
            await syncChannel(channelId);
        } catch (err) {
            console.error('Sync failed:', err);
        }
    };

    const handleDisconnect = async (channelId: string) => {
        if (confirm('هل تريد فصل هذه القناة؟')) {
            try {
                await disconnectChannel(channelId);
            } catch (err) {
                console.error('Disconnect failed:', err);
            }
        }
    };

    return (
        <Card dir="rtl">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle>قنوات البيع المتصلة</CardTitle>
                    {onConnectNew && (
                        <Button onClick={onConnectNew} size="sm" className="gap-1">
                            <Plus className="w-4 h-4" />
                            ربط قناة جديدة
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                ) : channels.length === 0 ? (
                    <div className="text-center py-8">
                        <Store className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-muted-foreground mb-4">لم تربط أي قنوات بيع بعد</p>
                        {onConnectNew && (
                            <Button onClick={onConnectNew}>
                                ربط قناة الآن
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {channels.map((channel) => {
                            const platformConfig = PLATFORM_CONFIG[channel.platform];
                            const statusConfig = STATUS_CONFIG[channel.status];
                            const PlatformIcon = platformConfig.icon;
                            const StatusIcon = statusConfig.icon;

                            return (
                                <div
                                    key={channel.id}
                                    className="flex items-center justify-between p-4 bg-muted rounded-lg"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`p-2 rounded-lg bg-background ${platformConfig.color}`}>
                                            <PlatformIcon className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h4 className="font-medium">{channel.storeName}</h4>
                                            <p className="text-sm text-muted-foreground">{channel.storeUrl}</p>
                                            {channel.syncStats && (
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {channel.syncStats.productsImported} منتج • {channel.syncStats.ordersImported} طلب
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <Badge
                                            variant="secondary"
                                            className={`gap-1 ${statusConfig.color}`}
                                        >
                                            <StatusIcon className={`w-3 h-3 ${channel.status === 'SYNCING' ? 'animate-spin' : ''}`} />
                                            {statusConfig.label}
                                        </Badge>

                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleSync(channel.id)}
                                            disabled={channel.status === 'SYNCING'}
                                        >
                                            <RefreshCw className="w-4 h-4" />
                                        </Button>

                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDisconnect(channel.id)}
                                            className="text-destructive"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
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
