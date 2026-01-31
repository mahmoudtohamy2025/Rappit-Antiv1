/**
 * Preset Dropdown Component
 * Quick access to saved filter presets
 * 
 * Part of: GAP-11 Filter Presets
 */

import { useEffect, useState } from 'react';
import {
    BookmarkPlus,
    Check,
    ChevronDown,
    Star,
    Trash2,
    X,
    Loader2,
} from 'lucide-react';
import { Button } from '../../UI/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from '../../UI/dropdown-menu';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '../../UI/dialog';
import { Input } from '../../UI/input';
import { Label } from '../../UI/label';
import { Checkbox } from '../../UI/checkbox';
import {
    useFilterPresets,
    FilterPreset,
    FilterValues,
} from '../../../hooks/useFilterPresets';

interface PresetDropdownProps {
    currentFilters: FilterValues;
    onApplyPreset: (filters: FilterValues) => void;
    onClearFilters?: () => void;
}

export function PresetDropdown({
    currentFilters,
    onApplyPreset,
    onClearFilters,
}: PresetDropdownProps) {
    const {
        presets,
        activePreset,
        isLoading,
        getPresets,
        createPreset,
        deletePreset,
        applyPreset,
        setDefaultPreset,
        clearActivePreset,
    } = useFilterPresets();

    const [showSaveModal, setShowSaveModal] = useState(false);
    const [presetName, setPresetName] = useState('');
    const [isDefault, setIsDefault] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        getPresets();
    }, [getPresets]);

    const handleSavePreset = async () => {
        if (!presetName.trim()) return;

        setIsSaving(true);
        try {
            await createPreset({
                name: presetName.trim(),
                filters: currentFilters,
                isDefault,
            });
            setShowSaveModal(false);
            setPresetName('');
            setIsDefault(false);
        } catch (err) {
            console.error('Failed to save preset:', err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleApplyPreset = (preset: FilterPreset) => {
        applyPreset(preset, onApplyPreset);
    };

    const handleDeletePreset = async (e: React.MouseEvent, presetId: string) => {
        e.stopPropagation();
        if (confirm('هل تريد حذف هذا الفلتر المحفوظ؟')) {
            try {
                await deletePreset(presetId);
            } catch (err) {
                console.error('Failed to delete preset:', err);
            }
        }
    };

    const handleSetDefault = async (e: React.MouseEvent, presetId: string) => {
        e.stopPropagation();
        try {
            await setDefaultPreset(presetId);
        } catch (err) {
            console.error('Failed to set default:', err);
        }
    };

    const handleClear = () => {
        clearActivePreset();
        onClearFilters?.();
    };

    return (
        <>
            <div className="flex items-center gap-2" dir="rtl">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2">
                            {isLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <BookmarkPlus className="w-4 h-4" />
                            )}
                            {activePreset ? activePreset.name : 'فلاتر محفوظة'}
                            <ChevronDown className="w-3 h-3" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56" dir="rtl">
                        {presets.length === 0 ? (
                            <div className="p-3 text-center text-sm text-muted-foreground">
                                لا توجد فلاتر محفوظة
                            </div>
                        ) : (
                            presets.map((preset) => (
                                <DropdownMenuItem
                                    key={preset.id}
                                    onClick={() => handleApplyPreset(preset)}
                                    className="justify-between"
                                >
                                    <div className="flex items-center gap-2">
                                        {activePreset?.id === preset.id && (
                                            <Check className="w-4 h-4 text-primary" />
                                        )}
                                        <span>{preset.name}</span>
                                        {preset.isDefault && (
                                            <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            onClick={(e) => handleSetDefault(e, preset.id)}
                                        >
                                            <Star className={`w-3 h-3 ${preset.isDefault ? 'fill-yellow-500' : ''}`} />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-destructive"
                                            onClick={(e) => handleDeletePreset(e, preset.id)}
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </Button>
                                    </div>
                                </DropdownMenuItem>
                            ))
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setShowSaveModal(true)}>
                            <BookmarkPlus className="w-4 h-4 ml-2" />
                            حفظ الفلاتر الحالية
                        </DropdownMenuItem>
                        {activePreset && (
                            <DropdownMenuItem onClick={handleClear} className="text-muted-foreground">
                                <X className="w-4 h-4 ml-2" />
                                مسح الفلتر
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Save Preset Modal */}
            <Dialog open={showSaveModal} onOpenChange={setShowSaveModal}>
                <DialogContent className="max-w-sm" dir="rtl">
                    <DialogHeader>
                        <DialogTitle>حفظ الفلتر</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <Label htmlFor="presetName">اسم الفلتر</Label>
                            <Input
                                id="presetName"
                                value={presetName}
                                onChange={(e) => setPresetName(e.target.value)}
                                placeholder="مثال: منتجات منخفضة المخزون"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Checkbox
                                id="isDefault"
                                checked={isDefault}
                                onCheckedChange={(v) => setIsDefault(v as boolean)}
                            />
                            <Label htmlFor="isDefault" className="font-normal">
                                تعيين كفلتر افتراضي
                            </Label>
                        </div>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setShowSaveModal(false)}>
                            إلغاء
                        </Button>
                        <Button onClick={handleSavePreset} disabled={isSaving || !presetName.trim()}>
                            {isSaving && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                            حفظ
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
