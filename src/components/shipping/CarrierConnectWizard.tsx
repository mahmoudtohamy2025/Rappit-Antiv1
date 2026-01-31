/**
 * Carrier Connect Wizard
 * Step-by-step shipping carrier connection wizard
 * 
 * Part of: GAP-21 Shipping Carrier Connect
 */

import { useState } from 'react';
import {
    Truck,
    ArrowLeft,
    Check,
    Loader2,
    AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../../UI/card';
import { Button } from '../../UI/button';
import { Input } from '../../UI/input';
import { Label } from '../../UI/label';
import {
    useShippingAccounts,
    ShippingCarrier,
    CARRIER_CONFIG,
} from '../../../hooks/useShippingAccounts';

interface CarrierConnectWizardProps {
    onComplete?: () => void;
    onCancel?: () => void;
}

type WizardStep = 'select' | 'configure' | 'connecting' | 'complete';

// ============================================================
// CARRIER LOGOS
// ============================================================

const CARRIER_LOGOS: Record<ShippingCarrier, string> = {
    FEDEX: '📦',
    DHL: '📮',
    UPS: '📫',
    ARAMEX: '🚚',
};

// ============================================================
// COMPONENT
// ============================================================

export function CarrierConnectWizard({ onComplete, onCancel }: CarrierConnectWizardProps) {
    const { connectFedEx, connectDHL, connectAramex } = useShippingAccounts();

    const [step, setStep] = useState<WizardStep>('select');
    const [selectedCarrier, setSelectedCarrier] = useState<ShippingCarrier | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // FedEx fields
    const [fedexClientId, setFedexClientId] = useState('');
    const [fedexClientSecret, setFedexClientSecret] = useState('');
    const [fedexAccountNumber, setFedexAccountNumber] = useState('');

    // DHL fields
    const [dhlCustomerId, setDhlCustomerId] = useState('');
    const [dhlApiKey, setDhlApiKey] = useState('');

    // Aramex fields
    const [aramexAccountNumber, setAramexAccountNumber] = useState('');
    const [aramexUserName, setAramexUserName] = useState('');
    const [aramexPassword, setAramexPassword] = useState('');
    const [aramexPin, setAramexPin] = useState('');

    const carrierConfig = selectedCarrier ? CARRIER_CONFIG[selectedCarrier] : null;

    const handleCarrierSelect = (carrier: ShippingCarrier) => {
        setSelectedCarrier(carrier);
        setStep('configure');
        setError(null);
    };

    const handleConnect = async () => {
        if (!selectedCarrier) return;

        setIsConnecting(true);
        setError(null);

        try {
            switch (selectedCarrier) {
                case 'FEDEX':
                    await connectFedEx({
                        clientId: fedexClientId,
                        clientSecret: fedexClientSecret,
                        accountNumber: fedexAccountNumber,
                    });
                    break;
                case 'DHL':
                    await connectDHL({
                        customerId: dhlCustomerId,
                        apiKey: dhlApiKey,
                    });
                    break;
                case 'ARAMEX':
                    await connectAramex({
                        accountNumber: aramexAccountNumber,
                        userName: aramexUserName,
                        password: aramexPassword,
                        accountPin: aramexPin,
                    });
                    break;
                case 'UPS':
                    // UPS OAuth - similar to FedEx
                    break;
            }
            setStep('complete');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'فشل الربط');
        } finally {
            setIsConnecting(false);
        }
    };

    const isFormValid = () => {
        if (!selectedCarrier) return false;

        switch (selectedCarrier) {
            case 'FEDEX':
                return fedexClientId && fedexClientSecret && fedexAccountNumber;
            case 'DHL':
                return dhlCustomerId && dhlApiKey;
            case 'ARAMEX':
                return aramexAccountNumber && aramexUserName && aramexPassword && aramexPin;
            default:
                return false;
        }
    };

    return (
        <Card className="max-w-2xl mx-auto" dir="rtl">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    {step !== 'select' && (
                        <Button variant="ghost" size="icon" onClick={() => setStep('select')}>
                            <ArrowLeft className="w-4 h-4" />
                        </Button>
                    )}
                    <Truck className="w-5 h-5" />
                    {step === 'select' && 'ربط شركة شحن'}
                    {step === 'configure' && `ربط ${carrierConfig?.nameAr}`}
                    {step === 'connecting' && 'جاري الربط...'}
                    {step === 'complete' && 'تم الربط بنجاح!'}
                </CardTitle>
            </CardHeader>

            <CardContent>
                {/* Step: Select Carrier */}
                {step === 'select' && (
                    <div className="grid grid-cols-2 gap-4">
                        {(Object.keys(CARRIER_CONFIG) as ShippingCarrier[]).map((carrier) => {
                            const config = CARRIER_CONFIG[carrier];
                            return (
                                <Card
                                    key={carrier}
                                    className="cursor-pointer hover:border-primary transition-colors"
                                    onClick={() => handleCarrierSelect(carrier)}
                                >
                                    <CardContent className="p-6 flex items-center gap-4">
                                        <div
                                            className="text-3xl p-2 rounded-lg"
                                            style={{ backgroundColor: `${config.color}20` }}
                                        >
                                            {CARRIER_LOGOS[carrier]}
                                        </div>
                                        <div>
                                            <h3 className="font-semibold">{config.nameAr}</h3>
                                            <p className="text-sm text-muted-foreground">{config.name}</p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {config.authType === 'oauth' ? 'OAuth 2.0' :
                                                    config.authType === 'apikey' ? 'API Key' : 'بيانات الدخول'}
                                            </p>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}

                {/* Step: Configure */}
                {step === 'configure' && selectedCarrier && (
                    <div className="space-y-4">
                        {/* FedEx Form */}
                        {selectedCarrier === 'FEDEX' && (
                            <>
                                <p className="text-muted-foreground mb-4">
                                    أدخل بيانات API من{' '}
                                    <a href="https://developer.fedex.com" target="_blank" className="text-primary underline">
                                        FedEx Developer Portal
                                    </a>
                                </p>
                                <div>
                                    <Label>Client ID</Label>
                                    <Input
                                        value={fedexClientId}
                                        onChange={(e) => setFedexClientId(e.target.value)}
                                        placeholder="l7xx..."
                                        dir="ltr"
                                    />
                                </div>
                                <div>
                                    <Label>Client Secret</Label>
                                    <Input
                                        type="password"
                                        value={fedexClientSecret}
                                        onChange={(e) => setFedexClientSecret(e.target.value)}
                                        dir="ltr"
                                    />
                                </div>
                                <div>
                                    <Label>Account Number</Label>
                                    <Input
                                        value={fedexAccountNumber}
                                        onChange={(e) => setFedexAccountNumber(e.target.value)}
                                        placeholder="123456789"
                                        dir="ltr"
                                    />
                                </div>
                            </>
                        )}

                        {/* DHL Form */}
                        {selectedCarrier === 'DHL' && (
                            <>
                                <p className="text-muted-foreground mb-4">
                                    أدخل بيانات API من{' '}
                                    <a href="https://developer.dhl.com" target="_blank" className="text-primary underline">
                                        DHL Developer Portal
                                    </a>
                                </p>
                                <div>
                                    <Label>Customer ID</Label>
                                    <Input
                                        value={dhlCustomerId}
                                        onChange={(e) => setDhlCustomerId(e.target.value)}
                                        dir="ltr"
                                    />
                                </div>
                                <div>
                                    <Label>API Key</Label>
                                    <Input
                                        type="password"
                                        value={dhlApiKey}
                                        onChange={(e) => setDhlApiKey(e.target.value)}
                                        dir="ltr"
                                    />
                                </div>
                            </>
                        )}

                        {/* Aramex Form */}
                        {selectedCarrier === 'ARAMEX' && (
                            <>
                                <p className="text-muted-foreground mb-4">
                                    أدخل بيانات حسابك في Aramex
                                </p>
                                <div>
                                    <Label>رقم الحساب</Label>
                                    <Input
                                        value={aramexAccountNumber}
                                        onChange={(e) => setAramexAccountNumber(e.target.value)}
                                        dir="ltr"
                                    />
                                </div>
                                <div>
                                    <Label>اسم المستخدم</Label>
                                    <Input
                                        value={aramexUserName}
                                        onChange={(e) => setAramexUserName(e.target.value)}
                                        dir="ltr"
                                    />
                                </div>
                                <div>
                                    <Label>كلمة المرور</Label>
                                    <Input
                                        type="password"
                                        value={aramexPassword}
                                        onChange={(e) => setAramexPassword(e.target.value)}
                                        dir="ltr"
                                    />
                                </div>
                                <div>
                                    <Label>PIN</Label>
                                    <Input
                                        value={aramexPin}
                                        onChange={(e) => setAramexPin(e.target.value)}
                                        dir="ltr"
                                    />
                                </div>
                            </>
                        )}

                        {error && (
                            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-lg flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4" />
                                {error}
                            </div>
                        )}
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
                            تم ربط حساب {carrierConfig?.nameAr} بنجاح.
                        </p>
                    </div>
                )}
            </CardContent>

            <CardFooter className="gap-2">
                {step === 'select' && (
                    <Button variant="outline" onClick={onCancel}>إلغاء</Button>
                )}

                {step === 'configure' && (
                    <>
                        <Button variant="outline" onClick={() => setStep('select')}>رجوع</Button>
                        <Button
                            onClick={handleConnect}
                            disabled={isConnecting || !isFormValid()}
                        >
                            {isConnecting && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                            ربط الحساب
                        </Button>
                    </>
                )}

                {step === 'complete' && (
                    <Button onClick={onComplete} className="w-full">تم</Button>
                )}
            </CardFooter>
        </Card>
    );
}
