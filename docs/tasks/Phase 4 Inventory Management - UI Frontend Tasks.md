# Phase 4: Inventory Management - UI/Frontend Task Breakdown

## Overview

This document provides a comprehensive breakdown of all UI/Frontend tasks required to support the 7 backend services completed in Phase 4. Each component is mapped to its corresponding backend feature.

---

## Design System Requirements

All components MUST follow:

| Requirement | Implementation |
|-------------|---------------|
| **Direction** | RTL (`dir="rtl"`) |
| **Language** | Arabic primary |
| **Dark Mode** | Support via `dark:` Tailwind variants |
| **Mobile** | Responsive with breakpoints (sm, md, lg, xl) |
| **Components** | Use existing `src/components/UI/*` |
| **Colors** | Use `globals.css` CSS variables |
| **Icons** | Lucide React icons |

---

## Backend Features → UI Components Mapping

### INV-01: Bulk CSV Import (105 Backend Tests)

**Backend Service:** `inventory-import.service.ts`

**Features to Support:**
- Upload CSV file with inventory data
- Parse and validate CSV rows
- Handle duplicates (skip/update mode)
- Batch processing with progress
- Error reporting with line numbers
- Download template

**UI Components:**

| Component | File | Status | Description |
|-----------|------|:------:|-------------|
| ImportCsvModal | `import/ImportCsvModal.tsx` | ✅ Done | Main modal with drag-drop, options, progress |
| ImportProgress | `import/ImportProgress.tsx` | ❌ Missing | Standalone progress indicator component |
| ImportResults | `import/ImportResults.tsx` | ❌ Missing | Success/error summary display |
| CsvTemplateDownload | `import/CsvTemplateDownload.tsx` | ❌ Missing | Template download button |
| ImportPreview | `import/ImportPreview.tsx` | ❌ Missing | Preview first 5 rows before import |

**User Flow:**

```
[استيراد CSV Button on InventoryOverview]
        │
        ▼
[ImportCsvModal]
├── Step 1: Upload File (drag-drop zone)
│   └── File validation (.csv, max 10MB)
├── Step 2: Import Options
│   ├── ☐ Update existing items
│   ├── ☐ Skip duplicates  
│   └── ☐ Validate only (dry run)
├── Step 3: Preview Data [ImportPreview]
│   └── Show first 5 rows with validation
├── Step 4: Processing [ImportProgress]
│   └── Progress bar with "جاري الاستيراد... 45 من 100"
└── Step 5: Results [ImportResults]
    ├── Success count
    ├── Updated count
    ├── Skipped count
    ├── Errors with line numbers
    └── Download error report
```

---

### INV-02: Stock Movement & Transfers (84 Backend Tests)

**Backend Service:** `stock-movement.service.ts`

**Features to Support:**
- Create movements: RECEIVE, SHIP, RETURN, TRANSFER_OUT, TRANSFER_IN, ADJUSTMENT_ADD, ADJUSTMENT_REMOVE, DAMAGE
- Execute/cancel pending movements
- Paired transfer workflow
- Negative stock prevention
- Reference linking (ORDER, PURCHASE_ORDER, etc.)
- Movement history

**UI Components:**

| Component | File | Status | Description |
|-----------|------|:------:|-------------|
| MovementPanel | `movements/MovementPanel.tsx` | ✅ Done | Main panel with stats, filters, table |
| MovementFormModal | `movements/MovementFormModal.tsx` | ✅ Done | Create movement form |
| MovementList | `movements/MovementList.tsx` | ❌ Missing | Reusable movement table |
| MovementDetails | `movements/MovementDetails.tsx` | ❌ Missing | Movement detail modal |
| MovementFilters | `movements/MovementFilters.tsx` | ❌ Missing | Filter controls component |
| TransferWizard | `movements/TransferWizard.tsx` | ❌ Missing | Multi-step transfer wizard |
| MovementTypeBadge | `movements/MovementTypeBadge.tsx` | ❌ Missing | Colored type badge |

**Movement Types Configuration:**

