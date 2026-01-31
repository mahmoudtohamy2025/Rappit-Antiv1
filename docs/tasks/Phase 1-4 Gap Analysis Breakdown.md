# Phase 1-4 Gap Analysis Breakdown

**Total Gaps:** 20  
**Estimated Effort:** 159 hours  
**Priority Levels:** P0 (Critical) → P3 (Nice to Have)

---

## 🚀 Execution Order (Priority + Dependencies)

> **IMPORTANT:** Each task MUST follow the **A+D, B, C** phases:
> - **Phase A+D:** Planning & Design (create task breakdown doc)
> - **Phase B:** Write tests FIRST (TDD approach)
> - **Phase C:** Implementation
> 
> **Testing Requirement:** Each task must pass comprehensive tests before moving to the next.
> No approval needed - proceed through all phases autonomously.

### Sprint 1: Foundation (Critical Path)

| Order | Gap ID | Task | Est. | Deps | Status |
|:-----:|--------|------|:----:|------|:------:|
| 1 | GAP-01 | Warehouse CRUD | 12h | None | ✅ Done |
| 2 | GAP-02 | Product/SKU CRUD | 14h | GAP-01 | ✅ Done |
| 3 | GAP-20 | Multi-Currency | 6h | None | ✅ Done |
| 4 | GAP-10 | Org Settings | 6h | GAP-20 | ✅ Done |

### Sprint 2: API Integration

| Order | Gap ID | Task | Est. | Deps | Status |
|:-----:|--------|------|:----:|------|:------:|
| 5 | GAP-03 | Wire API Hooks | 16h | GAP-01, GAP-02 | ✅ Done |
| 6 | GAP-07 | Import CSV | 6h | GAP-03 | ✅ Done |
| 7 | GAP-05 | Enhanced Filters | 10h | GAP-01 | ✅ Done |

### Sprint 3: Inventory Operations

| Order | Gap ID | Task | Est. | Deps | Status |
|:-----:|--------|------|:----:|------|:------:|
| 8 | GAP-04 | Export Functionality | 8h | GAP-03 | ✅ Done |
| 9 | GAP-06 | Force Release UI | 6h | GAP-03 | ✅ Done |
| 10 | GAP-08 | Orders Enhancements | 10h | None | ✅ Done |

### Sprint 4: Platform Admin

| Order | Gap ID | Task | Est. | Deps | Status |
|:-----:|--------|------|:----:|------|:------:|
| 11 | GAP-14 | Admin Platform Dashboard | 10h | None | ✅ Done |
| 12 | GAP-15 | Subscription Tiers | 8h | GAP-14 | ✅ Done |
| 13 | GAP-16 | Billing Page | 8h | GAP-15 | ✅ Done |
| 14 | GAP-17 | Subscription TopBar | 3h | GAP-16 | ✅ Done |

### Sprint 5: Integrations

| Order | Gap ID | Task | Est. | Deps | Status |
|:-----:|--------|------|:----:|------|:------:|
| 15 | GAP-18 | Channel OAuth | 8h | None | ✅ Done |
| 16 | GAP-19 | Order Sync UI | 6h | GAP-18 | ✅ Done |
| 17 | GAP-09 | User Management | 8h | None | ✅ Done |
| 18 | GAP-21 | Shipping Carrier Connect | 8h | None | ✅ Done |
| 19 | GAP-22 | Email Service | 6h | None | ✅ Done |

### Sprint 6: Polish

| Order | Gap ID | Task | Est. | Deps | Status |
|:-----:|--------|------|:----:|------|:------:|
| 18 | GAP-12 | Dashboard Analytics | 6h | Multiple | ✅ Done |
| 19 | GAP-11 | Filter Presets | 4h | GAP-05 | ✅ Done |
| 20 | GAP-13 | Bulk Operations | 4h | GAP-02 | ✅ Done |

---

## Dependency Graph

