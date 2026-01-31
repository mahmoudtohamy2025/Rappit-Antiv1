'use client';

/**
 * Inventory Page
 * Main entry point for Phase 4 Inventory Management
 * 
 * Features:
 * - Tabbed navigation (المخزون | الحركات | التحويلات | الجرد | السجل)
 * - Full RTL Arabic support
 * - Dark mode compatible
 * - Mobile responsive
 */

import { InventoryTabs } from '@/components/inventory';

export default function InventoryPage() {
  return <InventoryTabs />;
}