| Type | Arabic | Icon | Direction | Color |
|------|--------|------|-----------|-------|
| RECEIVE | استلام | PackagePlus | Inbound | Green |
| SHIP | شحن | Truck | Outbound | Blue |
| RETURN | إرجاع | RotateCcw | Inbound | Orange |
| TRANSFER_OUT | تحويل صادر | ArrowRight | Outbound | Purple |
| TRANSFER_IN | تحويل وارد | ArrowLeft | Inbound | Purple |
| ADJUSTMENT_ADD | تعديل (+) | Plus | Inbound | Green |
| ADJUSTMENT_REMOVE | تعديل (-) | Minus | Outbound | Red |
| DAMAGE | تالف | AlertTriangle | Outbound | Red |

**User Flow:**

```
[Tab: الحركات]
        │
        ▼
[MovementPanel]
├── Stats Cards (total, pending, today, completed)
├── [MovementFilters] - type, status, date range
├── [+ حركة جديدة] → Opens MovementFormModal
│   ├── Movement type dropdown
│   ├── Warehouse selector
│   ├── SKU autocomplete
│   ├── Quantity input
│   ├── Reason (required)
│   └── Reference (optional)
├── [MovementList]
│   ├── Type badge with icon
│   ├── Product info (name, SKU)
│   ├── Quantity (+/-)
│   ├── Warehouse
│   ├── Status badge
│   ├── Date
│   └── Actions (Execute, Cancel, View)
└── Click row → [MovementDetails] modal
```

---

### INV-03: Cycle Count / Bulk Update (114 Backend Tests)

**Backend Service:** `cycle-count.service.ts`

**Features to Support:**
- Create cycle count session
- Select warehouse and optional SKUs
- Enter physical counts
- Calculate variances
- Approval workflow (variance thresholds)
- Apply adjustments

**UI Components:**

| Component | File | Status | Description |
|-----------|------|:------:|-------------|
| CycleCountPanel | `cycle-count/CycleCountPanel.tsx` | ✅ Done | Main panel with list |
| CycleCountWizard | `cycle-count/CycleCountWizard.tsx` | ❌ Missing | Create cycle count wizard |
| CycleCountList | `cycle-count/CycleCountList.tsx` | ❌ Missing | List of cycle counts |
| CountEntryForm | `cycle-count/CountEntryForm.tsx` | ❌ Missing | Enter counts for items |
| VarianceReport | `cycle-count/VarianceReport.tsx` | ❌ Missing | Variance display |
| ApprovalQueue | `cycle-count/ApprovalQueue.tsx` | ❌ Missing | Items needing approval |
| CycleCountDetails | `cycle-count/CycleCountDetails.tsx` | ❌ Missing | Detail view |

**User Flow:**

```
[Tab: الجرد]
        │
        ▼
[CycleCountPanel]
├── Stats Cards (total, active, pending approval, variances)
├── [+ جرد جديد] → Opens CycleCountWizard
│   ├── Step 1: Select warehouse
│   ├── Step 2: Select SKUs (optional, or all)
│   ├── Step 3: Set name, due date, assignee
│   └── Create
├── [CycleCountList] - cards with progress bars
│   ├── Name and warehouse
│   ├── Status badge
│   ├── Progress: 45/100 counted
│   ├── Variance items count
│   └── Actions (Start, Continue, Review)
└── Click → [CountEntryForm]
    ├── SKU, Name, System Qty
    ├── Input: Counted Qty
    ├── Auto-calculated variance
    └── Submit → [VarianceReport]
        ├── Summary stats
        ├── Items needing approval
        └── [Approve All] [Apply Adjustments]
```

---

### INV-04: Inventory Validation Rules (57 Backend Tests)

**Backend Service:** `inventory-validation.service.ts`

**Features to Support:**
- Built-in validation rules (SKU format, quantity, warehouse)
- Custom rule creation
- Rule enable/disable
- Rule testing with sample data
- Validation on import and movement

**UI Components:**

