# Phase 1-4 Gap Analysis - Enhanced Filters

**Task ID:** GAP-05  
**Priority:** P1 (High)  
**Est. Hours:** 10  
**Dependencies:** GAP-01 (Warehouse CRUD) ✅  
**Status:** 🔄 In Progress

---

## Phase A+D: Planning & Design

### Problem Statement

Filter components need enhancement across inventory panels:
- No unified filter component
- Missing warehouse filter in some panels
- No category filter
- No date range picker
- No stock level filter (low/out/normal)
- No "clear all filters" button
- Active filters not shown as badges

---

### Business Requirements

#### Core Features
1. **Unified Filter Component** - Reusable across all panels
2. **Warehouse Filter** - Dropdown with all warehouses
3. **Category Filter** - Dropdown with product categories
4. **Stock Level Filter** - Low/Out/Normal/All
5. **Date Range Picker** - Start/end date selection
6. **Active Filter Badges** - Show applied filters
7. **Clear Filters Button** - Reset all at once

#### Supported Panels
- InventoryOverview
- MovementPanel
- TransferPanel
- CycleCountPanel
- AuditTrailPanel
- Product List

---

### API Design

#### Filter Queries

All list endpoints should support these query parameters:

```typescript
// Common filter params
interface CommonFilters {
  warehouseId?: string;
  category?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

// Inventory-specific
interface InventoryFilters extends CommonFilters {
  stockLevel?: 'low' | 'out' | 'normal' | 'all';
}

// Movement-specific
interface MovementFilters extends CommonFilters {
  type?: 'IN' | 'OUT' | 'ADJUSTMENT' | 'TRANSFER';
  status?: 'PENDING' | 'COMPLETED' | 'CANCELLED';
}

// Transfer-specific
interface TransferFilters extends CommonFilters {
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'IN_TRANSIT' | 'COMPLETED';
  fromWarehouseId?: string;
  toWarehouseId?: string;
}
```

#### Filter Counts Endpoint

```typescript
// GET /api/v1/inventory/filter-counts
interface FilterCounts {
  byWarehouse: { warehouseId: string; warehouseName: string; count: number }[];
  byCategory: { category: string; count: number }[];
  byStockLevel: { level: string; count: number }[];
  total: number;
}
```

---

### Files to Create/Modify

#### New Components
```
src/components/filters/
├── InventoryFilters.tsx      # Main filter component
├── DateRangePicker.tsx       # Date range selection
├── ActiveFilterBadges.tsx    # Shows applied filters
├── FilterPresets.tsx         # Saved filter presets
└── index.ts
```

#### Components to Modify
```
src/components/inventory/
├── InventoryOverview.tsx     # Add InventoryFilters
├── movements/MovementPanel.tsx
├── transfers/TransferPanel.tsx
├── cycle-count/CycleCountPanel.tsx
└── audit/AuditTrailPanel.tsx
```

#### Hooks
```
src/hooks/
└── useFilters.ts             # Filter state management
```

---

## Phase B: Testing (Write First!)

### Unit Tests Target: 20

#### InventoryFilters Component Tests
1. renders all filter controls
2. warehouse dropdown shows all warehouses
3. category dropdown shows all categories
4. stock level toggles work
5. date range picker opens/closes
6. clear filters resets all

#### useFilters Hook Tests
7. initial state is empty
8. setWarehouse updates state
9. setCategory updates state
10. setStockLevel updates state
11. setDateRange updates state
12. clearFilters resets all
13. hasActiveFilters returns true when set
14. getActiveFilterCount returns correct count

#### ActiveFilterBadges Tests
15. shows no badges when filters empty
16. shows warehouse badge when set
17. shows category badge when set
18. shows date range badge when set
19. clicking X removes filter
20. shows correct count

---

## Phase C: Implementation Checklist

### Core Components
- [ ] Create useFilters hook
- [ ] Create InventoryFilters component
- [ ] Create DateRangePicker component
- [ ] Create ActiveFilterBadges component
- [ ] Create barrel export

### Wire to Panels
- [ ] Add InventoryFilters to InventoryOverview
- [ ] Add filters to MovementPanel
- [ ] Add filters to TransferPanel
- [ ] Add filters to CycleCountPanel
- [ ] Add filters to AuditTrailPanel

### Backend Support
- [ ] Verify filter params work on all endpoints
- [ ] Add filter-counts endpoint if needed

---

## Verification Checklist

- [ ] All 20 unit tests pass
- [ ] Can filter by warehouse
- [ ] Can filter by category
- [ ] Can filter by stock level
- [ ] Can filter by date range
- [ ] Active filters shown as badges
- [ ] Clear filters works
- [ ] Filters combine correctly
- [ ] RTL Arabic layout correct
- [ ] Mobile responsive
- [ ] Dark mode supported
