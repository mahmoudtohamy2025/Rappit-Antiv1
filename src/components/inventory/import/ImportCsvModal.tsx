/**
 * CSV Import Modal
 * Upload and import inventory from CSV files
 * 
 * Features:
 * - Drag and drop upload
 * - File validation
 * - Import options (update existing, skip duplicates, validate only)
 * - Progress indicator
 * - Error display with line numbers
 * - Template download
 */

import { useState, useRef, useCallback } from 'react';
import {
    Upload,
    FileText,
    X,
    Download,
    AlertCircle,
    CheckCircle2,
    Loader2
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '../../UI/dialog';
import { Button } from '../../UI/button';
import { Progress } from '../../UI/progress';
import { Checkbox } from '../../UI/checkbox';
import { Label } from '../../UI/label';
import { Alert, AlertDescription } from '../../UI/alert';

interface ImportCsvModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

type ImportStep = 'upload' | 'options' | 'importing' | 'results';

interface ImportResult {
    success: boolean;
    totalRows: number;
    imported: number;
    updated: number;
    skipped: number;
    errors: Array<{ row: number; message: string }>;
}

export function ImportCsvModal({ open, onOpenChange }: ImportCsvModalProps) {
    const [step, setStep] = useState<ImportStep>('upload');
    const [file, setFile] = useState<File | null>(null);
    const [dragActive, setDragActive] = useState(false);
    const [progress, setProgress] = useState(0);
    const [result, setResult] = useState<ImportResult | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Import options
    const [updateExisting, setUpdateExisting] = useState(false);
    const [skipDuplicates, setSkipDuplicates] = useState(true);
    const [validateOnly, setValidateOnly] = useState(false);

    // Reset state when modal closes
    const handleOpenChange = (open: boolean) => {
        if (!open) {
            setStep('upload');
            setFile(null);
            setProgress(0);
            setResult(null);
            setUpdateExisting(false);
            setSkipDuplicates(true);
            setValidateOnly(false);
        }
        onOpenChange(open);
    };

    // Handle drag events
    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    }, []);

    // Handle drop
    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const droppedFile = e.dataTransfer.files[0];
            if (droppedFile.type === 'text/csv' || droppedFile.name.endsWith('.csv')) {
                setFile(droppedFile);
                setStep('options');
            }
        }
    }, []);

    // Handle file input change
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setStep('options');
        }
    };

    // Start import
    const handleImport = async () => {
        if (!file) return;

        setStep('importing');

        // Simulate import progress
        for (let i = 0; i <= 100; i += 10) {
            await new Promise(resolve => setTimeout(resolve, 200));
            setProgress(i);
        }

        // Simulate result (will be replaced with actual API call)
        setResult({
            success: true,
            totalRows: 100,
            imported: 95,
            updated: 3,
            skipped: 2,
            errors: [
                { row: 45, message: 'SKU مكرر: ELEC-001' },
                { row: 78, message: 'كمية غير صالحة' },
            ],
        });
        setStep('results');
    };

    // Download template
    const handleDownloadTemplate = () => {
        const template = 'sku,name,quantity,warehouse_id,category,min_stock,max_stock\nSKU-001,اسم المنتج,100,warehouse-1,إلكترونيات,10,500';
        const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'inventory_template.csv';
        link.click();
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-lg" dir="rtl">
                <DialogHeader>
                    <DialogTitle>استيراد المخزون من CSV</DialogTitle>
                    <DialogDescription>
                        قم بتحميل ملف CSV يحتوي على بيانات المخزون
                    </DialogDescription>
                </DialogHeader>

                {/* Step: Upload */}
                {step === 'upload' && (
                    <div className="space-y-4">
                        {/* Drag & Drop Zone */}
                        <div
                            className={`
                border-2 border-dashed rounded-lg p-8 text-center transition-colors
                ${dragActive
                                    ? 'border-primary bg-primary/5'
                                    : 'border-muted-foreground/25 hover:border-primary/50'
                                }
              `}
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDragOver={handleDrag}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".csv"
                                onChange={handleFileChange}
                                className="hidden"
                            />
                            <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                            <p className="text-lg mb-2">اسحب ملف CSV هنا</p>
                            <p className="text-sm text-muted-foreground">
                                أو انقر لاختيار ملف
                            </p>
                            <p className="text-xs text-muted-foreground mt-2">
                                الحد الأقصى: 10 ميجابايت
                            </p>
                        </div>

                        {/* Download Template */}
                        <Button
                            variant="outline"
                            className="w-full gap-2"
                            onClick={handleDownloadTemplate}
                        >
                            <Download className="w-4 h-4" />
                            تحميل نموذج CSV
                        </Button>
                    </div>
                )}

                {/* Step: Options */}
                {step === 'options' && file && (
                    <div className="space-y-6">
                        {/* Selected File */}
                        <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                            <FileText className="w-8 h-8 text-primary" />
                            <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{file.name}</p>
                                <p className="text-sm text-muted-foreground">
                                    {(file.size / 1024).toFixed(1)} كيلوبايت
                                </p>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                    setFile(null);
                                    setStep('upload');
                                }}
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </div>

                        {/* Import Options */}
                        <div className="space-y-4">
                            <h4 className="font-medium">خيارات الاستيراد</h4>

                            <div className="flex items-center gap-3">
                                <Checkbox
                                    id="updateExisting"
                                    checked={updateExisting}
                                    onCheckedChange={(checked) => setUpdateExisting(checked as boolean)}
                                />
                                <Label htmlFor="updateExisting" className="cursor-pointer">
                                    تحديث المنتجات الموجودة
                                </Label>
                            </div>

                            <div className="flex items-center gap-3">
                                <Checkbox
                                    id="skipDuplicates"
                                    checked={skipDuplicates}
                                    onCheckedChange={(checked) => setSkipDuplicates(checked as boolean)}
                                />
                                <Label htmlFor="skipDuplicates" className="cursor-pointer">
                                    تخطي المكررات
                                </Label>
                            </div>

                            <div className="flex items-center gap-3">
                                <Checkbox
                                    id="validateOnly"
                                    checked={validateOnly}
                                    onCheckedChange={(checked) => setValidateOnly(checked as boolean)}
                                />
                                <Label htmlFor="validateOnly" className="cursor-pointer">
                                    التحقق فقط (بدون استيراد)
                                </Label>
                            </div>
                        </div>
                    </div>
                )}

                {/* Step: Importing */}
                {step === 'importing' && (
                    <div className="space-y-4 py-4">
                        <div className="flex items-center justify-center gap-3">
                            <Loader2 className="w-6 h-6 animate-spin text-primary" />
                            <span>جاري الاستيراد...</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                        <p className="text-center text-sm text-muted-foreground">
                            {progress}% مكتمل
                        </p>
                    </div>
                )}

                {/* Step: Results */}
                {step === 'results' && result && (
                    <div className="space-y-4">
                        {/* Success/Failure Alert */}
                        <Alert variant={result.errors.length > 0 ? 'default' : 'default'}>
                            {result.errors.length > 0 ? (
                                <AlertCircle className="w-4 h-4" />
                            ) : (
                                <CheckCircle2 className="w-4 h-4 text-green-600" />
                            )}
                            <AlertDescription>
                                {result.errors.length > 0
                                    ? `تم الاستيراد مع ${result.errors.length} خطأ`
                                    : 'تم الاستيراد بنجاح!'
                                }
                            </AlertDescription>
                        </Alert>

                        {/* Stats */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 bg-muted rounded-lg text-center">
                                <p className="text-2xl font-bold text-green-600">{result.imported}</p>
                                <p className="text-sm text-muted-foreground">تم استيرادها</p>
                            </div>
                            <div className="p-3 bg-muted rounded-lg text-center">
                                <p className="text-2xl font-bold text-blue-600">{result.updated}</p>
                                <p className="text-sm text-muted-foreground">تم تحديثها</p>
                            </div>
                            <div className="p-3 bg-muted rounded-lg text-center">
                                <p className="text-2xl font-bold text-orange-600">{result.skipped}</p>
                                <p className="text-sm text-muted-foreground">تم تخطيها</p>
                            </div>
                            <div className="p-3 bg-muted rounded-lg text-center">
                                <p className="text-2xl font-bold text-red-600">{result.errors.length}</p>
                                <p className="text-sm text-muted-foreground">أخطاء</p>
                            </div>
                        </div>

                        {/* Errors List */}
                        {result.errors.length > 0 && (
                            <div className="space-y-2">
                                <h4 className="font-medium">الأخطاء:</h4>
                                <div className="max-h-32 overflow-y-auto space-y-1">
                                    {result.errors.map((error, i) => (
                                        <div
                                            key={i}
                                            className="text-sm p-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded"
                                        >
                                            <span className="font-mono">صف {error.row}:</span> {error.message}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Footer */}
                <DialogFooter className="gap-2">
                    {step === 'upload' && (
                        <Button variant="outline" onClick={() => handleOpenChange(false)}>
                            إلغاء
                        </Button>
                    )}

                    {step === 'options' && (
                        <>
                            <Button variant="outline" onClick={() => setStep('upload')}>
                                رجوع
                            </Button>
                            <Button onClick={handleImport}>
                                {validateOnly ? 'التحقق' : 'استيراد'}
                            </Button>
                        </>
                    )}

                    {step === 'results' && (
                        <Button onClick={() => handleOpenChange(false)}>
                            إغلاق
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
