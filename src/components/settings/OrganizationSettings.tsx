/**
 * Organization Settings Component
 * GAP-10: Organization Settings
 * 
 * Main settings panel for organization configuration
 */

import { useState, useEffect } from 'react';
import {
    Building2,
    Settings,
    Bell,
    Globe,
    BarChart3,
    Check,
    AlertTriangle,
    RefreshCw,
    Upload,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../UI/card';
import { Button } from '../UI/button';
import { Label } from '../UI/label';
import { Input } from '../UI/input';
import { Switch } from '../UI/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../UI/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../UI/tabs';
import { useOrganization } from '../../hooks/useOrganization';

const TIMEZONES = [
    { value: 'Africa/Cairo', label: 'القاهرة (مصر)' },
    { value: 'Asia/Riyadh', label: 'الرياض (السعودية)' },
    { value: 'Asia/Dubai', label: 'دبي (الإمارات)' },
    { value: 'Asia/Kuwait', label: 'الكويت' },
    { value: 'Asia/Qatar', label: 'قطر' },
    { value: 'Asia/Bahrain', label: 'البحرين' },
    { value: 'Asia/Amman', label: 'عمّان (الأردن)' },
    { value: 'Asia/Beirut', label: 'بيروت (لبنان)' },
    { value: 'Europe/London', label: 'لندن' },
    { value: 'America/New_York', label: 'نيويورك' },
];

const DATE_FORMATS = [
    { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
    { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
    { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
];

export function OrganizationSettings() {
    const {
        profile,
        settings,
        stats,
        isLoading,
        error,
        fetchProfile,
        updateProfile,
        fetchSettings,
        updateSettings,
        fetchStats,
    } = useOrganization();

    const [isSaving, setIsSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Profile form state
    const [name, setName] = useState('');
    const [timezone, setTimezone] = useState('Asia/Riyadh');

    // Notification settings
    const [emailEnabled, setEmailEnabled] = useState(true);
    const [lowStockAlerts, setLowStockAlerts] = useState(true);
    const [orderAlerts, setOrderAlerts] = useState(true);
    const [weeklyReport, setWeeklyReport] = useState(false);

    // General settings
    const [dateFormat, setDateFormat] = useState('DD/MM/YYYY');
    const [language, setLanguage] = useState('ar');

    useEffect(() => {
        fetchProfile(true);
        fetchSettings();
        fetchStats();
    }, []);

    useEffect(() => {
        if (profile) {
            setName(profile.name);
            setTimezone(profile.timezone);
        }
    }, [profile]);

    useEffect(() => {
        if (settings) {
            setEmailEnabled(settings.notifications.emailEnabled);
            setLowStockAlerts(settings.notifications.lowStockAlerts);
            setOrderAlerts(settings.notifications.orderAlerts);
            setWeeklyReport(settings.notifications.weeklyReport);
            setDateFormat(settings.general.dateFormat);
            setLanguage(settings.general.language);
        }
    }, [settings]);

    const handleSaveProfile = async () => {
        setIsSaving(true);
        setSaveMessage(null);
        try {
            await updateProfile({ name, timezone });
            setSaveMessage({ type: 'success', text: 'تم حفظ الملف الشخصي' });
        } catch (err) {
            setSaveMessage({ type: 'error', text: err instanceof Error ? err.message : 'حدث خطأ' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveNotifications = async () => {
        setIsSaving(true);
        setSaveMessage(null);
        try {
            await updateSettings({
                notifications: { emailEnabled, lowStockAlerts, orderAlerts, weeklyReport },
            });
            setSaveMessage({ type: 'success', text: 'تم حفظ إعدادات الإشعارات' });
        } catch (err) {
            setSaveMessage({ type: 'error', text: err instanceof Error ? err.message : 'حدث خطأ' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveGeneral = async () => {
        setIsSaving(true);
        setSaveMessage(null);
        try {
            await updateSettings({
                general: { dateFormat, language, timezone },
            });
            setSaveMessage({ type: 'success', text: 'تم حفظ الإعدادات العامة' });
        } catch (err) {
            setSaveMessage({ type: 'error', text: err instanceof Error ? err.message : 'حدث خطأ' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6" dir="rtl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold flex items-center gap-2">
                        <Settings className="w-6 h-6" />
                        إعدادات المؤسسة
                    </h1>
                    <p className="text-muted-foreground">إدارة إعدادات وتفضيلات المؤسسة</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => { fetchProfile(true); fetchSettings(); fetchStats(); }}>
                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
            </div>

            {/* Save Message */}
            {saveMessage && (
                <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${saveMessage.type === 'success'
                        ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                        : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                    }`}>
                    {saveMessage.type === 'success' ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                    {saveMessage.text}
                </div>
            )}

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-sm text-muted-foreground">المستخدمين</p>
                            <p className="text-2xl font-bold">{stats.users}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-sm text-muted-foreground">المستودعات</p>
                            <p className="text-2xl font-bold">{stats.warehouses}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-sm text-muted-foreground">المنتجات</p>
                            <p className="text-2xl font-bold">{stats.products}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-sm text-muted-foreground">الطلبات (هذا الشهر)</p>
                            <p className="text-2xl font-bold">{stats.orders.thisMonth}</p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Settings Tabs */}
            <Tabs defaultValue="profile" className="w-full">
                <TabsList className="w-full justify-start">
                    <TabsTrigger value="profile" className="gap-2">
                        <Building2 className="w-4 h-4" />
                        الملف الشخصي
                    </TabsTrigger>
                    <TabsTrigger value="notifications" className="gap-2">
                        <Bell className="w-4 h-4" />
                        الإشعارات
                    </TabsTrigger>
                    <TabsTrigger value="general" className="gap-2">
                        <Globe className="w-4 h-4" />
                        عام
                    </TabsTrigger>
                </TabsList>

                {/* Profile Tab */}
                <TabsContent value="profile">
                    <Card>
                        <CardHeader>
                            <CardTitle>الملف الشخصي للمؤسسة</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="orgName">اسم المؤسسة</Label>
                                <Input
                                    id="orgName"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="اسم المؤسسة"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>المنطقة الزمنية</Label>
                                <Select value={timezone} onValueChange={setTimezone}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {TIMEZONES.map((tz) => (
                                            <SelectItem key={tz.value} value={tz.value}>
                                                {tz.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <Button onClick={handleSaveProfile} disabled={isSaving}>
                                {isSaving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Notifications Tab */}
                <TabsContent value="notifications">
                    <Card>
                        <CardHeader>
                            <CardTitle>إعدادات الإشعارات</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                                <div>
                                    <p className="font-medium">تفعيل البريد الإلكتروني</p>
                                    <p className="text-sm text-muted-foreground">استلام إشعارات عبر البريد</p>
                                </div>
                                <Switch checked={emailEnabled} onCheckedChange={setEmailEnabled} />
                            </div>

                            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                                <div>
                                    <p className="font-medium">تنبيهات المخزون المنخفض</p>
                                    <p className="text-sm text-muted-foreground">إشعار عند انخفاض المخزون</p>
                                </div>
                                <Switch checked={lowStockAlerts} onCheckedChange={setLowStockAlerts} />
                            </div>

                            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                                <div>
                                    <p className="font-medium">تنبيهات الطلبات</p>
                                    <p className="text-sm text-muted-foreground">إشعار عند استلام طلب جديد</p>
                                </div>
                                <Switch checked={orderAlerts} onCheckedChange={setOrderAlerts} />
                            </div>

                            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                                <div>
                                    <p className="font-medium">التقرير الأسبوعي</p>
                                    <p className="text-sm text-muted-foreground">تقرير ملخص أسبوعي</p>
                                </div>
                                <Switch checked={weeklyReport} onCheckedChange={setWeeklyReport} />
                            </div>

                            <Button onClick={handleSaveNotifications} disabled={isSaving}>
                                {isSaving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* General Tab */}
                <TabsContent value="general">
                    <Card>
                        <CardHeader>
                            <CardTitle>الإعدادات العامة</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>تنسيق التاريخ</Label>
                                <Select value={dateFormat} onValueChange={setDateFormat}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {DATE_FORMATS.map((fmt) => (
                                            <SelectItem key={fmt.value} value={fmt.value}>
                                                {fmt.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>اللغة</Label>
                                <Select value={language} onValueChange={setLanguage}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ar">العربية</SelectItem>
                                        <SelectItem value="en">English</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <Button onClick={handleSaveGeneral} disabled={isSaving}>
                                {isSaving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