| Component | File | Status | Description |
|-----------|------|:------:|-------------|
| ValidationRulesPanel | `validation/ValidationRulesPanel.tsx` | ❌ Missing | Main settings panel |
| RuleList | `validation/RuleList.tsx` | ❌ Missing | List of rules |
| RuleEditor | `validation/RuleEditor.tsx` | ❌ Missing | Create/edit rule form |
| RuleToggle | `validation/RuleToggle.tsx` | ❌ Missing | Enable/disable switch |
| ValidationPreview | `validation/ValidationPreview.tsx` | ❌ Missing | Test rule with data |

**Location:** Settings page → Validation Rules section

**User Flow:**

```
[Settings → قواعد التحقق]
        │
        ▼
[ValidationRulesPanel]
├── Built-in Rules (read-only toggle only)
│   ├── ☑ SKU Format - تنسيق رمز المنتج
│   ├── ☑ Quantity Non-Negative - كمية غير سالبة
│   └── ☑ Warehouse Required - المستودع مطلوب
├── Custom Rules
│   ├── [+ قاعدة جديدة] → [RuleEditor]
│   │   ├── اسم القاعدة
│   │   ├── نوع التحقق (format, range, required, regex)
│   │   ├── الحقل
│   │   ├── النمط/النطاق
│   │   └── رسالة الخطأ (Arabic)
│   └── List of custom rules with edit/delete
└── [ValidationPreview]
    ├── Enter sample data
    └── Show pass/fail result
```

---

### INV-05: Force Release Reservation (87 Backend Tests)

**Backend Service:** `force-release.service.ts`

**Features to Support:**
- View stuck reservations (older than 30 min)
- Single force release with reason
- Batch force release
- Release reason codes
- Audit trail of releases

**UI Components:**

| Component | File | Status | Description |
|-----------|------|:------:|-------------|
| ForceReleasePanel | `force-release/ForceReleasePanel.tsx` | ❌ Missing | Main panel |
| StuckReservationList | `force-release/StuckReservationList.tsx` | ❌ Missing | List stuck items |
| ReleaseModal | `force-release/ReleaseModal.tsx` | ❌ Missing | Single release dialog |
| BatchReleaseModal | `force-release/BatchReleaseModal.tsx` | ❌ Missing | Batch release dialog |
| ReleaseHistory | `force-release/ReleaseHistory.tsx` | ❌ Missing | Audit of releases |
| ReasonCodeSelect | `force-release/ReasonCodeSelect.tsx` | ❌ Missing | Reason dropdown |

**Reason Codes:**

| Code | Arabic |
|------|--------|
| STUCK_ORDER | طلب معلق |
| ORDER_CANCELLED | طلب ملغي |
| EXPIRED | منتهي الصلاحية |
| DUPLICATE | مكرر |
| ADMIN_OVERRIDE | تجاوز إداري |
| SYSTEM_RECOVERY | استعادة النظام |

**User Flow:**

```
[Tab: المخزون → Filter: Reservations]
        │
        ▼
[ForceReleasePanel]
├── Alert: X حجوزات معلقة تحتاج انتباه
├── [StuckReservationList]
│   ├── Filter: Show stuck only (> 30 min)
│   ├── SKU, Product Name, Quantity
│   ├── Order reference
│   ├── Age (e.g., "45 دقيقة")
│   ├── [🔓 إطلاق] → [ReleaseModal]
│   │   ├── Reason code dropdown
│   │   ├── Notes textarea
│   │   ├── ☐ Notify order owner
│   │   └── [تأكيد الإطلاق]
│   └── Checkbox for batch select
├── [إطلاق المحدد] → [BatchReleaseModal]
│   ├── Show count: "سيتم إطلاق 5 حجوزات"
│   ├── Reason code (applies to all)
│   └── Confirm
└── [ReleaseHistory] - Recent releases audit
```

---

### INV-06: Transfer Reservation Request (89 Backend Tests)

**Backend Service:** `transfer-reservation.service.ts`

