/**
 * Export Button Component
 * Reusable export button with dropdown options
 * 
 * Part of: GAP-04 Export Functionality
 */

import { useState } from 'react';
import { Download, FileSpreadsheet, FileJson, Loader2 } from 'lucide-react';
import { Button } from '../UI/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '../UI/dropdown-menu';
import { ExportFormat } from '../../hooks/useExport';

interface ExportButtonProps {
    onExport: (format: ExportFormat) => Promise<void>;
    isLoading?: boolean;
    label?: string;
    showFormatOptions?: boolean;
    className?: string;
}

export function ExportButton({
    onExport,
    isLoading = false,
    label = 'تصدير',
    showFormatOptions = true,
    className = '',
}: ExportButtonProps) {
    const [isExporting, setIsExporting] = useState(false);

    const handleExport = async (format: ExportFormat) => {
        setIsExporting(true);
        try {
            await onExport(format);
        } finally {
            setIsExporting(false);
        }
    };

    const loading = isLoading || isExporting;

    if (!showFormatOptions) {
        return (
            <Button
                variant="outline"
                onClick={() => handleExport('csv')}
                disabled={loading}
                className={`gap-2 ${className}`}
            >
                {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                    <Download className="w-4 h-4" />
                )}
                {label}
            </Button>
        );
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="outline"
                    disabled={loading}
                    className={`gap-2 ${className}`}
                >
                    {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Download className="w-4 h-4" />
                    )}
                    {label}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" dir="rtl">
                <DropdownMenuItem
                    onClick={() => handleExport('csv')}
                    className="gap-2"
                >
                    <FileSpreadsheet className="w-4 h-4" />
                    تصدير كـ CSV
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={() => handleExport('json')}
                    className="gap-2"
                >
                    <FileJson className="w-4 h-4" />
                    تصدير كـ JSON
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
