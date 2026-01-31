'use client';

/**
 * Settings Page
 * System settings including validation rules
 * 
 * Part of: Phase 4 Inventory Management (INV-04)
 */

import { useState } from 'react';
import { Settings, Shield, Bell, Database, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/UI/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/UI/tabs';
import { ValidationRulesPanel } from '@/components/inventory/validation';

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState('validation');

    return (
        <div className="space-y-6" dir="rtl">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-semibold flex items-center gap-2">
                    <Settings className="w-8 h-8" />
                    الإعدادات
                </h1>
                <p className="text-muted-foreground mt-1">
                    إعدادات النظام وقواعد التحقق
                </p>
            </div>

            {/* Settings Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl">
                <TabsList>
                    <TabsTrigger value="validation" className="gap-2">
                        <Shield className="w-4 h-4" />
                        قواعد التحقق
                    </TabsTrigger>
                    <TabsTrigger value="notifications" className="gap-2">
                        <Bell className="w-4 h-4" />
                        الإشعارات
                    </TabsTrigger>
                    <TabsTrigger value="system" className="gap-2">
                        <Database className="w-4 h-4" />
                        النظام
                    </TabsTrigger>
                    <TabsTrigger value="users" className="gap-2">
                        <Users className="w-4 h-4" />
                        المستخدمين
                    </TabsTrigger>
                </TabsList>

                {/* Validation Rules Tab */}
                <TabsContent value="validation" className="mt-6">
                    <ValidationRulesPanel />
                </TabsContent>

                {/* Notifications Tab - Placeholder */}
                <TabsContent value="notifications" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Bell className="w-5 h-5" />
                                إعدادات الإشعارات
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 text-center text-muted-foreground">
                            <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p className="text-lg">قريباً</p>
                            <p className="text-sm">إعدادات الإشعارات والتنبيهات</p>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* System Tab - Placeholder */}
                <TabsContent value="system" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Database className="w-5 h-5" />
                                إعدادات النظام
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 text-center text-muted-foreground">
                            <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p className="text-lg">قريباً</p>
                            <p className="text-sm">إعدادات النظام والنسخ الاحتياطي</p>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Users Tab - Placeholder */}
                <TabsContent value="users" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Users className="w-5 h-5" />
                                إدارة المستخدمين
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 text-center text-muted-foreground">
                            <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p className="text-lg">قريباً</p>
                            <p className="text-sm">إدارة المستخدمين والصلاحيات</p>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
