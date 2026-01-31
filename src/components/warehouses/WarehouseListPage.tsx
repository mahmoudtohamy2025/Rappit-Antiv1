/**
 * Warehouse List Page
 * GAP-01: Warehouse CRUD Frontend
 * 
 * Main page for viewing and managing warehouses
 * Design System: RTL Arabic, dark mode, mobile responsive
 */

import { useState, useEffect } from 'react';
import {
    Warehouse as WarehouseIcon,
    Plus,
    Search,
    RefreshCw,
    Star,
    MapPin,
    Package,
    AlertTriangle,
    MoreHorizontal,
    Edit,
    Trash2,
    Settings,
} from 'lucide-react';
import { Button } from '../UI/button';
import { Card, CardContent, CardHeader, CardTitle } from '../UI/card';
import { Badge } from '../UI/badge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from '../UI/dropdown-menu';
import { useWarehouses, Warehouse } from '../../hooks/useWarehouses';
import { WarehouseFormModal } from './WarehouseFormModal';

export function WarehouseListPage() {
    const {
        warehouses,
        meta,
        isLoading,
        error,
        fetch,
        create,
        update,
        remove,
        setDefault,
        getStats,
    } = useWarehouses();

    const [searchQuery, setSearchQuery] = useState('');
    const [showActiveOnly, setShowActiveOnly] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
    const [warehouseStats, setWarehouseStats] = useState<Record<string, any>>({});

    useEffect(() => {
        fetch({ isActive: showActiveOnly, search: searchQuery || undefined });
    }, [showActiveOnly, searchQuery]);

    // Load stats for each warehouse
    useEffect(() => {
        warehouses.forEach(async (wh) => {
            if (!warehouseStats[wh.id]) {
                try {
                    const stats = await getStats(wh.id);
                    setWarehouseStats(prev => ({ ...prev, [wh.id]: stats }));
                } catch {
                    // Ignore errors for stats
                }
            }
        });
    }, [warehouses]);

    const handleCreate = async (data: any) => {
        await create(data);
        setIsCreateModalOpen(false);
    };

    const handleUpdate = async (data: any) => {
        if (editingWarehouse) {
            await update(editingWarehouse.id, data);
            setEditingWarehouse(null);
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm('هل أنت متأكد من حذف هذا المستودع؟')) {
            await remove(id);
        }
    };

    const handleSetDefault = async (id: string) => {
        await setDefault(id);
        fetch({ isActive: showActiveOnly });
    };

    return (
        <div className="space-y-6" dir="rtl">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-semibold flex items-center gap-2">
                        <WarehouseIcon className="w-8 h-8" />
                        المستودعات
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        إدارة مستودعات المخزون
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={() => fetch({ isActive: showActiveOnly })}
                        className="gap-2"
                    >
                        <RefreshCw className="w-4 h-4" />
                        <span className="hidden sm:inline">تحديث</span>
                    </Button>
                    <Button onClick={() => setIsCreateModalOpen(true)} className="gap-2">
                        <Plus className="w-4 h-4" />
                        إضافة مستودع
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">إجمالي المستودعات</p>
                        <p className="text-2xl font-bold">{meta?.total || 0}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">نشط</p>
                        <p className="text-2xl font-bold text-green-600">
                            {warehouses.filter(w => w.isActive).length}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">إجمالي المنتجات</p>
                        <p className="text-2xl font-bold">
                            {Object.values(warehouseStats).reduce((sum: number, s: any) => sum + (s?.totalItems || 0), 0)}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <AlertTriangle className="w-4 h-4 text-orange-500" />
                            منخفض المخزون
                        </p>
                        <p className="text-2xl font-bold text-orange-600">
                            {Object.values(warehouseStats).reduce((sum: number, s: any) => sum + (s?.lowStockItems || 0), 0)}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="بحث بالاسم أو الكود..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pr-10 pl-4 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                </div>
                <div className="flex gap-2">
                    <Button
                        variant={showActiveOnly ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setShowActiveOnly(true)}
                    >
                        نشط
                    </Button>
                    <Button
                        variant={!showActiveOnly ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setShowActiveOnly(false)}
                    >
                        الكل
                    </Button>
                </div>
            </div>

            {/* Warehouse Grid */}
            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => (
                        <Card key={i} className="animate-pulse">
                            <CardContent className="p-6">
                                <div className="h-6 bg-muted rounded w-3/4 mb-4"></div>
                                <div className="h-4 bg-muted rounded w-1/2"></div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : error ? (
                <Card className="border-red-200 dark:border-red-800">
                    <CardContent className="p-6 text-center text-red-600">
                        <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
                        <p>حدث خطأ أثناء تحميل المستودعات</p>
                        <Button variant="outline" onClick={() => fetch({})} className="mt-2">
                            إعادة المحاولة
                        </Button>
                    </CardContent>
                </Card>
            ) : warehouses.length === 0 ? (
                <Card>
                    <CardContent className="p-12 text-center text-muted-foreground">
                        <WarehouseIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p className="text-lg">لا توجد مستودعات</p>
                        <p className="text-sm">ابدأ بإضافة مستودع جديد</p>
                        <Button onClick={() => setIsCreateModalOpen(true)} className="mt-4">
                            <Plus className="w-4 h-4 mr-2" />
                            إضافة مستودع
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {warehouses.map((warehouse) => {
                        const stats = warehouseStats[warehouse.id];

                        return (
                            <Card
                                key={warehouse.id}
                                className={`hover:shadow-md transition-shadow ${warehouse.isDefault ? 'ring-2 ring-primary' : ''
                                    }`}
                            >
                                <CardHeader className="pb-2">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <CardTitle className="flex items-center gap-2">
                                                {warehouse.name}
                                                {warehouse.isDefault && (
                                                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                                )}
                                            </CardTitle>
                                            <p className="text-sm text-muted-foreground font-mono">
                                                {warehouse.code}
                                            </p>
                                        </div>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                    <MoreHorizontal className="w-4 h-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => setEditingWarehouse(warehouse)}>
                                                    <Edit className="w-4 h-4 ml-2" />
                                                    تعديل
                                                </DropdownMenuItem>
                                                {!warehouse.isDefault && (
                                                    <DropdownMenuItem onClick={() => handleSetDefault(warehouse.id)}>
                                                        <Star className="w-4 h-4 ml-2" />
                                                        تعيين كافتراضي
                                                    </DropdownMenuItem>
                                                )}
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    onClick={() => handleDelete(warehouse.id)}
                                                    className="text-red-600"
                                                >
                                                    <Trash2 className="w-4 h-4 ml-2" />
                                                    حذف
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {/* Address */}
                                    {warehouse.address && (
                                        <div className="flex items-start gap-2 text-sm text-muted-foreground mb-3">
                                            <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                                            <span>
                                                {[
                                                    warehouse.address.street,
                                                    warehouse.address.city,
                                                    warehouse.address.country,
                                                ]
                                                    .filter(Boolean)
                                                    .join('، ')}
                                            </span>
                                        </div>
                                    )}

                                    {/* Stats */}
                                    <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t">
                                        <div className="text-center">
                                            <p className="text-lg font-bold">{stats?.totalItems || 0}</p>
                                            <p className="text-xs text-muted-foreground">منتجات</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-lg font-bold">{stats?.totalQuantity || 0}</p>
                                            <p className="text-xs text-muted-foreground">متاح</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-lg font-bold text-orange-600">
                                                {stats?.reservedQuantity || 0}
                                            </p>
                                            <p className="text-xs text-muted-foreground">محجوز</p>
                                        </div>
                                    </div>

                                    {/* Status Badge */}
                                    <div className="mt-4 flex items-center justify-between">
                                        <Badge variant={warehouse.isActive ? 'default' : 'secondary'}>
                                            {warehouse.isActive ? 'نشط' : 'غير نشط'}
                                        </Badge>
                                        {stats?.lowStockItems > 0 && (
                                            <Badge variant="warning" className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border-0">
                                                <AlertTriangle className="w-3 h-3 ml-1" />
                                                {stats.lowStockItems} منخفض
                                            </Badge>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Create Modal */}
            <WarehouseFormModal
                open={isCreateModalOpen}
                onOpenChange={setIsCreateModalOpen}
                onSubmit={handleCreate}
            />

            {/* Edit Modal */}
            <WarehouseFormModal
                open={!!editingWarehouse}
                onOpenChange={(open) => !open && setEditingWarehouse(null)}
                warehouse={editingWarehouse}
                onSubmit={handleUpdate}
            />
        </div>
    );
}
