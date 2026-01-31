/**
 * Inventory Tabs Layout
 * Main tabbed interface for Phase 4 Inventory Management
 * 
 * Best Practices Applied:
 * - Tab Order: Overview → Movements → Transfers → Cycle Count → Audit
 * - Mobile responsive with horizontal scroll on tabs
 * - Dark mode support
 * - RTL Arabic layout
 */

import { useState } from 'react';
import {
    Package,
    ArrowLeftRight,
    ClipboardCheck,
    History,
    Upload,
    RefreshCw
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../UI/tabs';
import { Button } from '../UI/button';
import { Badge } from '../UI/badge';

// Import inventory sub-components
import { InventoryOverview } from './InventoryOverview';
import { MovementPanel } from './movements/MovementPanel';
import { TransferPanel } from './transfers/TransferPanel';
import { CycleCountPanel } from './cycle-count/CycleCountPanel';
import { AuditTrailPanel } from './audit/AuditTrailPanel';
import { ImportCsvModal } from './import/ImportCsvModal';

interface InventoryTabsProps {
    pendingApprovals?: number;
}

export function InventoryTabs({ pendingApprovals = 0 }: InventoryTabsProps) {
    const [activeTab, setActiveTab] = useState('overview');
    const [importModalOpen, setImportModalOpen] = useState(false);

    return (
        <div className="space-y-6" dir="rtl">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl mb-2">إدارة المخزون</h1>
                    <p className="text-muted-foreground">
                        إدارة شاملة للمخزون والحركات والتحويلات
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={() => window.location.reload()}
                        className="gap-2"
                    >
                        <RefreshCw className="w-4 h-4" />
                        <span className="hidden sm:inline">تحديث</span>
                    </Button>
                    <Button onClick={() => setImportModalOpen(true)} className="gap-2">
                        <Upload className="w-4 h-4" />
                        استيراد CSV
                    </Button>
                </div>
            </div>

            {/* Tabs */}
            <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                dir="rtl"
                className="w-full"
            >
                <TabsList className="w-full justify-start overflow-x-auto flex-nowrap">
                    <TabsTrigger value="overview" className="gap-2 min-w-fit">
                        <Package className="w-4 h-4" />
                        <span>المخزون</span>
                    </TabsTrigger>

                    <TabsTrigger value="movements" className="gap-2 min-w-fit">
                        <ArrowLeftRight className="w-4 h-4" />
                        <span>الحركات</span>
                    </TabsTrigger>

                    <TabsTrigger value="transfers" className="gap-2 min-w-fit relative">
                        <RefreshCw className="w-4 h-4" />
                        <span>التحويلات</span>
                        {pendingApprovals > 0 && (
                            <Badge
                                variant="destructive"
                                className="mr-1 h-5 w-5 p-0 text-xs justify-center"
                            >
                                {pendingApprovals}
                            </Badge>
                        )}
                    </TabsTrigger>

                    <TabsTrigger value="cycle-count" className="gap-2 min-w-fit">
                        <ClipboardCheck className="w-4 h-4" />
                        <span>الجرد</span>
                    </TabsTrigger>

                    <TabsTrigger value="audit" className="gap-2 min-w-fit">
                        <History className="w-4 h-4" />
                        <span>السجل</span>
                    </TabsTrigger>
                </TabsList>

                <div className="mt-6">
                    <TabsContent value="overview" className="m-0">
                        <InventoryOverview />
                    </TabsContent>

                    <TabsContent value="movements" className="m-0">
                        <MovementPanel />
                    </TabsContent>

                    <TabsContent value="transfers" className="m-0">
                        <TransferPanel />
                    </TabsContent>

                    <TabsContent value="cycle-count" className="m-0">
                        <CycleCountPanel />
                    </TabsContent>

                    <TabsContent value="audit" className="m-0">
                        <AuditTrailPanel />
                    </TabsContent>
                </div>
            </Tabs>

            {/* Import CSV Modal */}
            <ImportCsvModal
                open={importModalOpen}
                onOpenChange={setImportModalOpen}
            />
        </div>
    );
}