```
Independent (Start Anytime):
├── GAP-01 ✅ Warehouse CRUD
├── GAP-20 Multi-Currency
├── GAP-08 Orders Enhancements
├── GAP-14 Admin Dashboard
├── GAP-18 Channel OAuth
└── GAP-09 User Management

Chain 1 (Core Inventory):
GAP-01 → GAP-02 → GAP-03 → GAP-04
                       ↓
                  GAP-06, GAP-07

Chain 2 (Filters):
GAP-01 → GAP-05 → GAP-11

Chain 3 (Settings):
GAP-20 → GAP-10

Chain 4 (Admin/Billing):
GAP-14 → GAP-15 → GAP-16 → GAP-17

Chain 5 (Channels):
GAP-18 → GAP-19

Chain 6 (Products):
GAP-02 → GAP-13
```

---

## Task Implementation Template

Each task document (`Phase 1-4 Gap Analysis - [Task Name].md`) must include:

### Phase A+D: Planning & Design
1. Problem Statement
2. Business Requirements
3. API Design (endpoints, DTOs)
4. Database Changes (if any)
5. UI Mockup Description
6. Files to Create/Modify

### Phase B: Testing (Write First!)
1. Unit Tests (target: 20-30 per feature)
2. Integration Tests (target: 10-15)
3. Test Coverage Requirements: >80%

### Phase C: Implementation
1. Backend Implementation
2. Frontend Implementation
3. Wiring (connect UI to API)
4. Manual Verification Steps

### Verification Checklist (Before Moving On)
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Manual testing completed
- [ ] No console errors
- [ ] RTL Arabic layout correct
- [ ] Mobile responsive
- [ ] Dark mode supported

---

## P0: Critical (Do First) — 40-60 hours

### GAP-01: Warehouse Management CRUD
**Est:** 12 hours | **Deps:** None

#### Backend Tasks
- [ ] **GAP-01.1** Create `warehouse.service.ts`
  - `createWarehouse(dto)`, `updateWarehouse(id, dto)`, `deleteWarehouse(id)`
  - `getWarehouses(filters)`, `getWarehouseById(id)`
  - Validation: unique name per org, capacity limits
- [ ] **GAP-01.2** Create `warehouse.controller.ts`
  - `POST /api/v1/warehouses` - Create
  - `GET /api/v1/warehouses` - List with filters
  - `GET /api/v1/warehouses/:id` - Get by ID
  - `PATCH /api/v1/warehouses/:id` - Update
  - `DELETE /api/v1/warehouses/:id` - Soft delete
- [ ] **GAP-01.3** Add Prisma model if missing
- [ ] **GAP-01.4** Write unit tests (target: 30)

#### Frontend Tasks
- [ ] **GAP-01.5** Create `useWarehouses.ts` hook
- [ ] **GAP-01.6** Create `WarehouseListPage.tsx`
- [ ] **GAP-01.7** Create `WarehouseFormModal.tsx`
- [ ] **GAP-01.8** Create `WarehouseCard.tsx`
- [ ] **GAP-01.9** Add "المستودعات" to Sidebar

**Acceptance Criteria:**
- [ ] Can create warehouse with name, address, capacity
- [ ] Can view list of warehouses
- [ ] Can edit/delete warehouse
- [ ] Warehouse dropdown appears in all inventory forms

---

### GAP-02: Product/SKU CRUD
**Est:** 14 hours | **Deps:** GAP-01 (needs warehouse)

#### Backend Tasks
- [ ] **GAP-02.1** Enhance `inventory.controller.ts`
  - `POST /api/v1/inventory/products` - Full product create
  - `GET /api/v1/inventory/products/:id` - Detailed view
  - `PATCH /api/v1/inventory/products/:id` - Update all fields
  - `DELETE /api/v1/inventory/products/:id` - Soft delete
- [ ] **GAP-02.2** Add product categories support
- [ ] **GAP-02.3** Add product images support
- [ ] **GAP-02.4** Write unit tests (target: 25)

