/**
 * useValidationRules Hook
 * API hook for validation rule management
 * 
 * Connects to: inventory-validation.service.ts (57 tests)
 */

import { useState, useCallback } from 'react';

type RuleType = 'format' | 'range' | 'required' | 'regex' | 'custom';

interface ValidationRule {
    id: string;
    name: string;
    nameAr: string;
    type: RuleType;
    field: string;
    pattern?: string;
    min?: number;
    max?: number;
    enabled: boolean;
    isBuiltIn: boolean;
    errorMessage: string;
}

interface CreateRuleDto {
    nameAr: string;
    type: RuleType;
    field: string;
    pattern?: string;
    min?: number;
    max?: number;
    errorMessage: string;
}

interface ValidationResult {
    isValid: boolean;
    errors: Array<{
        ruleId: string;
        ruleName: string;
        field: string;
        message: string;
    }>;
}

interface UseValidationRulesReturn {
    rules: ValidationRule[];
    builtInRules: ValidationRule[];
    customRules: ValidationRule[];
    isLoading: boolean;
    error: Error | null;
    fetchRules: () => Promise<void>;
    createRule: (data: CreateRuleDto) => Promise<ValidationRule>;
    updateRule: (id: string, data: Partial<CreateRuleDto>) => Promise<ValidationRule>;
    deleteRule: (id: string) => Promise<void>;
    toggleRule: (id: string, enabled: boolean) => Promise<ValidationRule>;
    validateData: (data: Record<string, any>) => Promise<ValidationResult>;
}

const API_BASE = '/api/v1/inventory/validation-rules';

export function useValidationRules(): UseValidationRulesReturn {
    const [rules, setRules] = useState<ValidationRule[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const builtInRules = rules.filter(r => r.isBuiltIn);
    const customRules = rules.filter(r => !r.isBuiltIn);

    const fetchRules = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await fetch(API_BASE);
            if (!response.ok) throw new Error('Failed to fetch rules');
            const data = await response.json();
            setRules(data);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Unknown error'));
        } finally {
            setIsLoading(false);
        }
    }, []);

    const createRule = useCallback(async (data: CreateRuleDto): Promise<ValidationRule> => {
        const response = await fetch(API_BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        if (!response.ok) throw new Error('Failed to create rule');
        const rule = await response.json();
        setRules(prev => [...prev, rule]);
        return rule;
    }, []);

    const updateRule = useCallback(async (id: string, data: Partial<CreateRuleDto>): Promise<ValidationRule> => {
        const response = await fetch(`${API_BASE}/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        if (!response.ok) throw new Error('Failed to update rule');
        const rule = await response.json();
        setRules(prev => prev.map(r => r.id === id ? rule : r));
        return rule;
    }, []);

    const deleteRule = useCallback(async (id: string) => {
        const response = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Failed to delete rule');
        setRules(prev => prev.filter(r => r.id !== id));
    }, []);

    const toggleRule = useCallback(async (id: string, enabled: boolean): Promise<ValidationRule> => {
        const response = await fetch(`${API_BASE}/${id}/toggle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled }),
        });

        if (!response.ok) throw new Error('Failed to toggle rule');
        const rule = await response.json();
        setRules(prev => prev.map(r => r.id === id ? rule : r));
        return rule;
    }, []);

    const validateData = useCallback(async (data: Record<string, any>): Promise<ValidationResult> => {
        const response = await fetch(`${API_BASE}/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        if (!response.ok) throw new Error('Validation request failed');
        return response.json();
    }, []);

    return {
        rules,
        builtInRules,
        customRules,
        isLoading,
        error,
        fetchRules,
        createRule,
        updateRule,
        deleteRule,
        toggleRule,
        validateData,
    };
}
