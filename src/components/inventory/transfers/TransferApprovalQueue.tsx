/**
 * Transfer Approval Queue Component
 * Queue of transfer requests needing approval
 * 
 * Part of: UI-INV-06 (Backend: transfer-reservation.service.ts - 89 tests)
 */

import {
    CheckCircle2,
    XCircle,
    ArrowLeftRight,
    Clock,
    AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../UI/card';
import { Button } from '../../UI/button';
import { Badge } from '../../UI/badge';

interface TransferRequest {
    id: string;
    sourceWarehouse: string;
    targetWarehouse: string;
    sku: string;
    productName: string;
    quantity: number;
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
    reason: string;
    requestedBy: string;
    requestedAt: string;
}

interface TransferApprovalQueueProps {
    requests: TransferRequest[];
    onApprove: (id: string) => void;
    onReject: (id: string) => void;
    onApproveAll: () => void;
}

const PRIORITY_CONFIG = {
    LOW: { label: 'عادي', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-300' },
    NORMAL: { label: 'متوسط', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
    HIGH: { label: 'عالي', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
    URGENT: { label: 'عاجل', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
};

export function TransferApprovalQueue({ requests, onApprove, onReject, onApproveAll }: TransferApprovalQueueProps) {
    if (requests.length === 0) {
        return (
            <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                    <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-green-500 opacity-50" />
                    <p className="text-lg mb-2">لا توجد طلبات تنتظر الموافقة</p>
                    <p className="text-sm">جميع طلبات التحويل تمت معالجتها</p>
                </CardContent>
            </Card>
        );
    }

    // Sort by priority
    const sortedRequests = [...requests].sort((a, b) => {
        const priorityOrder = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-yellow-500" />
                    <span className="font-medium">{requests.length} طلبات تنتظر الموافقة</span>
                </div>
                <Button onClick={onApproveAll} size="sm">
                    الموافقة على الكل
                </Button>
            </div>

            {/* Priority Alert */}
            {requests.some(r => r.priority === 'URGENT' || r.priority === 'HIGH') && (
                <div className="flex items-center gap-2 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg text-sm">
                    <AlertCircle className="w-4 h-4 text-orange-500" />
                    <span className="text-orange-800 dark:text-orange-200">
                        يوجد طلبات ذات أولوية عالية أو عاجلة
                    </span>
                </div>
            )}

            {/* Requests */}
            <div className="space-y-3">
                {sortedRequests.map((request) => {
                    const priorityConfig = PRIORITY_CONFIG[request.priority];

                    return (
                        <Card
                            key={request.id}
                            className={
                                request.priority === 'URGENT'
                                    ? 'border-red-200 dark:border-red-800'
                                    : request.priority === 'HIGH'
                                        ? 'border-orange-200 dark:border-orange-800'
                                        : ''
                            }
                        >
                            <CardContent className="p-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    {/* Info */}
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                                            <ArrowLeftRight className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <p className="font-medium">{request.productName}</p>
                                                <Badge
                                                    variant="secondary"
                                                    className={`${priorityConfig.color} border-0`}
                                                >
                                                    {priorityConfig.label}
                                                </Badge>
                                            </div>
                                            <p className="text-sm text-muted-foreground font-mono">{request.sku}</p>
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <span>{request.sourceWarehouse}</span>
                                                <ArrowLeftRight className="w-3 h-3" />
                                                <span>{request.targetWarehouse}</span>
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                بواسطة: {request.requestedBy} • {request.requestedAt}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Quantity and Actions */}
                                    <div className="flex items-center gap-4">
                                        <div className="text-left">
                                            <p className="text-sm text-muted-foreground">الكمية</p>
                                            <p className="text-xl font-bold">{request.quantity}</p>
                                        </div>

                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                onClick={() => onReject(request.id)}
                                                className="h-9 w-9 text-red-600 hover:text-red-700 hover:bg-red-50"
                                            >
                                                <XCircle className="w-5 h-5" />
                                            </Button>
                                            <Button
                                                size="icon"
                                                onClick={() => onApprove(request.id)}
                                                className="h-9 w-9 bg-green-600 hover:bg-green-700"
                                            >
                                                <CheckCircle2 className="w-5 h-5" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
