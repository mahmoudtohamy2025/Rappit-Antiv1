/**
 * Product Form Modal
 * GAP-02: Product/SKU CRUD Frontend
 * 
 * Create and edit product form in a modal
 */

import { useState, useEffect } from 'react';
import {
    Package,
    Barcode,
    DollarSign,
    AlertTriangle,
    ImagePlus,
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '../UI/dialog';
import { Button } from '../UI/button';
import { Label } from '../UI/label';
import { Input } from '../UI/input';
import { Textarea } from '../UI/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../UI/select';
import { WarehouseSelect } from '../warehouses/WarehouseSelect';
import { Product, CreateProductDto, UpdateProductDto } from '../../hooks/useProducts';

interface ProductFormModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    product?: Product | null;
    onSubmit: (data: CreateProductDto | UpdateProductDto) => Promise<void>;
    categories?: string[];
}

export function ProductFormModal({
    open,
    onOpenChange,
    product,
    onSubmit,
    categories = [],
}: ProductFormModalProps) {
    const isEditing = !!product;
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form state
    const [name, setName] = useState('');
    const [sku, setSku] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('');
    const [newCategory, setNewCategory] = useState('');
    const [barcode, setBarcode] = useState('');
    const [price, setPrice] = useState('');
    const [cost, setCost] = useState('');
    const [minStock, setMinStock] = useState('10');
    const [maxStock, setMaxStock] = useState('');
    const [warehouseId, setWarehouseId] = useState('');
    const [initialQuantity, setInitialQuantity] = useState('');

    // Reset form when modal opens/closes or product changes
    useEffect(() => {
        if (open) {
            if (product) {
                setName(product.name);
                setSku(product.sku);
                setDescription(product.description || '');
                setCategory(product.category || '');
                setBarcode(product.barcode || '');
                setPrice(product.price?.toString() || '');
                setCost(product.cost?.toString() || '');
                setMinStock(product.minStock?.toString() || '10');
                setMaxStock(product.maxStock?.toString() || '');
                setWarehouseId('');
                setInitialQuantity('');
            } else {
                setName('');
                setSku('');
                setDescription('');
                setCategory('');
                setNewCategory('');
                setBarcode('');
                setPrice('');
                setCost('');
                setMinStock('10');
                setMaxStock('');
                setWarehouseId('');
                setInitialQuantity('');
            }
            setError(null);
        }
    }, [open, product]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!name.trim()) {
            setError('اسم المنتج مطلوب');
            return;
        }

        // Validate min/max stock
        const minStockNum = parseInt(minStock, 10) || 0;
        const maxStockNum = maxStock ? parseInt(maxStock, 10) : undefined;
        if (maxStockNum !== undefined && minStockNum > maxStockNum) {
            setError('الحد الأدنى يجب أن يكون أقل من الحد الأقصى');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            const finalCategory = newCategory.trim() || category;

            const data: CreateProductDto | UpdateProductDto = {
                name: name.trim(),
                ...(sku && { sku: sku.trim() }),
                ...(description && { description: description.trim() }),
                ...(finalCategory && { category: finalCategory }),
                ...(barcode && { barcode: barcode.trim() }),
                ...(price && { price: parseFloat(price) }),
                ...(cost && { cost: parseFloat(cost) }),
                minStock: minStockNum,
                ...(maxStockNum && { maxStock: maxStockNum }),
            };

            // Add initial stock for new products
            if (!isEditing && warehouseId && initialQuantity) {
                (data as CreateProductDto).initialStock = {
                    warehouseId,
                    quantity: parseInt(initialQuantity, 10),
                };
            }

            await onSubmit(data);
            onOpenChange(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'حدث خطأ');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Package className="w-5 h-5" />
                        {isEditing ? 'تعديل المنتج' : 'إضافة منتج جديد'}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
                    {/* Error */}
                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" />
                            {error}
                        </div>
                    )}

                    {/* Basic Info */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">اسم المنتج *</Label>
                            <Input
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="مثال: iPhone 15 Pro"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="sku">رمز المنتج (SKU)</Label>
                            <Input
                                id="sku"
                                value={sku}
                                onChange={(e) => setSku(e.target.value)}
                                placeholder="سيتم إنشاؤه تلقائياً"
                                className="font-mono"
                                disabled={isEditing}
                            />
                        </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <Label htmlFor="description">الوصف</Label>
                        <Textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="وصف المنتج..."
                            rows={2}
                        />
                    </div>

                    {/* Category */}
                    <div className="space-y-2">
                        <Label>الفئة</Label>
                        <div className="grid grid-cols-2 gap-2">
                            <Select value={category} onValueChange={setCategory}>
                                <SelectTrigger>
                                    <SelectValue placeholder="اختر فئة" />
                                </SelectTrigger>
                                <SelectContent>
                                    {categories.map((cat) => (
                                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Input
                                value={newCategory}
                                onChange={(e) => setNewCategory(e.target.value)}
                                placeholder="أو أضف فئة جديدة"
                            />
                        </div>
                    </div>

                    {/* Barcode */}
                    <div className="space-y-2">
                        <Label htmlFor="barcode" className="flex items-center gap-1">
                            <Barcode className="w-4 h-4" />
                            الباركود
                        </Label>
                        <Input
                            id="barcode"
                            value={barcode}
                            onChange={(e) => setBarcode(e.target.value)}
                            placeholder="مثال: 1234567890123"
                            className="font-mono"
                            dir="ltr"
                        />
                    </div>

                    {/* Pricing */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="price" className="flex items-center gap-1">
                                <DollarSign className="w-4 h-4" />
                                سعر البيع
                            </Label>
                            <Input
                                id="price"
                                type="number"
                                step="0.01"
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                                placeholder="0.00"
                                dir="ltr"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="cost">التكلفة</Label>
                            <Input
                                id="cost"
                                type="number"
                                step="0.01"
                                value={cost}
                                onChange={(e) => setCost(e.target.value)}
                                placeholder="0.00"
                                dir="ltr"
                            />
                        </div>
                    </div>

                    {/* Stock Thresholds */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="minStock">حد أدنى للمخزون</Label>
                            <Input
                                id="minStock"
                                type="number"
                                value={minStock}
                                onChange={(e) => setMinStock(e.target.value)}
                                placeholder="10"
                                dir="ltr"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="maxStock">حد أقصى للمخزون</Label>
                            <Input
                                id="maxStock"
                                type="number"
                                value={maxStock}
                                onChange={(e) => setMaxStock(e.target.value)}
                                placeholder="غير محدد"
                                dir="ltr"
                            />
                        </div>
                    </div>

                    {/* Initial Stock (only for new products) */}
                    {!isEditing && (
                        <div className="p-4 bg-muted rounded-lg space-y-3">
                            <Label className="text-base font-medium">المخزون الابتدائي (اختياري)</Label>
                            <div className="grid grid-cols-2 gap-3">
                                <WarehouseSelect
                                    value={warehouseId}
                                    onValueChange={setWarehouseId}
                                    label=""
                                    placeholder="اختر المستودع"
                                />
                                <div className="space-y-2">
                                    <Input
                                        type="number"
                                        value={initialQuantity}
                                        onChange={(e) => setInitialQuantity(e.target.value)}
                                        placeholder="الكمية"
                                        dir="ltr"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="gap-2 pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isSubmitting}
                        >
                            إلغاء
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? 'جاري الحفظ...' : isEditing ? 'حفظ التغييرات' : 'إضافة المنتج'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