**Features to Support:**
- Create transfer request
- Transfer types: IMMEDIATE, PENDING, SCHEDULED
- Priority levels: LOW, NORMAL, HIGH, URGENT
- Approval workflow
- Transfer status tracking

**UI Components:**

| Component | File | Status | Description |
|-----------|------|:------:|-------------|
| TransferPanel | `transfers/TransferPanel.tsx` | ✅ Done | Main panel with approval alert |
| TransferFormModal | `transfers/TransferFormModal.tsx` | ✅ Done | Create transfer form |
| TransferApprovalQueue | `transfers/TransferApprovalQueue.tsx` | ❌ Missing | Pending approvals list |
| TransferStatusBadge | `transfers/TransferStatusBadge.tsx` | ❌ Missing | Status badge component |
| TransferDetails | `transfers/TransferDetails.tsx` | ❌ Missing | Transfer detail view |
| TransferTimeline | `transfers/TransferTimeline.tsx` | ❌ Missing | Status timeline |

**Status Configuration:**

| Status | Arabic | Color |
|--------|--------|-------|
| PENDING | قيد الانتظار | Yellow |
| APPROVED | تمت الموافقة | Blue |
| IN_TRANSIT | قيد التحويل | Purple |
| COMPLETED | مكتمل | Green |
| REJECTED | مرفوض | Red |
| CANCELLED | ملغي | Gray |

**Priority Configuration:**

| Priority | Arabic | Color |
|----------|--------|-------|
| LOW | عادي | Gray |
| NORMAL | متوسط | Blue |
| HIGH | عالي | Orange |
| URGENT | عاجل | Red |

**User Flow:**

```
[Tab: التحويلات]
        │
        ▼
[TransferPanel]
├── Pending Approval Alert (if any)
│   └── "X طلبات تحويل تنتظر الموافقة"
├── Stats Cards (total, pending, in_transit, completed)
├── [+ طلب تحويل] → [TransferFormModal]
│   ├── Source warehouse
│   ├── Target warehouse
│   ├── SKU + Quantity
│   ├── Transfer type (IMMEDIATE, PENDING, SCHEDULED)
│   ├── Priority (LOW, NORMAL, HIGH, URGENT)
│   ├── Scheduled date (if SCHEDULED)
│   └── Reason
├── Transfer list with [TransferStatusBadge]
├── Click row → [TransferDetails]
│   ├── Full transfer info
│   ├── [TransferTimeline] showing status history
│   └── Actions (Approve, Reject, Cancel)
└── [TransferApprovalQueue] (for PENDING items)
    ├── List items needing approval
    └── Quick approve/reject buttons
```

---

### INV-07: Inventory Audit Trail (90 Backend Tests)

**Backend Service:** `inventory-audit.service.ts`

**Features to Support:**
- Log all inventory changes
- Filter by date, SKU, user, action type
- Show variance (previous → new)
- Export to CSV/JSON
- Query performance

**UI Components:**

| Component | File | Status | Description |
|-----------|------|:------:|-------------|
| AuditTrailPanel | `audit/AuditTrailPanel.tsx` | ✅ Done | Main panel with table |
| AuditLogTable | `audit/AuditLogTable.tsx` | ❌ Missing | Reusable table component |
| AuditFilters | `audit/AuditFilters.tsx` | ❌ Missing | Filter controls |
| AuditSummary | `audit/AuditSummary.tsx` | ❌ Missing | Stats cards |
| AuditExport | `audit/AuditExport.tsx` | ❌ Missing | Export buttons |
| AuditEntryDetails | `audit/AuditEntryDetails.tsx` | ❌ Missing | Entry detail modal |

**Action Type Configuration:**

| Action | Arabic | Icon | Color |
|--------|--------|------|-------|
| CREATE | إنشاء | Plus | Green |
| UPDATE | تحديث | Edit | Blue |
| DELETE | حذف | Trash | Red |
| ADJUSTMENT | تعديل | Sliders | Orange |
| IMPORT | استيراد | Upload | Purple |
| CYCLE_COUNT | جرد | ClipboardCheck | Cyan |
| FORCE_RELEASE | إطلاق قسري | Unlock | Yellow |
| TRANSFER | تحويل | ArrowLeftRight | Indigo |

