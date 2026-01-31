/**
 * Reason Code Select Component
 * Dropdown for selecting force release reason codes
 * 
 * Part of: UI-INV-05 (Backend: force-release.service.ts)
 */

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../UI/select';

interface ReasonCodeSelectProps {
    value: string;
    onChange: (value: string) => void;
}

const REASON_CODES = [
    { value: 'STUCK_ORDER', label: 'طلب معلق', description: 'الطلب المرتبط معلق ولا يمكن معالجته' },
    { value: 'ORDER_CANCELLED', label: 'طلب ملغي', description: 'تم إلغاء الطلب من قبل العميل أو النظام' },
    { value: 'EXPIRED', label: 'منتهي الصلاحية', description: 'تجاوز الحجز الوقت المسموح به' },
    { value: 'DUPLICATE', label: 'مكرر', description: 'حجز مكرر لنفس الطلب أو المنتج' },
    { value: 'ADMIN_OVERRIDE', label: 'تجاوز إداري', description: 'قرار إداري لإطلاق الحجز' },
    { value: 'SYSTEM_RECOVERY', label: 'استعادة النظام', description: 'جزء من عملية استعادة أو صيانة' },
];

export function ReasonCodeSelect({ value, onChange }: ReasonCodeSelectProps) {
    return (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger>
                <SelectValue placeholder="اختر سبب الإطلاق" />
            </SelectTrigger>
            <SelectContent>
                {REASON_CODES.map((reason) => (
                    <SelectItem key={reason.value} value={reason.value}>
                        <div className="flex flex-col">
                            <span>{reason.label}</span>
                            <span className="text-xs text-muted-foreground">{reason.description}</span>
                        </div>
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