#### Frontend Tasks
- [ ] **GAP-02.5** Create `ProductFormModal.tsx`
  - SKU, name, description, category
  - Initial stock, min/max thresholds
  - Warehouse selection
  - Image upload
- [ ] **GAP-02.6** Create `ProductDetailPage.tsx`
  - Full product info
  - Stock history
  - Reservation history
  - Action buttons
- [ ] **GAP-02.7** Create `useProduct.ts` hook
- [ ] **GAP-02.8** Add "إضافة منتج" button to InventoryOverview
- [ ] **GAP-02.9** Make table rows clickable → ProductDetailPage

**Acceptance Criteria:**
- [ ] Can add single product manually
- [ ] Can edit product details
- [ ] Can view product detail page with history
- [ ] Can delete product (with reservation check)

---

### GAP-03: Wire API Hooks to UI
**Est:** 16 hours | **Deps:** GAP-01, GAP-02

#### Movements Connection
- [ ] **GAP-03.1** Wire `useStockMovements` to `MovementPanel`
- [ ] **GAP-03.2** Implement `handleCreateMovement()` in `MovementFormModal`
- [ ] **GAP-03.3** Implement `handleExecute()` action
- [ ] **GAP-03.4** Implement `handleCancel()` action
- [ ] **GAP-03.5** Replace mock data with API data

#### Cycle Count Connection
- [ ] **GAP-03.6** Wire `useCycleCount` to `CycleCountPanel`
- [ ] **GAP-03.7** Implement wizard submit in `CycleCountWizard`
- [ ] **GAP-03.8** Implement count recording in `CountEntryForm`
- [ ] **GAP-03.9** Implement approval actions in `ApprovalQueue`
- [ ] **GAP-03.10** Replace mock data

#### Transfers Connection
- [ ] **GAP-03.11** Wire `useTransferRequests` to `TransferPanel`
- [ ] **GAP-03.12** Implement create in `TransferFormModal`
- [ ] **GAP-03.13** Implement approve/reject in `TransferApprovalQueue`
- [ ] **GAP-03.14** Replace mock data

#### Validation Connection
- [ ] **GAP-03.15** Wire `useValidationRules` to `ValidationRulesPanel`
- [ ] **GAP-03.16** Implement CRUD in `RuleEditor`
- [ ] **GAP-03.17** Implement toggle in `RuleToggle`
- [ ] **GAP-03.18** Implement test in `ValidationPreview`

#### Audit Connection
- [ ] **GAP-03.19** Wire `useAuditTrail` to `AuditTrailPanel`
- [ ] **GAP-03.20** Implement filters
- [ ] **GAP-03.21** Implement export handlers

**Acceptance Criteria:**
- [ ] All forms submit to real API
- [ ] All lists show real data
- [ ] All action buttons trigger API calls
- [ ] Error handling with toast messages

---

## P1: High Priority — 30-45 hours

### GAP-04: Export Functionality
**Est:** 8 hours | **Deps:** GAP-03

#### Backend Tasks
- [ ] **GAP-04.1** Add `GET /api/v1/inventory/export/csv`
- [ ] **GAP-04.2** Add `GET /api/v1/inventory/movements/export/csv`
- [ ] **GAP-04.3** Add `GET /api/v1/inventory/cycle-counts/:id/export`
- [ ] **GAP-04.4** Add JSON export variants

#### Frontend Tasks
- [ ] **GAP-04.5** Implement `handleExportCsv()` in `AuditExport`
- [ ] **GAP-04.6** Implement `handleExportJson()` in `AuditExport`
- [ ] **GAP-04.7** Add export button to `InventoryOverview`
- [ ] **GAP-04.8** Add export to `MovementPanel`
- [ ] **GAP-04.9** Add export to `CycleCountPanel`

