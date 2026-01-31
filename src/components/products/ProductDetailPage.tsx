/**
 * Product Detail Page
 * GAP-02: Product/SKU CRUD Frontend
 * 
 * Detailed view of a single product with stock info and history
 */

import { useState, useEffect } from 'react';
import {
    Package,
    ArrowRight,
    Edit,
    Trash2,
    Barcode,
    DollarSign,
    AlertTriangle,
    TrendingUp,
    TrendingDown,
    History,
    Warehouse,
} from 'lucide-react';
import { Button } from '../UI/button';
import { Card, CardContent, CardHeader, CardTitle } from '../UI/card';
import { Badge } from '../UI/badge';
import { useProducts, Product } from '../../hooks/useProducts';
import { ProductFormModal } from './ProductFormModal';

interface ProductDetailPageProps {
    productId: string;
    onBack: () => void;
}

export function ProductDetailPage({ productId, onBack }: ProductDetailPageProps) {
    const { getById, getHistory, update, remove, getCategories, categories } = useProducts();

    const [product, setProduct] = useState<Product | null>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    useEffect(() => {
        loadProduct();
        loadHistory();
        getCategories();
    }, [productId]);

    const loadProduct = async () => {
        try {
            setIsLoading(true);
            const data = await getById(productId);
            setProduct(data);
        } catch (err) {
            setError('فشل تحميل بيانات المنتج');
        } finally {
            setIsLoading(false);
        }
    };

    const loadHistory = async () => {
        try {
            const data = await getHistory(productId);
            setHistory(data);
        } catch {
            // Ignore history errors
        }
    };

    const handleUpdate = async (data: any) => {
        await update(productId, data);
        await loadProduct();
        setIsEditModalOpen(false);
    };

    const handleDelete = async () => {
        if (confirm('هل أنت متأكد من حذف هذا المنتج؟')) {
            await remove(productId);
            onBack();
        }
    };

    const getStockStatusBadge = (status: string) => {
        switch (status) {
            case 'LOW':
                return <Badge variant="warning" className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">منخفض</Badge>;
            case 'OUT':
                return <Badge variant="destructive">نفذ</Badge>;
            default:
                return <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">متوفر</Badge>;
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-6" dir="rtl">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 bg-muted rounded w-1/3"></div>
                    <div className="h-64 bg-muted rounded"></div>
                </div>
            </div>
        );
    }

    if (error || !product) {
        return (
            <div className="space-y-6" dir="rtl">
                <Card className="border-red-200 dark:border-red-800">
                    <CardContent className="p-6 text-center">
                        <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-red-500" />
                        <p className="text-lg">{error || 'المنتج غير موجود'}</p>
                        <Button onClick={onBack} className="mt-4">
                            <ArrowRight className="w-4 h-4 ml-2" />
                            العودة
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6" dir="rtl">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={onBack}>
                        <ArrowRight className="w-5 h-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-semibold flex items-center gap-2">
                            <Package className="w-6 h-6" />
                            {product.name}
                        </h1>
                        <p className="text-muted-foreground font-mono">{product.sku}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setIsEditModalOpen(true)}>
                        <Edit className="w-4 h-4 ml-2" />
                        تعديل
                    </Button>
                    <Button variant="destructive" onClick={handleDelete}>
                        <Trash2 className="w-4 h-4 ml-2" />
                        حذف
                    </Button>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Product Info */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>معلومات المنتج</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm text-muted-foreground">الفئة</p>
                                <p className="font-medium">{product.category || 'غير محدد'}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">الباركود</p>
                                <p className="font-mono">{product.barcode || 'غير محدد'}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground flex items-center gap-1">
                                    <DollarSign className="w-4 h-4" />
                                    سعر البيع
                                </p>
                                <p className="font-medium text-lg">
                                    {product.price ? `${product.price} ر.س` : 'غير محدد'}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">التكلفة</p>
                                <p className="font-medium">
                                    {product.cost ? `${product.cost} ر.س` : 'غير محدد'}
                                </p>
                            </div>
                        </div>

                        {product.description && (
                            <div>
                                <p className="text-sm text-muted-foreground mb-1">الوصف</p>
                                <p>{product.description}</p>
                            </div>
                        )}

                        <div className="pt-4 border-t grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm text-muted-foreground">حد أدنى للمخزون</p>
                                <p className="font-medium">{product.minStock}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">حد أقصى للمخزون</p>
                                <p className="font-medium">{product.maxStock || 'غير محدد'}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Stock Summary */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle>المخزون</CardTitle>
                            {getStockStatusBadge(product.stockStatus)}
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="text-center p-4 bg-muted rounded-lg">
                            <p className="text-4xl font-bold">{product.totalAvailable}</p>
                            <p className="text-sm text-muted-foreground">متاح</p>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-center">
                            <div className="p-2 bg-orange-50 dark:bg-orange-900/20 rounded">
                                <p className="text-lg font-medium text-orange-600">{product.totalReserved}</p>
                                <p className="text-xs text-muted-foreground">محجوز</p>
                            </div>
                            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                                <p className="text-lg font-medium text-blue-600">
                                    {product.totalAvailable + product.totalReserved}
                                </p>
                                <p className="text-xs text-muted-foreground">إجمالي</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Stock by Warehouse */}
            {product.stockByWarehouse && product.stockByWarehouse.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Warehouse className="w-5 h-5" />
                            المخزون حسب المستودع
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-right py-2 font-medium">المستودع</th>
                                        <th className="text-center py-2 font-medium">متاح</th>
                                        <th className="text-center py-2 font-medium">محجوز</th>
                                        <th className="text-center py-2 font-medium">تالف</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {product.stockByWarehouse.map((stock) => (
                                        <tr key={stock.warehouseId} className="border-b last:border-0">
                                            <td className="py-3">{stock.warehouseName}</td>
                                            <td className="text-center font-medium">{stock.available}</td>
                                            <td className="text-center text-orange-600">{stock.reserved}</td>
                                            <td className="text-center text-red-600">{stock.damaged}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Stock History */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <History className="w-5 h-5" />
                        سجل الحركات
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {history.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">
                            لا توجد حركات مسجلة
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {history.slice(0, 10).map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                                    <div className="flex items-center gap-3">
                                        {item.type === 'IN' ? (
                                            <TrendingUp className="w-5 h-5 text-green-600" />
                                        ) : (
                                            <TrendingDown className="w-5 h-5 text-red-600" />
                                        )}
                                        <div>
                                            <p className="font-medium">{item.reason || item.type}</p>
                                            <p className="text-sm text-muted-foreground">
                                                {new Date(item.createdAt).toLocaleString('ar-SA')}
                                            </p>
                                        </div>
                                    </div>
                                    <span className={`font-bold ${item.type === 'IN' ? 'text-green-600' : 'text-red-600'}`}>
                                        {item.type === 'IN' ? '+' : '-'}{item.quantity}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Edit Modal */}
            <ProductFormModal
                open={isEditModalOpen}
                onOpenChange={setIsEditModalOpen}
                product={product}
                onSubmit={handleUpdate}
                categories={categories}
            />
        </div>
    );
}
