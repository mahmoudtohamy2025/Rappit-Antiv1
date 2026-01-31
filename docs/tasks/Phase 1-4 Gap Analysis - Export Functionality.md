# Phase 1-4 Gap Analysis - Export Functionality

**Task ID:** GAP-04  
**Priority:** P1 (High)  
**Est. Hours:** 8  
**Dependencies:** GAP-03 (Wire API Hooks) ✅  
**Status:** 🔄 In Progress

---

## Phase A+D: Planning & Design

### Problem Statement

Users cannot export data from the system:
- No inventory export to CSV/Excel
- No movement history export
- No cycle count report export
- No audit trail export
- No orders export

Export is critical for reporting, backup, and integration with external systems.

---

### Business Requirements

#### Core Features
1. **Inventory Export** - Export product/SKU list with stock levels
2. **Movements Export** - Export stock movement history
3. **Cycle Count Export** - Export cycle count reports with variances
4. **Audit Trail Export** - Export audit logs
5. **Orders Export** - Export order list

#### Export Formats
- CSV (UTF-8 with BOM for Excel compatibility)
- JSON (for API integrations)

#### Business Rules
- Respect current filters when exporting
- Include date range in filename
- Arabic content supported (UTF-8)
- Maximum 10,000 rows per export

---

### API Design

#### Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/inventory/export` | Export inventory CSV | All |
| GET | `/api/v1/inventory/movements/export` | Export movements CSV | All |
| GET | `/api/v1/inventory/cycle-counts/:id/export` | Export cycle count report | All |
| GET | `/api/v1/inventory/audit/export` | Export audit trail | ADMIN, MANAGER |
| GET | `/api/v1/orders/export` | Export orders CSV | All |

#### Query Parameters

```typescript
// Common export params
interface ExportParams {
  format?: 'csv' | 'json';
  warehouseId?: string;
  startDate?: string;
  endDate?: string;
  // Plus entity-specific filters
}

// Response headers
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="inventory_2026-01-03.csv"
```

---

### Files to Create/Modify

#### Backend
```
src/modules/export/
├── export.service.ts        # Core export logic
├── export.controller.ts     # Export endpoints
├── export.module.ts         # Module
├── csv-generator.ts         # CSV generation utility
└── export.service.spec.ts   # Tests
```

#### Frontend
```
src/hooks/
└── useExport.ts             # Export hook

src/components/export/
├── ExportButton.tsx         # Reusable export button
├── ExportModal.tsx          # Export options modal
└── index.ts
```

#### Wiring
```
src/components/inventory/
├── InventoryOverview.tsx    # Add export button
├── movements/MovementPanel.tsx
├── audit/AuditTrailPanel.tsx
└── cycle-count/CycleCountPanel.tsx
```

---

## Phase B: Testing (Write First!)

### Unit Tests Target: 25

#### ExportService Tests
1. exportInventory - returns CSV
2. exportInventory - applies warehouse filter
3. exportInventory - applies date filter
4. exportInventory - includes stock levels
5. exportMovements - returns CSV
6. exportMovements - applies type filter
7. exportMovements - applies status filter
8. exportCycleCount - returns variance data
9. exportCycleCount - not found error
10. exportAudit - returns audit logs
11. exportAudit - respects permissions
12. exportOrders - returns orders CSV

#### CSV Generation Tests
13. generateCsv - correct headers
14. generateCsv - correct row count
15. generateCsv - handles Arabic text
16. generateCsv - adds BOM for Excel
17. generateCsv - escapes commas
18. generateCsv - escapes quotes
19. generateCsv - handles null values

#### useExport Hook Tests
20. downloadCsv - triggers download
21. downloadJson - triggers download
22. isLoading state works
23. error handling

#### ExportButton/Modal Tests
24. renders export button
25. modal shows format options

---

## Phase C: Implementation Checklist

### Backend
- [ ] Create export.service.ts
- [ ] Create export.controller.ts
- [ ] Create export.module.ts
- [ ] Create csv-generator.ts utility
- [ ] Add inventory export endpoint
- [ ] Add movements export endpoint
- [ ] Add cycle count export endpoint
- [ ] Add audit export endpoint

### Frontend
- [ ] Create useExport hook
- [ ] Create ExportButton component
- [ ] Create ExportModal component
- [ ] Add export to InventoryOverview
- [ ] Add export to MovementPanel
- [ ] Add export to AuditTrailPanel
- [ ] Add export to CycleCountPanel

---

## Verification Checklist

- [ ] All 25 unit tests pass
- [ ] Can export inventory as CSV
- [ ] Can export movements as CSV
- [ ] Can export cycle count report
- [ ] Can export audit trail
- [ ] Filters applied to export
- [ ] Arabic text displays correctly in Excel
- [ ] RTL Arabic layout correct
- [ ] Download triggers automatically