**Acceptance Criteria:**
- [ ] Can export inventory as CSV
- [ ] Can export movements as CSV
- [ ] Can export audit trail as CSV/JSON
- [ ] Downloads trigger automatically

---

### GAP-05: Enhanced Filters
**Est:** 10 hours | **Deps:** GAP-01

#### Inventory Filters
- [ ] **GAP-05.1** Create `InventoryFilters.tsx` component
- [ ] **GAP-05.2** Add warehouse dropdown
- [ ] **GAP-05.3** Add category filter
- [ ] **GAP-05.4** Add stock level filter (low/out/normal)
- [ ] **GAP-05.5** Add date range picker
- [ ] **GAP-05.6** Add "clear filters" button
- [ ] **GAP-05.7** Add active filter badges

#### Backend Support
- [ ] **GAP-05.8** Update inventory query with all filters
- [ ] **GAP-05.9** Add filter counts endpoint

**Acceptance Criteria:**
- [ ] Can filter by warehouse
- [ ] Can filter by stock level
- [ ] Can filter by category
- [ ] Can combine multiple filters
- [ ] Active filters shown as badges

---

### GAP-06: Force Release UI
**Est:** 6 hours | **Deps:** GAP-03

- [ ] **GAP-06.1** Wire `useForceRelease` to `ForceReleasePanel`
- [ ] **GAP-06.2** Implement single release in `ReleaseModal`
- [ ] **GAP-06.3** Implement batch release in `BatchReleaseModal`
- [ ] **GAP-06.4** Replace mock data in `StuckReservationList`
- [ ] **GAP-06.5** Replace mock data in `ReleaseHistory`

**Acceptance Criteria:**
- [ ] Can view stuck reservations
- [ ] Can release single reservation
- [ ] Can batch release multiple
- [ ] History shows real releases

---

### GAP-07: Import CSV Connection
**Est:** 6 hours | **Deps:** None

- [ ] **GAP-07.1** Wire `useInventoryImport` to `ImportCsvModal`
- [ ] **GAP-07.2** Implement file upload to API
- [ ] **GAP-07.3** Show real-time progress
- [ ] **GAP-07.4** Display actual errors
- [ ] **GAP-07.5** Wire `ImportPreview` component
- [ ] **GAP-07.6** Wire `ImportResults` component

**Acceptance Criteria:**
- [ ] Can upload CSV file
- [ ] Shows actual progress
- [ ] Displays real validation errors
- [ ] Successful import adds products

---

## P2: Medium Priority — 20-30 hours

### GAP-08: Orders Enhancements
**Est:** 10 hours | **Deps:** None

- [ ] **GAP-08.1** Create `OrderFormModal.tsx` for manual order
- [ ] **GAP-08.2** Add bulk status update
- [ ] **GAP-08.3** Add order export CSV
- [ ] **GAP-08.4** Enhance order filters
- [ ] **GAP-08.5** Add order timeline view

**Acceptance Criteria:**
- [ ] Can create order manually
- [ ] Can bulk update order status
- [ ] Can export orders

---

### GAP-09: User Management UI
**Est:** 8 hours | **Deps:** None

- [ ] **GAP-09.1** Create `UsersPage.tsx`
- [ ] **GAP-09.2** Create `UserFormModal.tsx`
- [ ] **GAP-09.3** Create `useUsers.ts` hook
- [ ] **GAP-09.4** Add role assignment
- [ ] **GAP-09.5** Add "المستخدمين" to Sidebar

**Acceptance Criteria:**
- [ ] Can view user list
- [ ] Can create/edit users
- [ ] Can assign roles

---

### GAP-10: Organization Settings
**Est:** 6 hours | **Deps:** None

- [ ] **GAP-10.1** Create organization settings tab
- [ ] **GAP-10.2** Wire to org API
- [ ] **GAP-10.3** Add logo upload
- [ ] **GAP-10.4** Add notification preferences

**Acceptance Criteria:**
- [ ] Can update org name/logo
- [ ] Can configure notification settings

