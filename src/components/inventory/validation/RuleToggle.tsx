/**
 * Rule Toggle Component
 * Enable/disable switch for validation rules
 * 
 * Part of: UI-INV-04 (Backend: inventory-validation.service.ts)
 */

import { Switch } from '../../UI/switch';

interface RuleToggleProps {
    enabled: boolean;
    onChange: (enabled: boolean) => void;
    disabled?: boolean;
}

export function RuleToggle({ enabled, onChange, disabled = false }: RuleToggleProps) {
    return (
        <div className="flex items-center gap-2">
            <Switch
                checked={enabled}
                onCheckedChange={onChange}
                disabled={disabled}
            />
            <span className={`text-xs ${enabled ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                {enabled ? 'مُفعّل' : 'معطّل'}
            </span>
        </div>
    );
}