**User Flow:**

```
[Tab: السجل]
        │
        ▼
[AuditTrailPanel]
├── [AuditFilters]
│   ├── Date range picker
│   ├── SKU autocomplete
│   ├── User dropdown
│   ├── Action type multi-select
│   └── Warehouse dropdown
├── [AuditSummary]
│   ├── Total Changes: 1,234
│   ├── Net Variance: +567
│   ├── Positive: 890
│   └── Negative: 323
├── [AuditExport]
│   ├── [📥 تصدير CSV]
│   └── [📥 تصدير JSON]
├── [AuditLogTable]
│   ├── Timestamp
│   ├── Action type badge
│   ├── Product (name + SKU)
│   ├── Change: 95 → 100 (+5)
│   ├── Warehouse
│   ├── User
│   └── Click row → [AuditEntryDetails]
└── Pagination
```

---

## Main Layout Components

| Component | File | Status | Description |
|-----------|------|:------:|-------------|
| InventoryTabs | `InventoryTabs.tsx` | ✅ Done | Main tabbed layout (5 tabs) |
| InventoryOverview | `InventoryOverview.tsx` | ✅ Done | Inventory list + stats |
| index.ts | `index.ts` | ✅ Done | Barrel exports |

**Tab Configuration:**

| Tab | Arabic | Component |
|-----|--------|-----------|
| overview | المخزون | InventoryOverview |
| movements | الحركات | MovementPanel |
| transfers | التحويلات | TransferPanel |
| cycle-count | الجرد | CycleCountPanel |
| audit | السجل | AuditTrailPanel |

---

## API Hooks (All Missing)

| Hook | File | Backend Service |
|------|------|-----------------|
| useInventoryImport | `hooks/useInventoryImport.ts` | inventory-import.service.ts |
| useStockMovements | `hooks/useStockMovements.ts` | stock-movement.service.ts |
| useCycleCount | `hooks/useCycleCount.ts` | cycle-count.service.ts |
| useValidationRules | `hooks/useValidationRules.ts` | inventory-validation.service.ts |
| useForceRelease | `hooks/useForceRelease.ts` | force-release.service.ts |
| useTransferRequests | `hooks/useTransferRequests.ts` | transfer-reservation.service.ts |
| useAuditTrail | `hooks/useAuditTrail.ts` | inventory-audit.service.ts |

---

## Summary

### Components by Status

| Status | Count | Components |
|--------|:-----:|------------|
| ✅ Done | 10 | InventoryTabs, InventoryOverview, index.ts, ImportCsvModal, MovementPanel, MovementFormModal, TransferPanel, TransferFormModal, CycleCountPanel, AuditTrailPanel |
| ❌ Missing | 36 | See detailed list above |

### Missing by Category

| Category | Missing Count |
|----------|:-------------:|
| Import | 4 |
| Movements | 5 |
| Cycle Count | 6 |
| **Validation** | **5** |
| **Force Release** | **6** |
| Transfers | 4 |
| Audit | 5 |
| **Hooks** | **7** |
| **TOTAL** | **42** |

---

## Implementation Priority

| Priority | Component Group | Effort |
|:--------:|-----------------|--------|
| 1 | Force Release (entire folder missing) | 1 day |
| 2 | Validation Rules (entire folder missing) | 1 day |
| 3 | Cycle Count (wizard, entry, variance) | 1.5 days |
| 4 | Movements (details, filters, transfer wizard) | 1 day |
| 5 | Transfers (approval queue, details, timeline) | 1 day |
| 6 | Audit (filters, summary, export, details) | 0.5 day |
| 7 | Import (progress, results, preview) | 0.5 day |
| 8 | API Hooks | 1 day |

**Total Estimated: ~7.5 days**

---

*Document Version: 1.0*
*Last Updated: 2026-01-02*
*Backend Tests: 626 passing*
