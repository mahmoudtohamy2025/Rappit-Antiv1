# Phase 1-4 Gap Analysis - Bulk Operations

**Task ID:** GAP-13 (FINAL)  
**Priority:** P2 (Medium)  
**Est. Hours:** 4  
**Dependencies:** GAP-02 (Product CRUD) ✅  
**Status:** 🔄 In Progress

---

## Phase A+D: Planning & Design

### Problem Statement

Cannot perform bulk actions on products:
- No multi-select in product list
- No bulk status update
- No bulk category assign
- No bulk delete

---

### Business Requirements

1. **Multi-Select** - Checkbox selection
2. **Select All** - Select all visible
3. **Bulk Update Status** - Active/Inactive
4. **Bulk Assign Category** - Change category
5. **Bulk Delete** - Delete selected
6. **Progress Indicator** - Show progress

---

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/products/bulk-update` | Update multiple |
| POST | `/api/v1/products/bulk-delete` | Delete multiple |
| POST | `/api/v1/products/bulk-category` | Assign category |

---

### Files to Create

```
src/hooks/
└── useBulkOperations.ts

src/components/bulk/
├── BulkActionBar.tsx
├── BulkProgressModal.tsx
└── index.ts
```

---

## Phase B: Testing (12 tests)

1. bulkUpdate - updates products
2. bulkDelete - deletes products
3. bulkAssignCategory - assigns
4. BulkActionBar - renders actions
5. BulkActionBar - shows count
6. BulkActionBar - status dropdown
7. BulkActionBar - category dropdown
8. BulkActionBar - delete button
9. BulkProgressModal - shows progress
10. BulkProgressModal - shows errors
11. Select all works
12. Deselect all works

---

## Phase C: Implementation

- [ ] Create useBulkOperations hook
- [ ] Create BulkActionBar
- [ ] Create BulkProgressModal
- [ ] Integrate with product list
