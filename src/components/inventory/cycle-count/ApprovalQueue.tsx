/**
 * Approval Queue Component
 * Queue of cycle count items needing approval
 * 
 * Part of: UI-INV-03 (Backend: cycle-count.service.ts)
 */

import { 
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Package
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../UI/card';
import { Button } from '../../UI/button';
import { Badge } from '../../UI/badge';

interface ApprovalItem {
  id: string;
  cycleCountId: string;
  cycleCountName: string;
  sku: string;
  productName: string;
  systemQty: number;
  countedQty: number;
  variance: number;
  variancePercent: number;
  countedBy: string;
  countedAt: string;
}

interface ApprovalQueueProps {
  items: ApprovalItem[];
  onApprove: (itemId: string) => void;
  onReject: (itemId: string) => void;
  onApproveAll: () => void;
}

export function ApprovalQueue({ items, onApprove, onReject, onApproveAll }: ApprovalQueueProps) {
  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-green-500 opacity-50" />
          <p className="text-lg mb-2">لا توجد عناصر تنتظر الموافقة</p>
          <p className="text-sm">جميع فروقات الجرد تمت الموافقة عليها</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-yellow-500" />
          <span className="font-medium">{items.length} عناصر تنتظر الموافقة</span>
        </div>
        <Button onClick={onApproveAll} size="sm">
          الموافقة على الكل
        </Button>
      </div>

      {/* Items */}
      <div className="space-y-3">
        {items.map((item) => (
          <Card key={item.id} className="border-yellow-200 dark:border-yellow-800">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                {/* Item Info */}
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                    <Package className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium">{item.productName}</p>
                    <p className="text-sm text-muted-foreground font-mono">{item.sku}</p>
                    <p className="text-xs text-muted-foreground">
                      جرد: {item.cycleCountName} • بواسطة: {item.countedBy}
                    </p>
                  </div>
                </div>

                {/* Variance */}
                <div className="flex items-center gap-4">
                  <div className="text-left">
                    <p className="text-sm text-muted-foreground">
                      {item.systemQty} → {item.countedQty}
                    </p>
                    <Badge className={`${
                      item.variance > 0 
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' 
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                    } border-0`}>
                      {item.variance > 0 ? '+' : ''}{item.variance} ({item.variancePercent.toFixed(1)}%)
                    </Badge>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => onReject(item.id)}
                      className="h-9 w-9 text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <XCircle className="w-5 h-5" />
                    </Button>
                    <Button
                      size="icon"
                      onClick={() => onApprove(item.id)}
                      className="h-9 w-9 bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle2 className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
