'use client';

/**
 * Root Page
 * Main entry point - wraps the App component
 */

import { useState } from 'react';
import { LoginPage } from '@/components/LoginPage';
import LandingPage from '@/components/LandingPage';
import { TopBar } from '@/components/TopBar';
import { Sidebar } from '@/components/Sidebar';
import OrdersPage from '@/app/orders/page';
import OrderDetailPage from '@/app/orders/[id]/page';
import InventoryPage from '@/app/inventory/page';
import ChannelsPage from '@/app/channels/page';
import ShippingPage from '@/app/shipping/page';
import SettingsPage from '@/app/settings/page';

type Page = 'orders' | 'order-detail' | 'inventory' | 'channels' | 'shipping' | 'settings';

export default function HomePage() {
    const [showLanding, setShowLanding] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [currentPage, setCurrentPage] = useState<Page>('orders');
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [currentOrg, setCurrentOrg] = useState('متجر الإلكترونيات الذكية');

    // Show landing page first (marketing page)
    if (showLanding && !isAuthenticated) {
        return <LandingPage onRequestAccess={() => setShowLanding(false)} />;
    }

    // Show login page when user clicks "Request access"
    if (!isAuthenticated) {
        return <LoginPage onLogin={() => setIsAuthenticated(true)} />;
    }

    const handleOrderClick = (orderId: string) => {
        setSelectedOrderId(orderId);
        setCurrentPage('order-detail');
    };

    const handleBackToOrders = () => {
        setSelectedOrderId(null);
        setCurrentPage('orders');
    };

    const renderPage = () => {
        switch (currentPage) {
            case 'orders':
                return <OrdersPage onOrderClick={handleOrderClick} />;
            case 'order-detail':
                return selectedOrderId ? (
                    <OrderDetailPage orderId={selectedOrderId} onBack={handleBackToOrders} />
                ) : (
                    <OrdersPage onOrderClick={handleOrderClick} />
                );
            case 'inventory':
                return <InventoryPage />;
            case 'channels':
                return <ChannelsPage />;
            case 'shipping':
                return <ShippingPage />;
            case 'settings':
                return <SettingsPage />;
            default:
                return <OrdersPage onOrderClick={handleOrderClick} />;
        }
    };

    return (
        <div className="min-h-screen bg-gray-50" dir="rtl">
            <TopBar
                currentOrg={currentOrg}
                onOrgChange={setCurrentOrg}
                onLogout={() => setIsAuthenticated(false)}
            />
            <div className="flex">
                <Sidebar
                    currentPage={currentPage === 'order-detail' ? 'orders' : currentPage}
                    onPageChange={(page) => {
                        setCurrentPage(page);
                        setSelectedOrderId(null);
                    }}
                />
                <main className="flex-1 p-6 mr-64 mt-16">
                    {renderPage()}
                </main>
            </div>
        </div>
    );
}