---

## P3: Nice to Have — 10-15 hours

### GAP-11: Filter Presets
**Est:** 4 hours | **Deps:** GAP-05

- [ ] **GAP-11.1** Save filter preset feature
- [ ] **GAP-11.2** Load saved presets
- [ ] **GAP-11.3** Delete presets

---

### GAP-12: Dashboard Analytics
**Est:** 6 hours | **Deps:** Multiple

- [ ] **GAP-12.1** Create dashboard page
- [ ] **GAP-12.2** Add inventory charts
- [ ] **GAP-12.3** Add order stats
- [ ] **GAP-12.4** Add low stock alerts

---

### GAP-13: Bulk Operations
**Est:** 4 hours | **Deps:** GAP-02

- [ ] **GAP-13.1** Bulk delete products
- [ ] **GAP-13.2** Bulk update stock
- [ ] **GAP-13.3** Bulk category assign

---

## Implementation Order

```
GAP-01 (Warehouse) 
    ↓
GAP-02 (Product CRUD) ──┬──→ GAP-05 (Filters)
    ↓                   │
GAP-03 (Wire API) ──────┼──→ GAP-06 (Force Release)
    ↓                   │
GAP-04 (Export) ────────┤
    ↓                   │
GAP-07 (Import CSV) ────┘

Platform Features (Independent):
GAP-14 (Admin Dashboard) → GAP-15 (Subscription Tiers)
         ↓
GAP-16 (Billing Page) → GAP-17 (Subscription TopBar)
         
GAP-18 (Channel OAuth) → GAP-19 (Order Sync)
         
GAP-20 (Multi-Currency)
```

---

## P0+: Platform Founder Features — 45-60 hours

> **Note:** These are platform-level features for the Founder/Admin to manage organizations and billing.
> Backend exists for most (billing module, Stripe integration). **Frontend is missing.**

### GAP-14: Admin Platform Dashboard
**Est:** 10 hours | **Deps:** None | **Conflict Check:** ✅ No conflicts

> **Backend:** ⚠️ Partially exists (organization endpoints)  
> **Frontend:** ❌ Missing

#### Backend Tasks
- [ ] **GAP-14.1** Create `/api/v1/admin/organizations` - List all orgs
- [ ] **GAP-14.2** Create `/api/v1/admin/organizations/:id` - Get org details
- [ ] **GAP-14.3** Create `/api/v1/admin/stats` - Platform-wide stats
- [ ] **GAP-14.4** Add Super Admin role to RBAC

#### Frontend Tasks
- [ ] **GAP-14.5** Create `AdminDashboardPage.tsx`
- [ ] **GAP-14.6** Create `OrganizationListAdmin.tsx`
- [ ] **GAP-14.7** Create `OrganizationDetailAdmin.tsx`
- [ ] **GAP-14.8** Create `PlatformStatsCards.tsx`
- [ ] **GAP-14.9** Create admin route `/admin`

**Acceptance Criteria:**
- [ ] Founder can see all organizations
- [ ] Can view org usage (orders, inventory, users)
- [ ] Can activate/deactivate organizations
- [ ] Platform-wide stats (total orgs, MRR, etc.)

---

### GAP-15: Subscription Tiers Management
**Est:** 8 hours | **Deps:** GAP-14 | **Conflict Check:** ✅ No conflicts

> **Backend:** ⚠️ Exists (`stripe.service.ts`, `trial.service.ts`)  
> **Frontend:** ❌ Missing

#### Backend Tasks
- [ ] **GAP-15.1** Create `GET /api/v1/admin/plans` - List subscription plans
- [ ] **GAP-15.2** Create `POST /api/v1/admin/plans` - Create plan
- [ ] **GAP-15.3** Create `PATCH /api/v1/admin/plans/:id` - Update plan
- [ ] **GAP-15.4** Sync with Stripe Products/Prices

