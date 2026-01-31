/**
 * Audit Export Component
 * Export buttons for audit trail
 * 
 * Part of: UI-INV-07 (Backend: inventory-audit.service.ts)
 */

import { Download, FileText, FileJson } from 'lucide-react';
import { Button } from '../../UI/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '../../UI/dropdown-menu';

interface AuditExportProps {
    onExportCsv: () => void;
    onExportJson: () => void;
}

export function AuditExport({ onExportCsv, onExportJson }: AuditExportProps) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                    <Download className="w-4 h-4" />
                    تصدير
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onExportCsv} className="gap-2">
                    <FileText className="w-4 h-4" />
                    تصدير CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onExportJson} className="gap-2">
                    <FileJson className="w-4 h-4" />
                    تصدير JSON
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
