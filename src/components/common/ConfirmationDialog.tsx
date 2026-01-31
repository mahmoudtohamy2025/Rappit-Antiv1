import React, { useState, useCallback, createContext, useContext, ReactNode } from 'react';

/**
 * Confirmation Dialog Component
 * 
 * Provides confirmation dialogs for destructive actions.
 * Follows existing Figma design system.
 */

export interface ConfirmationConfig {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning';
    affectedCount?: number;
    onConfirm: () => Promise<void>;
    onCancel?: () => void;
}

export interface ConfirmationState extends ConfirmationConfig {
    isOpen: boolean;
    isLoading: boolean;
    error: string | null;
}

export interface ConfirmationContextValue {
    showConfirmation: (config: ConfirmationConfig) => void;
    hideConfirmation: () => void;
    state: ConfirmationState | null;
}

const ConfirmationContext = createContext<ConfirmationContextValue | null>(null);

export const useConfirmation = (): ConfirmationContextValue => {
    const context = useContext(ConfirmationContext);
    if (!context) {
        throw new Error('useConfirmation must be used within ConfirmationProvider');
    }
    return context;
};

export const ConfirmationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [state, setState] = useState<ConfirmationState | null>(null);

    const showConfirmation = useCallback((config: ConfirmationConfig) => {
        setState({
            ...config,
            confirmText: config.confirmText || 'Confirm',
            cancelText: config.cancelText || 'Cancel',
            variant: config.variant || 'danger',
            isOpen: true,
            isLoading: false,
            error: null,
        });
    }, []);

    const hideConfirmation = useCallback(() => {
        setState(null);
    }, []);

    const handleConfirm = async () => {
        if (!state) return;

        setState(prev => prev ? { ...prev, isLoading: true, error: null } : null);

        try {
            await state.onConfirm();
            hideConfirmation();
        } catch (error) {
            setState(prev => prev ? {
                ...prev,
                isLoading: false,
                error: error instanceof Error ? error.message : 'An error occurred',
            } : null);
        }
    };

    const handleCancel = () => {
        state?.onCancel?.();
        hideConfirmation();
    };

    return (
        <ConfirmationContext.Provider value={{ showConfirmation, hideConfirmation, state }}>
            {children}
            {state?.isOpen && (
                <div
                    className="confirmation-overlay"
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                    }}
                    data-testid="confirmation-overlay"
                >
                    <div
                        className="confirmation-dialog"
                        style={{
                            backgroundColor: 'white',
                            borderRadius: '12px',
                            padding: '24px',
                            maxWidth: '400px',
                            width: '100%',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
                        }}
                        data-testid="confirmation-dialog"
                    >
                        <h2
                            style={{
                                color: state.variant === 'danger' ? '#dc2626' : '#d97706',
                                marginBottom: '12px',
                                fontSize: '18px',
                            }}
                        >
                            {state.title}
                        </h2>

                        <p style={{ color: '#4b5563', marginBottom: '8px' }}>
                            {state.message}
                        </p>

                        {state.affectedCount && state.affectedCount > 1 && (
                            <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '16px' }}>
                                This will affect <strong>{state.affectedCount}</strong> items.
                            </p>
                        )}

                        {state.error && (
                            <div
                                style={{
                                    backgroundColor: '#fef2f2',
                                    border: '1px solid #fecaca',
                                    borderRadius: '8px',
                                    padding: '12px',
                                    marginBottom: '16px',
                                    color: '#dc2626',
                                }}
                                data-testid="confirmation-error"
                            >
                                {state.error}
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button
                                onClick={handleCancel}
                                disabled={state.isLoading}
                                style={{
                                    padding: '10px 20px',
                                    backgroundColor: '#f3f4f6',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    color: '#374151',
                                }}
                                data-testid="confirmation-cancel"
                            >
                                {state.cancelText}
                            </button>
                            <button
                                onClick={handleConfirm}
                                disabled={state.isLoading}
                                style={{
                                    padding: '10px 20px',
                                    backgroundColor: state.variant === 'danger' ? '#dc2626' : '#d97706',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    color: 'white',
                                    opacity: state.isLoading ? 0.7 : 1,
                                }}
                                data-testid="confirmation-confirm"
                            >
                                {state.isLoading ? 'Processing...' : state.confirmText}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ConfirmationContext.Provider>
    );
};

export default ConfirmationProvider;
