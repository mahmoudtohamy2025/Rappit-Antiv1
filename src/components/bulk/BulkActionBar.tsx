/**
 * Bulk Action Bar Component
 * Floating action bar for bulk operations
 * 
 * Part of: GAP-13 Bulk Operations
 */

import { useState } from 'react';
import {
    CheckSquare,
    Trash2,
    Tag,
    ToggleLeft,
    X,
    Loader2,
    CheckCircle2,
    AlertTriangle,
} from 'lucide-react';
import { Card } from '../../UI/card';
import { Button } from '../../UI/button';
import { Badge } from '../../UI/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../UI/select';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '../../UI/dialog';
import { Progress } from '../../UI/progress';

interface Category {
    id: string;
    name: string;
}

interface BulkActionBarProps {
    selectedCount: number;
    categories?: Category[];
    isProcessing: boolean;
    progress: number;
    result: { success: number; failed: number; errors: Array<{ id: string; error: string }> } | null;
    onUpdateStatus: (status: 'ACTIVE' | 'INACTIVE') => void;
    onAssignCategory: (categoryId: string) => void;
    onDelete: () => void;
    onClear: () => void;
    onClearResult: () => void;
}

export function BulkActionBar({
    selectedCount,
    categories = [],
    isProcessing,
    progress,
    result,
    onUpdateStatus,
    onAssignCategory,
    onDelete,
    onClear,
    onClearResult,
}: BulkActionBarProps) {
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    if (selectedCount === 0 && !result) return null;

    // Show result modal
    if (result) {
        return (
            <Dialog open={true} onOpenChange={onClearResult}>
                <DialogContent className="max-w-sm" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {result.failed === 0 ? (
                                <>
                                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                                    تمت العملية بنجاح
                                </>
                            ) : (
                                <>
                                    <AlertTriangle className="w-5 h-5 text-yellow-600" />
                                    اكتملت العملية مع أخطاء
                                </>
                            )}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-3">
                        <div className="flex justify-between">
                            <span>نجحت:</span>
                            <Badge variant="secondary" className="text-green-600">{result.success}</Badge>
                        </div>
                        {result.failed > 0 && (
                            <div className="flex justify-between">
                                <span>فشلت:</span>
                                <Badge variant="secondary" className="text-red-600">{result.failed}</Badge>
                            </div>
                        )}
                        {result.errors.length > 0 && (
                            <div className="text-sm text-muted-foreground space-y-1">
                                {result.errors.slice(0, 3).map((err, i) => (
                                    <p key={i}>{err.error}</p>
                                ))}
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button onClick={onClearResult} className="w-full">تم</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    }

    // Show processing modal
    if (isProcessing) {
        return (
            <Dialog open={true}>
                <DialogContent className="max-w-sm" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            جاري المعالجة...
                        </DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <Progress value={progress} className="h-2" />
                        <p className="text-sm text-muted-foreground text-center mt-2">
                            {progress}%
                        </p>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <>
            {/* Fixed Action Bar */}
            <Card
                className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 shadow-lg animate-in slide-in-from-bottom-4"
                dir="rtl"
            >
                <div className="flex items-center gap-4 p-3">
                    {/* Selected Count */}
                    <div className="flex items-center gap-2">
                        <CheckSquare className="w-4 h-4 text-primary" />
                        <span className="font-medium">
                            {selectedCount} محدد
                        </span>
                    </div>

                    <div className="h-6 w-px bg-border" />

                    {/* Status Dropdown */}
                    <Select onValueChange={(v) => onUpdateStatus(v as 'ACTIVE' | 'INACTIVE')}>
                        <SelectTrigger className="w-32 h-8">
                            <ToggleLeft className="w-4 h-4 ml-1" />
                            <SelectValue placeholder="الحالة" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ACTIVE">نشط</SelectItem>
                            <SelectItem value="INACTIVE">غير نشط</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* Category Dropdown */}
                    {categories.length > 0 && (
                        <Select onValueChange={onAssignCategory}>
                            <SelectTrigger className="w-32 h-8">
                                <Tag className="w-4 h-4 ml-1" />
                                <SelectValue placeholder="التصنيف" />
                            </SelectTrigger>
                            <SelectContent>
                                {categories.map((cat) => (
                                    <SelectItem key={cat.id} value={cat.id}>
                                        {cat.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}

                    {/* Delete Button */}
                    <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setShowDeleteConfirm(true)}
                    >
                        <Trash2 className="w-4 h-4 ml-1" />
                        حذف
                    </Button>

                    {/* Clear Selection */}
                    <Button variant="ghost" size="icon" onClick={onClear}>
                        <X className="w-4 h-4" />
                    </Button>
                </div>
            </Card>

            {/* Delete Confirmation */}
            <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                <DialogContent className="max-w-sm" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <Trash2 className="w-5 h-5" />
                            تأكيد الحذف
                        </DialogTitle>
                    </DialogHeader>
                    <p className="py-4">
                        هل أنت متأكد من حذف {selectedCount} منتج؟ لا يمكن التراجع عن هذا الإجراء.
                    </p>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
                            إلغاء
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => {
                                setShowDeleteConfirm(false);
                                onDelete();
                            }}
                        >
                            حذف نهائياً
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
