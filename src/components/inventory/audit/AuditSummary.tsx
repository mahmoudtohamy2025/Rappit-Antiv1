/**
 * Audit Summary Component
 * Stats cards for audit trail
 * 
 * Part of: UI-INV-07 (Backend: inventory-audit.service.ts)
 */

import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent } from '../../UI/card';

interface AuditSummaryProps {
    totalChanges: number;
    netVariance: number;
    positiveChanges: number;
    negativeChanges: number;
}

export function AuditSummary({
    totalChanges,
    netVariance,
    positiveChanges,
    negativeChanges
}: AuditSummaryProps) {
    return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card>
                <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">إجمالي التغييرات</p>
                    <p className="text-2xl font-bold">{totalChanges}</p>
                </CardContent>
            </Card>
            <Card>
                <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">صافي الفرق</p>
                    <p className={`text-2xl font-bold ${netVariance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {netVariance >= 0 ? '+' : ''}{netVariance}
                    </p>
                </CardContent>
            </Card>
            <Card>
                <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <TrendingUp className="w-4 h-4 text-green-500" />
                        زيادات
                    </p>
                    <p className="text-2xl font-bold text-green-600">{positiveChanges}</p>
                </CardContent>
            </Card>
            <Card>
                <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <TrendingDown className="w-4 h-4 text-red-500" />
                        نقصان
                    </p>
                    <p className="text-2xl font-bold text-red-600">{negativeChanges}</p>
                </CardContent>
            </Card>
        </div>
    );
}
