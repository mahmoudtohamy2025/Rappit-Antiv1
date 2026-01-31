/**
 * Channel Connect Wizard
 * Step-by-step OAuth/API connection wizard
 * 
 * Part of: GAP-18 Channel OAuth Flow
 */

import { useState, useEffect } from 'react';
import {
    ShoppingBag,
    Store,
    Check,
    ArrowLeft,
    ExternalLink,
    Loader2,
    AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../../UI/card';
import { Button } from '../../UI/button';
import { Input } from '../../UI/input';
import { Label } from '../../UI/label';
import { useChannels, ChannelPlatform } from '../../../hooks/useChannels';

interface ChannelConnectWizardProps {
    onComplete?: () => void;
    onCancel?: () => void;
}

type WizardStep = 'select' | 'configure' | 'connecting' | 'complete';

// ============================================================
// PLATFORM CONFIG
// ============================================================

const PLATFORMS: Array<{
    id: ChannelPlatform;
    name: string;
    nameAr: string;
    icon: any;
    color: string;
    requiresApiKey: boolean;
}> = [
        {
            id: 'SHOPIFY',
            name: 'Shopify',
            nameAr: 'شوبيفاي',
            icon: ShoppingBag,
            color: 'bg-green-500',
            requiresApiKey: false,
        },
        {
            id: 'WOOCOMMERCE',
            name: 'WooCommerce',
            nameAr: 'ووكومرس',
            icon: Store,
            color: 'bg-purple-500',
            requiresApiKey: true,
        },
    ];

// ============================================================
// COMPONENT
// ============================================================

export function ChannelConnectWizard({ onComplete, onCancel }: ChannelConnectWizardProps) {
    const { initiateOAuth, connectWithApiKey } = useChannels();

    const [step, setStep] = useState<WizardStep>('select');
    const [selectedPlatform, setSelectedPlatform] = useState<ChannelPlatform | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // WooCommerce fields
    const [storeUrl, setStoreUrl] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [apiSecret, setApiSecret] = useState('');

    const platform = selectedPlatform ? PLATFORMS.find(p => p.id === selectedPlatform) : null;

    const handlePlatformSelect = async (platformId: ChannelPlatform) => {
        const selected = PLATFORMS.find(p => p.id === platformId)!;
        setSelectedPlatform(platformId);

        if (!selected.requiresApiKey) {
            // OAuth flow - open popup
            try {
                setStep('connecting');
                const authUrl = await initiateOAuth(platformId);

                // Open OAuth popup
                const popup = window.open(
                    authUrl,
                    'oauth',
                    'width=600,height=700,scrollbars=yes'
                );

                // Listen for callback
                const handleMessage = (event: MessageEvent) => {
                    if (event.data.type === 'oauth_callback') {
                        window.removeEventListener('message', handleMessage);
                        setStep('complete');
                    } else if (event.data.type === 'oauth_error') {
                        window.removeEventListener('message', handleMessage);
                        setError(event.data.message);
                        setStep('select');
                    }
                };

                window.addEventListener('message', handleMessage);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'فشل الربط');
                setStep('select');
            }
        } else {
            // API key flow
            setStep('configure');
        }
    };

    const handleApiKeyConnect = async () => {
        if (!selectedPlatform) return;

        setIsConnecting(true);
        setError(null);

        try {
            await connectWithApiKey({
                platform: selectedPlatform,
                storeUrl,
                apiKey,
                apiSecret,
            });
            setStep('complete');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'فشل الربط');
        } finally {
            setIsConnecting(false);
        }
    };

    const handleComplete = () => {
        onComplete?.();
    };

    return (
        <Card className="max-w-2xl mx-auto" dir="rtl">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    {step !== 'select' && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setStep('select')}
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </Button>
                    )}
                    {step === 'select' && 'ربط قناة بيع'}
                    {step === 'configure' && `ربط ${platform?.nameAr}`}
                    {step === 'connecting' && 'جاري الربط...'}
                    {step === 'complete' && 'تم الربط بنجاح!'}
                </CardTitle>
            </CardHeader>

            <CardContent>
                {/* Step: Select Platform */}
                {step === 'select' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {PLATFORMS.map((p) => (
                            <Card
                                key={p.id}
                                className="cursor-pointer hover:border-primary transition-colors"
                                onClick={() => handlePlatformSelect(p.id)}
                            >
                                <CardContent className="p-6 flex items-center gap-4">
                                    <div className={`p-3 rounded-lg ${p.color} text-white`}>
                                        <p.icon className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold">{p.nameAr}</h3>
                                        <p className="text-sm text-muted-foreground">{p.name}</p>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                {/* Step: Configure API Key */}
                {step === 'configure' && platform && (
                    <div className="space-y-4">
                        <p className="text-muted-foreground">
                            أدخل بيانات API للاتصال بمتجرك
                        </p>

                        <div>
                            <Label htmlFor="storeUrl">رابط المتجر</Label>
                            <Input
                                id="storeUrl"
                                value={storeUrl}
                                onChange={(e) => setStoreUrl(e.target.value)}
                                placeholder="https://your-store.com"
                                dir="ltr"
                            />
                        </div>

                        <div>
                            <Label htmlFor="apiKey">API Key</Label>
                            <Input
                                id="apiKey"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="ck_xxx"
                                dir="ltr"
                            />
                        </div>

                        <div>
                            <Label htmlFor="apiSecret">API Secret</Label>
                            <Input
                                id="apiSecret"
                                type="password"
                                value={apiSecret}
                                onChange={(e) => setApiSecret(e.target.value)}
                                placeholder="cs_xxx"
                                dir="ltr"
                            />
                        </div>

                        {error && (
                            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-lg flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4" />
                                {error}
                            </div>
                        )}
                    </div>
                )}

                {/* Step: Connecting */}
                {step === 'connecting' && (
                    <div className="text-center py-8">
                        <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-primary" />
                        <p className="text-muted-foreground">جاري ربط حسابك...</p>
                    </div>
                )}

                {/* Step: Complete */}
                {step === 'complete' && (
                    <div className="text-center py-8">
                        <div className="w-16 h-16 mx-auto mb-4 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                            <Check className="w-8 h-8 text-green-600" />
                        </div>
                        <h3 className="text-xl font-semibold mb-2">تم الربط بنجاح!</h3>
                        <p className="text-muted-foreground">
                            تم ربط متجرك بنجاح. ستبدأ مزامنة الطلبات تلقائياً.
                        </p>
                    </div>
                )}
            </CardContent>

            <CardFooter className="gap-2">
                {step === 'select' && (
                    <Button variant="outline" onClick={onCancel}>
                        إلغاء
                    </Button>
                )}

                {step === 'configure' && (
                    <>
                        <Button variant="outline" onClick={() => setStep('select')}>
                            رجوع
                        </Button>
                        <Button
                            onClick={handleApiKeyConnect}
                            disabled={isConnecting || !storeUrl || !apiKey || !apiSecret}
                        >
                            {isConnecting && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                            ربط المتجر
                        </Button>
                    </>
                )}

                {step === 'complete' && (
                    <Button onClick={handleComplete} className="w-full">
                        تم
                    </Button>
                )}
            </CardFooter>
        </Card>
    );
}
