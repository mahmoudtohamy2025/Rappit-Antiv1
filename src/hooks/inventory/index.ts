/**
 * Inventory Hooks - Main Barrel Export
 * 
 * Phase 4: API hooks connecting UI to backend services
 * Backend: 626 tests across 7 services
 */

// INV-01: Import Hook
export { useInventoryImport } from './useInventoryImport';

// INV-02: Stock Movements Hook
export { useStockMovements } from './useStockMovements';

// INV-03: Cycle Count Hook
export { useCycleCount } from './useCycleCount';

// INV-04: Validation Rules Hook
export { useValidationRules } from './useValidationRules';

// INV-05: Force Release Hook
export { useForceRelease } from './useForceRelease';

// INV-06: Transfer Requests Hook
export { useTransferRequests } from './useTransferRequests';

// INV-07: Audit Trail Hook
export { useAuditTrail } from './useAuditTrail';
