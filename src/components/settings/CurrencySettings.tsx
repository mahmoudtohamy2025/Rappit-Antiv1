/**
 * Currency Settings Component
 * GAP-20: Multi-Currency Support
 * 
 * Settings panel for configuring organization currency
 */

import { useState, useEffect } from 'react';
import { DollarSign, Check, AlertTriangle, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../UI/card';
import { Button } from '../UI/button';
import { Label } from '../UI/label';
import { Badge } from '../UI/badge';
import { Switch } from '../UI/switch';
import { useCurrency, OrgCurrencySettings } from '../../hooks/useCurrency';
import { Currency } from '../../lib/currency';

export function CurrencySettings() {
    const { currencies, settings, isLoading, error, fetchSettings, updateSettings } = useCurrency();

    const [defaultCurrency, setDefaultCurrency] = useState('SAR');
    const [supportedCurrencies, setSupportedCurrencies] = useState<string[]>(['SAR']);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [saveSuccess, setSaveSuccess] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, []);

    useEffect(() => {
        if (settings) {
            setDefaultCurrency(settings.defaultCurrency);
            setSupportedCurrencies(settings.supportedCurrencies);
        }
    }, [settings]);

    const handleToggleCurrency = (code: string) => {
        if (supportedCurrencies.includes(code)) {
            // Don't allow removing the default currency
            if (code === defaultCurrency) return;
            setSupportedCurrencies(prev => prev.filter(c => c !== code));
        } else {
            setSupportedCurrencies(prev => [...prev, code]);
        }
    };

    const handleSetDefault = (code: string) => {
        setDefaultCurrency(code);
        // Ensure it's in supported
        if (!supportedCurrencies.includes(code)) {
            setSupportedCurrencies(prev => [...prev, code]);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        setSaveError(null);
        setSaveSuccess(false);

        try {
            await updateSettings({
                defaultCurrency,
                supportedCurrencies,
            });
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (err) {
            setSaveError(err instanceof Error ? err.message : 'حدث خطأ');
        } finally {
            setIsSaving(false);
        }
    };

    const hasChanges = settings && (
        settings.defaultCurrency !== defaultCurrency ||
        JSON.stringify(settings.supportedCurrencies.sort()) !== JSON.stringify(supportedCurrencies.sort())
    );

    return (
        <Card dir="rtl">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <DollarSign className="w-5 h-5" />
                        إعدادات العملة
                    </CardTitle>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={fetchSettings}
                        disabled={isLoading}
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Error Message */}
                {(error || saveError) && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        {error?.message || saveError}
                    </div>
                )}

                {/* Success Message */}
                {saveSuccess && (
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg text-sm flex items-center gap-2">
                        <Check className="w-4 h-4" />
                        تم حفظ الإعدادات بنجاح
                    </div>
                )}

                {/* Default Currency */}
                <div className="space-y-3">
                    <Label className="text-base font-medium">العملة الافتراضية</Label>
                    <p className="text-sm text-muted-foreground">
                        العملة المستخدمة للطلبات والمنتجات الجديدة
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                        {currencies.map((currency) => (
                            <button
                                key={currency.code}
                                onClick={() => handleSetDefault(currency.code)}
                                className={`p-3 rounded-lg border-2 transition-all ${defaultCurrency === currency.code
                                        ? 'border-primary bg-primary/10'
                                        : 'border-border hover:border-primary/50'
                                    }`}
                            >
                                <div className="text-lg font-bold">{currency.symbol}</div>
                                <div className="text-xs text-muted-foreground">{currency.code}</div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Supported Currencies */}
                <div className="space-y-3">
                    <Label className="text-base font-medium">العملات المدعومة</Label>
                    <p className="text-sm text-muted-foreground">
                        العملات المتاحة للاختيار في المنظمة
                    </p>
                    <div className="space-y-2">
                        {currencies.map((currency) => {
                            const isEnabled = supportedCurrencies.includes(currency.code);
                            const isDefault = currency.code === defaultCurrency;

                            return (
                                <div
                                    key={currency.code}
                                    className="flex items-center justify-between p-3 bg-muted rounded-lg"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-xl font-bold w-12">{currency.symbol}</span>
                                        <div>
                                            <p className="font-medium">{currency.nameAr}</p>
                                            <p className="text-sm text-muted-foreground">
                                                {currency.code} - {currency.nameEn}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {isDefault && (
                                            <Badge variant="default" className="text-xs">افتراضي</Badge>
                                        )}
                                        <Switch
                                            checked={isEnabled}
                                            onCheckedChange={() => handleToggleCurrency(currency.code)}
                                            disabled={isDefault}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button
                        variant="outline"
                        onClick={fetchSettings}
                        disabled={isSaving}
                    >
                        إلغاء
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={isSaving || !hasChanges}
                    >
                        {isSaving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
