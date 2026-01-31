# Phase 1-4 Gap Analysis - Warehouse CRUD

**Task ID:** GAP-01  
**Priority:** P0 (Critical)  
**Est. Hours:** 12  
**Dependencies:** None

---

## Problem Statement

The system currently has **no warehouse management capability**. Users cannot:
- Create warehouses to organize inventory
- Update warehouse details (name, address, capacity)
- View a list of their warehouses
- Delete/archive warehouses

This is foundational—without warehouses, inventory cannot be properly organized.

---

## Business Requirements

### Core Features
1. **Create Warehouse** - Add new warehouse with name, address, capacity, status
2. **View Warehouses** - List all warehouses with stats (items, reserved, low stock)
3. **Update Warehouse** - Edit warehouse details
4. **Delete Warehouse** - Soft delete (only if empty or archive with items)
5. **Warehouse Stats** - Real-time inventory counts per warehouse

### Business Rules
- Warehouse name must be unique within organization
- Cannot delete warehouse with active reservations
- Warehouses are org-scoped (multi-tenant)
- Default warehouse can be set per org

---

## API Design

### Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/v1/warehouses` | Create warehouse | ADMIN, MANAGER |
| GET | `/api/v1/warehouses` | List warehouses | All |
| GET | `/api/v1/warehouses/:id` | Get warehouse details | All |
| PATCH | `/api/v1/warehouses/:id` | Update warehouse | ADMIN, MANAGER |
| DELETE | `/api/v1/warehouses/:id` | Delete warehouse | ADMIN |
| POST | `/api/v1/warehouses/:id/set-default` | Set as default | ADMIN |

### DTOs

```typescript
// Create
interface CreateWarehouseDto {
  name: string;          // Required, unique per org
  code?: string;         // Optional, auto-generated if not provided
  address?: {
    street: string;
    city: string;
    country: string;
    postalCode?: string;
  };
  capacity?: number;     // Max items, null = unlimited
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  isActive?: boolean;    // Default: true
}

// Update
interface UpdateWarehouseDto {
  name?: string;
  address?: Partial<Address>;
  capacity?: number;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  isActive?: boolean;
}

// Response
interface WarehouseResponse {
  id: string;
  name: string;
  code: string;
  address: Address | null;
  capacity: number | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  isActive: boolean;
  isDefault: boolean;
  organizationId: string;
  stats: {
    totalItems: number;
    totalQuantity: number;
    reservedQuantity: number;
    lowStockItems: number;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

---

## Database Model

```prisma
model Warehouse {
  id             String   @id @default(cuid())
  organizationId String
  name           String
  code           String
  street         String?
  city           String?
  country        String?
  postalCode     String?
  capacity       Int?
  contactName    String?
  contactPhone   String?
  contactEmail   String?
  isActive       Boolean  @default(true)
  isDefault      Boolean  @default(false)
  deletedAt      DateTime?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id])
  inventoryItems Sku[]      @relation("WarehouseInventory")

  @@unique([organizationId, name])
  @@unique([organizationId, code])
  @@index([organizationId])
  @@index([isActive])
}
```

---

## Implementation Tasks

### Phase A+D: Planning & Design ✅
- [x] Create task breakdown document
- [x] Define API endpoints
- [x] Define DTOs
- [x] Define database model

### Phase B: Write Tests First
- [ ] **B.1** Unit tests for WarehouseService
  - [ ] createWarehouse - success
  - [ ] createWarehouse - duplicate name error
  - [ ] createWarehouse - auto-generate code
  - [ ] getWarehouses - list with filters
  - [ ] getWarehouses - org isolation
  - [ ] getWarehouseById - success
  - [ ] getWarehouseById - not found
  - [ ] updateWarehouse - success
  - [ ] updateWarehouse - duplicate name error
  - [ ] deleteWarehouse - success (empty)
  - [ ] deleteWarehouse - with items (soft delete)
  - [ ] deleteWarehouse - with reservations (error)
  - [ ] setDefaultWarehouse - success
  - [ ] getWarehouseStats - correct counts
- [ ] **B.2** Integration tests for WarehouseController
  - [ ] Create via POST
  - [ ] List via GET
  - [ ] Get by ID
  - [ ] Update via PATCH
  - [ ] Delete via DELETE
  - [ ] Set default
  - [ ] Auth: ADMIN can delete
  - [ ] Auth: OPERATOR cannot create

### Phase C: Implementation
- [ ] **C.1** Add Prisma model and migrate
- [ ] **C.2** Create `warehouse.service.ts`
- [ ] **C.3** Create `warehouse.controller.ts`
- [ ] **C.4** Create `warehouse.module.ts`
- [ ] **C.5** Register in app module
- [ ] **C.6** Create `useWarehouses.ts` hook
- [ ] **C.7** Create `WarehouseListPage.tsx`
- [ ] **C.8** Create `WarehouseFormModal.tsx`
- [ ] **C.9** Create `WarehouseCard.tsx`
- [ ] **C.10** Add to Sidebar navigation
- [ ] **C.11** Update inventory forms with warehouse dropdown

---

## Test Coverage Target

| Category | Tests |
|----------|:-----:|
| Unit Tests | 25 |
| Integration Tests | 12 |
| **Total** | **37** |

---

## Acceptance Criteria

- [ ] Can create warehouse with all fields
- [ ] Warehouse name is unique per organization
- [ ] Can list warehouses with pagination
- [ ] Can filter warehouses (active/inactive)
- [ ] Can update warehouse details
- [ ] Cannot delete warehouse with active reservations
- [ ] Can set default warehouse
- [ ] Stats show correct inventory counts
- [ ] UI follows RTL Arabic design system
- [ ] Mobile responsive

---

## Files to Create

### Backend
```
src/modules/warehouses/
├── dto/
│   ├── create-warehouse.dto.ts
│   ├── update-warehouse.dto.ts
│   └── index.ts
├── warehouse.service.ts
├── warehouse.controller.ts
├── warehouse.module.ts
└── warehouse.service.spec.ts
```

### Frontend
```
src/components/warehouses/
├── WarehouseListPage.tsx
├── WarehouseFormModal.tsx
├── WarehouseCard.tsx
├── WarehouseSelect.tsx
└── index.ts

src/hooks/
└── useWarehouses.ts
```

### Tests
```
test/unit/warehouse.spec.ts
test/integration/warehouse.e2e-spec.ts
```
