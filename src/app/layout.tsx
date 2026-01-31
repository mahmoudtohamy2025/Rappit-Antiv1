'use client';

/**
 * Root Layout
 * Next.js App Router layout wrapping all pages
 */

import '../index.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../components/UI/Toast';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
            retry: 1,
        },
    },
});

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="ar" dir="rtl">
            <head>
                <title>Rappit - نظام إدارة العمليات</title>
                <meta name="description" content="نظام متكامل لإدارة الطلبات والمخزون والشحن" />
            </head>
            <body>
                <QueryClientProvider client={queryClient}>
                    <ToastProvider>
                        {children}
                    </ToastProvider>
                </QueryClientProvider>
            </body>
        </html>
    );
}
