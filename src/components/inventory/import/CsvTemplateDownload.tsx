/**
 * CSV Template Download Component
 * Download link for CSV import templates
 * 
 * Part of: UI-INV-01 (Backend: inventory-import.service.ts)
 */

import { Download, FileText } from 'lucide-react';
import { Button } from '../../UI/button';

interface CsvTemplateDownloadProps {
    variant?: 'button' | 'link';
}

export function CsvTemplateDownload({ variant = 'link' }: CsvTemplateDownloadProps) {
    const handleDownload = () => {
        // CSV template content
        const headers = ['SKU', 'ProductName', 'Quantity', 'Warehouse', 'MinStock', 'MaxStock', 'Category'];
        const sampleRow = ['ELEC-001', 'سماعة لاسلكية', '50', 'مستودع الرياض', '10', '500', 'إلكترونيات'];

        const csvContent = [
            headers.join(','),
            sampleRow.join(','),
        ].join('\n');

        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'inventory_import_template.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    if (variant === 'button') {
        return (
            <Button variant="outline" onClick={handleDownload} className="gap-2">
                <Download className="w-4 h-4" />
                تحميل القالب
            </Button>
        );
    }

    return (
        <button
            onClick={handleDownload}
            className="flex items-center gap-1 text-sm text-primary hover:underline"
        >
            <FileText className="w-4 h-4" />
            تحميل قالب CSV
        </button>
    );
}