#### Frontend Tasks
- [ ] **GAP-15.5** Create `SubscriptionTiersPage.tsx`
- [ ] **GAP-15.6** Create `PlanFormModal.tsx`
- [ ] **GAP-15.7** Create `PlanCard.tsx` with features list
- [ ] **GAP-15.8** Add pricing table component

**Acceptance Criteria:**
- [ ] Can create/edit subscription tiers
- [ ] Plans sync with Stripe
- [ ] Can set pricing (monthly/yearly)
- [ ] Can define feature limits per tier

---

### GAP-16: Billing Page
**Est:** 8 hours | **Deps:** GAP-15 | **Conflict Check:** ✅ Exists in `next-app` but not main app

> **Backend:** ✅ Exists (`stripe.service.ts`, `billing-audit.service.ts`)  
> **Frontend:** ⚠️ Exists in `/next-app/app/settings/billing/` - needs integration

#### Frontend Tasks
- [ ] **GAP-16.1** Create `BillingPage.tsx` in main app
- [ ] **GAP-16.2** Create `CurrentPlanCard.tsx`
- [ ] **GAP-16.3** Create `PaymentMethodCard.tsx`
- [ ] **GAP-16.4** Create `InvoiceHistory.tsx`
- [ ] **GAP-16.5** Create `UpgradePlanModal.tsx`
- [ ] **GAP-16.6** Integrate Stripe Checkout
- [ ] **GAP-16.7** Add billing tab to Settings

**Acceptance Criteria:**
- [ ] Can view current subscription
- [ ] Can upgrade/downgrade plan
- [ ] Can update payment method
- [ ] Can view invoice history
- [ ] Stripe integration working

---

### GAP-17: Subscription Status in TopBar
**Est:** 3 hours | **Deps:** GAP-16 | **Conflict Check:** ✅ Component exists, needs wiring

> **Backend:** ✅ Exists (subscription fields on Organization)  
> **Frontend:** ⚠️ `BillingStatusBadge.tsx` exists but not in TopBar

#### Frontend Tasks
- [ ] **GAP-17.1** Add subscription status to user context
- [ ] **GAP-17.2** Add `BillingStatusBadge` to `TopBar.tsx`
- [ ] **GAP-17.3** Show trial days remaining
- [ ] **GAP-17.4** Show warning if past due
- [ ] **GAP-17.5** Add upgrade CTA button

**Acceptance Criteria:**
- [ ] TopBar shows subscription status
- [ ] Trial countdown visible
- [ ] Past due warning shown
- [ ] Click opens billing page

---

### GAP-18: Channel OAuth Flow
**Est:** 8 hours | **Deps:** None | **Conflict Check:** ✅ No conflicts

> **Backend:** ⚠️ Partial (Shopify/WooCommerce services exist, OAuth flow incomplete)  
> **Frontend:** ❌ Missing

#### Backend Tasks
- [ ] **GAP-18.1** Complete Shopify OAuth flow
- [ ] **GAP-18.2** Complete WooCommerce OAuth flow
- [ ] **GAP-18.3** Create `/api/v1/channels/connect/:platform`
- [ ] **GAP-18.4** Create `/api/v1/channels/callback/:platform`
- [ ] **GAP-18.5** Store encrypted credentials

#### Frontend Tasks
- [ ] **GAP-18.6** Create `ChannelConnectWizard.tsx`
- [ ] **GAP-18.7** Create `PlatformSelectCard.tsx`
- [ ] **GAP-18.8** Create OAuth popup handler
- [ ] **GAP-18.9** Show connection status

**Acceptance Criteria:**
- [ ] Can connect Shopify store via OAuth
- [ ] Can connect WooCommerce store
- [ ] Credentials stored securely
- [ ] Connection status shown

---

### GAP-19: Sync Orders from Integrations
**Est:** 6 hours | **Deps:** GAP-18 | **Conflict Check:** ✅ Backend exists - needs UI

