# Phase 1-4 Gap Analysis - Product CRUD

**Task ID:** GAP-02  
**Priority:** P0 (Critical)  
**Est. Hours:** 14  
**Dependencies:** GAP-01 (Warehouse CRUD) ✅
**Status:** 🔄 In Progress

---

## Phase A+D: Planning & Design

### Problem Statement

Users cannot:
- Add a single product manually
- View product detail page
- Edit product information
- Delete products
- Manage product categories

This is critical for inventory management—organizations need to manage their product catalog.

---

### Business Requirements

#### Core Features
1. **Create Product** - Add product with SKU, name, description, category
2. **View Product Detail** - Full product page with inventory info
3. **Edit Product** - Update all product fields
4. **Delete Product** - Soft delete (with reservation check)
5. **Product List** - Enhanced view in inventory with click-through
6. **Categories** - Optional categorization

#### Business Rules
- SKU must be unique per organization
- Cannot delete product with active reservations
- Products are org-scoped (multi-tenant)
- Product can have multiple SKU variants (future)
- Initial stock can be set on creation

---

### API Design

#### Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/v1/products` | Create product | ADMIN, MANAGER |
| GET | `/api/v1/products` | List products | All |
| GET | `/api/v1/products/:id` | Get product details | All |
| PATCH | `/api/v1/products/:id` | Update product | ADMIN, MANAGER |
| DELETE | `/api/v1/products/:id` | Delete product | ADMIN |
| GET | `/api/v1/products/:id/history` | Stock history | All |
| GET | `/api/v1/products/categories` | Get categories | All |

#### DTOs

```typescript
// Create
interface CreateProductDto {
  name: string;                // Required
  sku: string;                 // Required, unique per org
  description?: string;
  category?: string;
  barcode?: string;
  price?: number;
  cost?: number;
  minStock?: number;           // Low stock threshold
  maxStock?: number;           // Overstock threshold
  initialStock?: {
    warehouseId: string;
    quantity: number;
  };
  images?: string[];
  metadata?: Record<string, any>;
}

// Update
interface UpdateProductDto {
  name?: string;
  description?: string;
  category?: string;
  barcode?: string;
  price?: number;
  cost?: number;
  minStock?: number;
  maxStock?: number;
  images?: string[];
  metadata?: Record<string, any>;
  isActive?: boolean;
}

// Response
interface ProductResponse {
  id: string;
  organizationId: string;
  name: string;
  sku: string;
  description: string | null;
  category: string | null;
  barcode: string | null;
  price: number | null;
  cost: number | null;
  minStock: number;
  maxStock: number | null;
  images: string[];
  metadata: Record<string, any> | null;
  isActive: boolean;
  // Computed
  totalStock: number;
  availableStock: number;
  reservedStock: number;
  lowStock: boolean;
  stockByWarehouse?: WarehouseStock[];
  createdAt: Date;
  updatedAt: Date;
}

interface WarehouseStock {
  warehouseId: string;
  warehouseName: string;
  available: number;
  reserved: number;
  damaged: number;
}

interface ProductFilters {
  search?: string;
  category?: string;
  warehouseId?: string;
  stockLevel?: 'low' | 'out' | 'normal' | 'all';
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}
```

---

### Database Changes

The `Product` and `SKU` models already exist (schema lines 154-196).

#### Fields to Add (Migration Required)

```prisma
model Product {
  // Existing fields...
  
  // New fields to add
  category     String?
  price        Decimal?  @db.Decimal(10, 2)
  cost         Decimal?  @db.Decimal(10, 2)
  minStock     Int       @default(10) @map("min_stock")
  maxStock     Int?      @map("max_stock")
  images       String[]  @default([])
  isActive     Boolean   @default(true) @map("is_active")
}

model SKU {
  // Existing fields...
  
  // Already has: sku, barcode, metadata
}
```

---

### Files to Create/Modify

#### Backend
```
src/modules/products/
├── dto/
│   ├── create-product.dto.ts
│   ├── update-product.dto.ts
│   └── index.ts
├── product.service.ts
├── product.controller.ts
├── product.module.ts
└── product.service.spec.ts
```

#### Frontend
```
src/components/products/
├── ProductFormModal.tsx
├── ProductDetailPage.tsx
├── ProductCard.tsx
├── ProductCategoryFilter.tsx
└── index.ts

src/hooks/
└── useProducts.ts

src/app/products/
├── page.tsx
└── [id]/
    └── page.tsx
```

#### Tests
```
test/unit/product.spec.ts
test/integration/product.e2e-spec.ts
```

---

## Phase B: Testing (Write First!)

### Unit Tests Target: 30

#### ProductService Tests
1. createProduct - success
2. createProduct - duplicate SKU error
3. createProduct - with initial stock
4. createProduct - auto-generate SKU if not provided
5. getProducts - list with pagination
6. getProducts - filter by category
7. getProducts - filter by stock level (low)
8. getProducts - filter by warehouse
9. getProducts - search by name/sku
10. getProducts - org isolation
11. getProductById - success
12. getProductById - not found
13. getProductById - includes stock by warehouse
14. updateProduct - success
15. updateProduct - duplicate SKU error
16. updateProduct - cannot update SKU
17. updateProduct - partial update
18. deleteProduct - success (no reservations)
19. deleteProduct - with active reservations (error)
20. deleteProduct - soft delete (sets isActive = false)
21. getProductHistory - returns stock changes
22. getCategories - returns unique categories
23. getProductStock - aggregates across warehouses
24. validateProduct - minStock < maxStock
25. calculateStockStatus - low/out/normal

### Integration Tests Target: 12

1. POST /products - create with auth
2. POST /products - duplicate SKU 409
3. GET /products - list paginated
4. GET /products - filtered
5. GET /products/:id - found
6. GET /products/:id - not found 404
7. PATCH /products/:id - update
8. PATCH /products/:id - not owner 403
9. DELETE /products/:id - success
10. DELETE /products/:id - with reservations 400
11. Auth: OPERATOR cannot delete
12. org isolation test

---

## Phase C: Implementation Checklist

### Backend
- [ ] Create migration for new Product fields
- [ ] Create DTOs
- [ ] Implement ProductService
- [ ] Implement ProductController
- [ ] Create ProductModule
- [ ] Register in AppModule

### Frontend
- [ ] Create useProducts hook
- [ ] Create ProductFormModal
- [ ] Create ProductDetailPage
- [ ] Create ProductCard (for grid view)
- [ ] Add "إضافة منتج" button to InventoryOverview
- [ ] Make inventory table rows clickable
- [ ] Add route for /products/:id

### Wiring
- [ ] Connect ProductFormModal to API
- [ ] Connect ProductDetailPage to API
- [ ] Connect filters to API
- [ ] Error handling with toast

---

## Verification Checklist

- [ ] All 30 unit tests pass
- [ ] All 12 integration tests pass
- [ ] Can create product from UI
- [ ] Can view product detail page
- [ ] Can edit product
- [ ] Can delete product (with check)
- [ ] Filters work correctly
- [ ] RTL Arabic layout correct
- [ ] Mobile responsive
- [ ] Dark mode supported
- [ ] No console errors
