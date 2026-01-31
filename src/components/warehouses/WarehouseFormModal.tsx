/**
 * Warehouse Form Modal
 * GAP-01: Warehouse CRUD Frontend
 * 
 * Create and edit warehouse form in a modal
 */

import { useState, useEffect } from 'react';
import { Warehouse as WarehouseIcon, MapPin, User, Phone, Mail } from 'lucide-react';
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
import { Switch } from '../UI/switch';
import { Warehouse, CreateWarehouseDto, UpdateWarehouseDto } from '../../hooks/useWarehouses';

interface WarehouseFormModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    warehouse?: Warehouse | null;
    onSubmit: (data: CreateWarehouseDto | UpdateWarehouseDto) => Promise<void>;
}

export function WarehouseFormModal({
    open,
    onOpenChange,
    warehouse,
    onSubmit,
}: WarehouseFormModalProps) {
    const isEditing = !!warehouse;
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form state
    const [name, setName] = useState('');
    const [code, setCode] = useState('');
    const [street, setStreet] = useState('');
    const [city, setCity] = useState('');
    const [country, setCountry] = useState('');
    const [postalCode, setPostalCode] = useState('');
    const [capacity, setCapacity] = useState('');
    const [contactName, setContactName] = useState('');
    const [contactPhone, setContactPhone] = useState('');
    const [contactEmail, setContactEmail] = useState('');
    const [isActive, setIsActive] = useState(true);

    // Reset form when modal opens/closes or warehouse changes
    useEffect(() => {
        if (open) {
            if (warehouse) {
                setName(warehouse.name);
                setCode(warehouse.code);
                setStreet(warehouse.address?.street || '');
                setCity(warehouse.address?.city || '');
                setCountry(warehouse.address?.country || '');
                setPostalCode(warehouse.address?.postalCode || '');
                setCapacity(warehouse.capacity?.toString() || '');
                setContactName(warehouse.contactName || '');
                setContactPhone(warehouse.contactPhone || '');
                setContactEmail(warehouse.contactEmail || '');
                setIsActive(warehouse.isActive);
            } else {
                setName('');
                setCode('');
                setStreet('');
                setCity('');
                setCountry('السعودية');
                setPostalCode('');
                setCapacity('');
                setContactName('');
                setContactPhone('');
                setContactEmail('');
                setIsActive(true);
            }
            setError(null);
        }
    }, [open, warehouse]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!name.trim()) {
            setError('اسم المستودع مطلوب');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            const data: CreateWarehouseDto | UpdateWarehouseDto = {
                name: name.trim(),
                ...(code && { code: code.trim() }),
                address: {
                    ...(street && { street: street.trim() }),
                    ...(city && { city: city.trim() }),
                    ...(country && { country: country.trim() }),
                    ...(postalCode && { postalCode: postalCode.trim() }),
                },
                ...(capacity && { capacity: parseInt(capacity, 10) }),
                ...(contactName && { contactName: contactName.trim() }),
                ...(contactPhone && { contactPhone: contactPhone.trim() }),
                ...(contactEmail && { contactEmail: contactEmail.trim() }),
                isActive,
            };

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
                        <WarehouseIcon className="w-5 h-5" />
                        {isEditing ? 'تعديل المستودع' : 'إضافة مستودع جديد'}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Error */}
                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    {/* Basic Info */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">اسم المستودع *</Label>
                            <Input
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="مثال: مستودع الرياض"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="code">كود المستودع</Label>
                            <Input
                                id="code"
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                placeholder="سيتم إنشاؤه تلقائياً"
                                className="font-mono"
                            />
                        </div>
                    </div>

                    {/* Address Section */}
                    <div className="space-y-3">
                        <Label className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            العنوان
                        </Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="sm:col-span-2">
                                <Input
                                    value={street}
                                    onChange={(e) => setStreet(e.target.value)}
                                    placeholder="الشارع"
                                />
                            </div>
                            <Input
                                value={city}
                                onChange={(e) => setCity(e.target.value)}
                                placeholder="المدينة"
                            />
                            <Input
                                value={country}
                                onChange={(e) => setCountry(e.target.value)}
                                placeholder="الدولة"
                            />
                            <Input
                                value={postalCode}
                                onChange={(e) => setPostalCode(e.target.value)}
                                placeholder="الرمز البريدي"
                            />
                            <Input
                                type="number"
                                value={capacity}
                                onChange={(e) => setCapacity(e.target.value)}
                                placeholder="السعة (اختياري)"
                            />
                        </div>
                    </div>

                    {/* Contact Section */}
                    <div className="space-y-3">
                        <Label className="flex items-center gap-1">
                            <User className="w-4 h-4" />
                            معلومات الاتصال
                        </Label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="relative">
                                <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    value={contactName}
                                    onChange={(e) => setContactName(e.target.value)}
                                    placeholder="اسم المسؤول"
                                    className="pr-10"
                                />
                            </div>
                            <div className="relative">
                                <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    type="tel"
                                    value={contactPhone}
                                    onChange={(e) => setContactPhone(e.target.value)}
                                    placeholder="رقم الهاتف"
                                    className="pr-10"
                                    dir="ltr"
                                />
                            </div>
                            <div className="relative">
                                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    type="email"
                                    value={contactEmail}
                                    onChange={(e) => setContactEmail(e.target.value)}
                                    placeholder="البريد الإلكتروني"
                                    className="pr-10"
                                    dir="ltr"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Active Status */}
                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div>
                            <Label htmlFor="isActive">المستودع نشط</Label>
                            <p className="text-sm text-muted-foreground">
                                المستودعات غير النشطة لن تظهر في القوائم
                            </p>
                        </div>
                        <Switch
                            id="isActive"
                            checked={isActive}
                            onCheckedChange={setIsActive}
                        />
                    </div>

                    <DialogFooter className="gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isSubmitting}
                        >
                            إلغاء
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? 'جاري الحفظ...' : isEditing ? 'حفظ التغييرات' : 'إضافة المستودع'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