> **Backend:** ✅ Exists (`shopify.worker.ts`, `woocommerce.worker.ts`)  
> **Frontend:** ❌ Missing UI

#### Frontend Tasks
- [ ] **GAP-19.1** Create `SyncStatusPanel.tsx`
- [ ] **GAP-19.2** Show last sync time per channel
- [ ] **GAP-19.3** Add manual sync button
- [ ] **GAP-19.4** Show sync progress/errors
- [ ] **GAP-19.5** Create `SyncHistoryList.tsx`

**Acceptance Criteria:**
- [ ] Can trigger manual sync
- [ ] See sync status per channel
- [ ] View sync history/errors
- [ ] Orders appear in orders list after sync

---

### GAP-20: Multi-Currency Support
**Est:** 6 hours | **Deps:** GAP-10 | **Conflict Check:** ✅ Currency field exists in orders

> **Backend:** ⚠️ Currency in orders but not org-level settings  
> **Frontend:** ❌ Missing

#### Backend Tasks
- [ ] **GAP-20.1** Add `defaultCurrency` to Organization model
- [ ] **GAP-20.2** Add `supportedCurrencies` array to Organization
- [ ] **GAP-20.3** Migration to add fields
- [ ] **GAP-20.4** Update organization endpoints

#### Frontend Tasks
- [ ] **GAP-20.5** Create `CurrencySettings.tsx` in org settings
- [ ] **GAP-20.6** Currency dropdown (EGP, SAR, AED, USD, EUR)
- [ ] **GAP-20.7** Add currency format helper
- [ ] **GAP-20.8** Display prices with currency symbol

**Acceptance Criteria:**
- [ ] Can set organization default currency
- [ ] Supported currencies: EGP, SAR, AED, USD, EUR
- [ ] Prices display with correct format
- [ ] Can add more currencies later

---

## Progress Tracker

| ID | Task | Status | Hours |
|----|------|:------:|:-----:|
| **Core Gaps** | | | |
| GAP-01 | Warehouse CRUD | ✅ | 12 |
| GAP-02 | Product CRUD | ⬜ | 14 |
| GAP-03 | Wire API Hooks | ⬜ | 16 |
| GAP-04 | Export | ⬜ | 8 |
| GAP-05 | Enhanced Filters | ⬜ | 10 |
| GAP-06 | Force Release UI | ⬜ | 6 |
| GAP-07 | Import CSV | ⬜ | 6 |
| GAP-08 | Orders Enhancements | ⬜ | 10 |
| GAP-09 | User Management | ⬜ | 8 |
| GAP-10 | Org Settings | ⬜ | 6 |
| GAP-11 | Filter Presets | ⬜ | 4 |
| GAP-12 | Dashboard | ⬜ | 6 |
| GAP-13 | Bulk Operations | ⬜ | 4 |
| **Platform Gaps** | | | |
| GAP-14 | Admin Platform Dashboard | ⬜ | 10 |
| GAP-15 | Subscription Tiers | ⬜ | 8 |
| GAP-16 | Billing Page | ⬜ | 8 |
| GAP-17 | Subscription TopBar | ⬜ | 3 |
| GAP-18 | Channel OAuth | ⬜ | 8 |
| GAP-19 | Order Sync UI | ⬜ | 6 |
| GAP-20 | Multi-Currency | ⬜ | 6 |
| | **TOTAL** | | **159** |

---

## Conflict Analysis Summary

| New Gap | Potential Conflicts | Resolution |
|---------|-------------------|------------|
| GAP-14 | None | New feature |
| GAP-15 | None | Backend exists, add UI |
| GAP-16 | `next-app` has billing | Port to main app |
| GAP-17 | BillingStatusBadge exists | Wire to TopBar |
| GAP-18 | Channel services exist | Complete OAuth flow |
| GAP-19 | Workers exist | Add UI only |
| GAP-20 | Currency in orders | Add org-level |

**No breaking conflicts found.** All new features can be added incrementally.
