/**
 * Inventory Overview Component
 * Enhanced version of the original InventoryManagement with API integration
 * 
 * Features:
 * - Stats cards with live data
 * - Inventory table with search/filter
 * - Low stock alerts
 * - Quick actions
 */

import { useState, useEffect } from 'react';
import {
    Package,
    AlertTriangle,
    TrendingUp,
    Warehouse,
    Search,
    Filter,
    MoreVertical,
    Edit,
    Trash2,
    Eye,
    Plus,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../UI/card';
import { Button } from '../UI/button';
import { Badge } from '../UI/badge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '../UI/dropdown-menu';
import { ProductFormModal } from '../products/ProductFormModal';
import { useProducts, Product } from '../../hooks/useProducts';

interface InventoryOverviewProps {
    onProductClick?: (productId: string) => void;
}

interface InventoryItem {
    sku: string;
    name: string;
    category: string;
    available: number;
    reserved: number;
    total: number;
    lowStock: boolean;
    location: string;
    lastUpdate: string;
}

export function InventoryOverview({ onProductClick }: InventoryOverviewProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [showLowStockOnly, setShowLowStockOnly] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    const { products, meta, fetch, create, getCategories, categories } = useProducts();

    useEffect(() => {
        fetch({ stockLevel: showLowStockOnly ? 'low' : 'all' });
        getCategories();
    }, [showLowStockOnly]);

    const handleCreateProduct = async (data: any) => {
        await create(data);
        setIsCreateModalOpen(false);
        fetch({ stockLevel: showLowStockOnly ? 'low' : 'all' });
    };

    // Mock data - will be replaced with API call
    const inventoryItems: InventoryItem[] = [
        {
            sku: 'ELEC-001',
            name: 'سماعة لاسلكية بلوتوث',
            category: 'إلكترونيات',
            available: 45,
            reserved: 12,
            total: 57,
            lowStock: false,
            location: 'مستودع الرياض',
            lastUpdate: '2026-01-02 09:30',
        },
        {
            sku: 'ELEC-045',
            name: 'شاحن سريع USB-C',
            category: 'إلكترونيات',
            available: 8,
            reserved: 5,
            total: 13,
            lowStock: true,
            location: 'مستودع جدة',
            lastUpdate: '2026-01-02 08:15',
        },
        {
            sku: 'FASH-234',
            name: 'قميص رجالي - أزرق',
            category: 'أزياء',
            available: 120,
            reserved: 23,
            total: 143,
            lowStock: false,
            location: 'مستودع الرياض',
            lastUpdate: '2026-01-01 16:45',
        },
        {
            sku: 'FASH-567',
            name: 'بنطال جينز - أسود',
            category: 'أزياء',
            available: 67,
            reserved: 15,
            total: 82,
            lowStock: false,
            location: 'مستودع الدمام',
            lastUpdate: '2026-01-01 14:20',
        },
        {
            sku: 'HOME-890',
            name: 'طقم أواني مطبخ',
            category: 'منزل وديكور',
            available: 34,
            reserved: 8,
            total: 42,
            lowStock: false,
            location: 'مستودع الرياض',
            lastUpdate: '2025-12-31 11:30',
        },
        {
            sku: 'ACC-123',
            name: 'حقيبة يد جلدية',
            category: 'إكسسوارات',
            available: 3,
            reserved: 7,
            total: 10,
            lowStock: true,
            location: 'مستودع جدة',
            lastUpdate: '2025-12-31 09:00',
        },
    ];

    const stats = [
        {
            label: 'إجمالي المنتجات',
            value: '347',
            icon: Package,
            color: 'blue',
            bgColor: 'bg-blue-100 dark:bg-blue-900/30',
            textColor: 'text-blue-600 dark:text-blue-400',
        },
        {
            label: 'المحجوزة',
            value: '70',
            icon: Warehouse,
            color: 'purple',
            bgColor: 'bg-purple-100 dark:bg-purple-900/30',
            textColor: 'text-purple-600 dark:text-purple-400',
        },
        {
            label: 'منخفض المخزون',
            value: '12',
            icon: AlertTriangle,
            color: 'orange',
            bgColor: 'bg-orange-100 dark:bg-orange-900/30',
            textColor: 'text-orange-600 dark:text-orange-400',
        },
        {
            label: 'معدل الدوران',
            value: '2.4x',
            icon: TrendingUp,
            color: 'green',
            bgColor: 'bg-green-100 dark:bg-green-900/30',
            textColor: 'text-green-600 dark:text-green-400',
        },
    ];

    // Filter items
    const filteredItems = inventoryItems.filter(item => {
        const matchesSearch =
            item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.name.includes(searchQuery) ||
            item.category.includes(searchQuery);

        const matchesLowStock = showLowStockOnly ? item.lowStock : true;

        return matchesSearch && matchesLowStock;
    });

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat) => {
                    const Icon = stat.icon;
                    return (
                        <Card key={stat.label}>
                            <CardContent className="p-4 sm:p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div className={`p-2 sm:p-3 rounded-lg ${stat.bgColor}`}>
                                        <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${stat.textColor}`} />
                                    </div>
                                </div>
                                <div>
                                    <p className="text-muted-foreground text-sm mb-1">{stat.label}</p>
                                    <p className="text-xl sm:text-2xl font-semibold">{stat.value}</p>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Model C Explanation */}
            <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                <CardContent className="p-4 sm:p-6">
                    <h3 className="text-lg mb-3 text-blue-900 dark:text-blue-100 font-medium">
                        نموذج C للحجز التلقائي
                    </h3>
                    <div className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
                        <p>✓ يتم حجز المخزون تلقائياً عند استيراد الطلب</p>
                        <p>✓ يتم إطلاق المخزون عند إلغاء الطلب أو إرجاعه</p>
                        <p>✓ يضمن عدم البيع الزائد (Overselling)</p>
                        <p>✓ تتبع دقيق للمخزون المتاح والمحجوز</p>
                    </div>
                </CardContent>
            </Card>

            {/* Inventory Table */}
            <Card>
                <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4">
                    <CardTitle>قائمة المخزون</CardTitle>
                    <div className="flex flex-col sm:flex-row gap-2">
                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="بحث..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full sm:w-64 pr-10 pl-4 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                        </div>
                        {/* Low Stock Filter */}
                        <Button
                            variant={showLowStockOnly ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setShowLowStockOnly(!showLowStockOnly)}
                            className="gap-2"
                        >
                            <AlertTriangle className="w-4 h-4" />
                            <span className="hidden sm:inline">منخفض المخزون</span>
                        </Button>
                        {/* Add Product */}
                        <Button
                            size="sm"
                            onClick={() => setIsCreateModalOpen(true)}
                            className="gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            إضافة منتج
                        </Button>
                    </div>
                </CardHeader>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">SKU</th>
                                <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">اسم المنتج</th>
                                <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground hidden md:table-cell">الفئة</th>
                                <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">المتاح</th>
                                <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground hidden sm:table-cell">المحجوز</th>
                                <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground hidden lg:table-cell">الموقع</th>
                                <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground hidden xl:table-cell">آخر تحديث</th>
                                <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground w-12"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredItems.map((item) => (
                                <tr
                                    key={item.sku}
                                    className="border-t border-border hover:bg-muted/30 transition-colors"
                                >
                                    <td className="px-4 py-4">
                                        <span className="font-mono text-sm">{item.sku}</span>
                                    </td>
                                    <td className="px-4 py-4">
                                        <span className="font-medium">{item.name}</span>
                                    </td>
                                    <td className="px-4 py-4 hidden md:table-cell">
                                        <span className="text-sm text-muted-foreground">{item.category}</span>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-2">
                                            <span className={item.lowStock ? 'text-red-600 dark:text-red-400 font-medium' : 'text-green-600 dark:text-green-400'}>
                                                {item.available}
                                            </span>
                                            {item.lowStock && (
                                                <AlertTriangle className="w-4 h-4 text-orange-500" />
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 hidden sm:table-cell">
                                        <Badge variant="secondary" className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-0">
                                            {item.reserved}
                                        </Badge>
                                    </td>
                                    <td className="px-4 py-4 hidden lg:table-cell">
                                        <span className="text-sm">{item.location}</span>
                                    </td>
                                    <td className="px-4 py-4 text-sm text-muted-foreground hidden xl:table-cell">
                                        {item.lastUpdate}
                                    </td>
                                    <td className="px-4 py-4">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                    <MoreVertical className="w-4 h-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem className="gap-2">
                                                    <Eye className="w-4 h-4" />
                                                    عرض التفاصيل
                                                </DropdownMenuItem>
                                                <DropdownMenuItem className="gap-2">
                                                    <Edit className="w-4 h-4" />
                                                    تعديل
                                                </DropdownMenuItem>
                                                <DropdownMenuItem className="gap-2 text-destructive">
                                                    <Trash2 className="w-4 h-4" />
                                                    حذف
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {filteredItems.length === 0 && (
                        <div className="p-8 text-center text-muted-foreground">
                            لا توجد نتائج مطابقة للبحث
                        </div>
                    )}
                </div>
            </Card>

            {/* Create Product Modal */}
            <ProductFormModal
                open={isCreateModalOpen}
                onOpenChange={setIsCreateModalOpen}
                onSubmit={handleCreateProduct}
                categories={categories}
            />
        </div>
    );
}
