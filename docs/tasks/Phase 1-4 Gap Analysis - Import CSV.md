# Phase 1-4 Gap Analysis - Import CSV

**Task ID:** GAP-07  
**Priority:** P1 (High)  
**Est. Hours:** 6  
**Dependencies:** GAP-03 (Wire API Hooks) ✅  
**Status:** 🔄 In Progress

---

## Phase A+D: Planning & Design

### Problem Statement

Users cannot:
- Bulk import products/inventory via CSV
- Upload and validate CSV files
- See import progress and errors
- Download import error reports
- View import history

This is critical for onboarding—new organizations need to import their existing product catalog and inventory levels.

---

### Business Requirements

#### Core Features
1. **File Upload** - Drag-and-drop CSV upload
2. **Header Mapping** - Map CSV columns to system fields
3. **Validation Preview** - Show errors before import
4. **Batch Import** - Process rows with progress indicator
5. **Error Report** - Download list of failed rows
6. **Import History** - View past imports

#### Supported CSV Formats
- Products import (name, sku, category, price, cost)
- Inventory levels (sku, warehouseId, quantity)

#### Business Rules
- Maximum file size: 10MB
- Maximum rows per file: 10,000
- SKU must be unique per organization
- Warehouse must exist and belong to org
- Partial success allowed (valid rows imported, errors collected)
- Duplicate SKUs update existing products

---

### API Design

#### Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/v1/import/validate` | Validate CSV without importing | ADMIN, MANAGER |
| POST | `/api/v1/import/products` | Import products from CSV | ADMIN, MANAGER |
| POST | `/api/v1/import/inventory` | Import inventory levels | ADMIN, MANAGER |
| GET | `/api/v1/import/history` | List past imports | ADMIN, MANAGER |
| GET | `/api/v1/import/:id/errors` | Download error report | ADMIN, MANAGER |
| GET | `/api/v1/import/templates/:type` | Download CSV template | All |

#### DTOs

```typescript
// Validate Request
interface ValidateCSVDto {
  file: Express.Multer.File;
  type: 'products' | 'inventory';
  mapping?: Record<string, string>;  // Custom header mapping
}

// Validate Response
interface ValidationResult {
  valid: boolean;
  totalRows: number;
  validRows: number;
  errorRows: number;
  errors: ValidationError[];
  preview: PreviewRow[];  // First 5 valid rows
}

interface ValidationError {
  row: number;
  column: string;
  value: string;
  message: string;
}

interface PreviewRow {
  row: number;
  data: Record<string, any>;
}

// Import Request
interface ImportCSVDto {
  file: Express.Multer.File;
  type: 'products' | 'inventory';
  mapping?: Record<string, string>;
  options?: {
    skipErrors: boolean;        // Continue on errors
    updateExisting: boolean;    // Update if SKU exists
    dryRun: boolean;            // Validate only
  };
}

// Import Response
interface ImportResult {
  id: string;
  status: 'COMPLETED' | 'PARTIAL' | 'FAILED';
  totalRows: number;
  successRows: number;
  errorRows: number;
  createdCount: number;
  updatedCount: number;
  errors: ImportError[];
  duration: number;  // milliseconds
  createdAt: Date;
}

interface ImportError {
  row: number;
  sku?: string;
  message: string;
  field?: string;
}

// Import History
interface ImportHistory {
  id: string;
  type: 'products' | 'inventory';
  filename: string;
  status: 'COMPLETED' | 'PARTIAL' | 'FAILED';
  totalRows: number;
  successRows: number;
  errorRows: number;
  userId: string;
  userName?: string;
  createdAt: Date;
}

// CSV Templates
const PRODUCT_TEMPLATE_HEADERS = [
  'name',      // Required
  'sku',       // Required, unique per org
  'category',  // Optional
  'description', // Optional
  'price',     // Optional, decimal
  'cost',      // Optional, decimal
  'barcode',   // Optional
  'minStock',  // Optional, integer
  'maxStock',  // Optional, integer
];

const INVENTORY_TEMPLATE_HEADERS = [
  'sku',          // Required
  'warehouseId',  // Required (or warehouseName)
  'quantity',     // Required
  'location',     // Optional (bin location)
];
```

---

### Database Changes

#### New Model: ImportLog

```prisma
model ImportLog {
  id             String   @id @default(uuid())
  organizationId String   @map("organization_id")
  userId         String   @map("user_id")
  type           String   // 'products' | 'inventory'
  filename       String
  status         String   // 'COMPLETED' | 'PARTIAL' | 'FAILED'
  totalRows      Int      @map("total_rows")
  successRows    Int      @map("success_rows")
  errorRows      Int      @map("error_rows")
  errors         Json?    // Array of error objects
  duration       Int?     // milliseconds
  createdAt      DateTime @default(now()) @map("created_at")

  organization Organization @relation(fields: [organizationId], references: [id])
  user         User         @relation(fields: [userId], references: [id])

  @@index([organizationId])
  @@map("import_logs")
}
```

---

### Files to Create/Modify

#### Backend
```
src/modules/import/
├── dto/
│   ├── validate-csv.dto.ts
│   ├── import-csv.dto.ts
│   └── index.ts
├── import.service.ts
├── import.controller.ts
├── import.module.ts
├── csv-parser.service.ts     # CSV parsing utilities
├── templates/                # CSV template files
│   ├── products-template.csv
│   └── inventory-template.csv
└── import.service.spec.ts
```

#### Frontend
```
src/components/import/
├── ImportCsvModal.tsx        # Main modal (enhance existing)
├── FileDropzone.tsx          # Drag-and-drop upload
├── HeaderMapping.tsx         # Map columns
├── ValidationPreview.tsx     # Show errors
├── ImportProgress.tsx        # Progress bar
├── ImportHistory.tsx         # Past imports
└── index.ts

src/hooks/inventory/
└── useInventoryImport.ts     # Already exists, enhance
```

#### Tests
```
test/unit/import.spec.ts        # Already exists (970 lines)
test/integration/import.e2e-spec.ts
```

---

## Phase B: Testing (Write First!)

### Unit Tests Target: 40 (970 lines already exist!)

The existing `inventory-import.spec.ts` already covers:

#### CSV Parsing Tests
1. Parse valid CSV content
2. Parse empty file (error)
3. Parse file without headers (error)
4. Parse file with missing required headers
5. Parse file with extra headers (OK)
6. Parse malformed CSV

#### Header Validation Tests
7. Validate required headers present
8. Validate SKU header required
9. Validate quantity/warehouseId for inventory
10. Allow custom header mapping

#### Row Validation Tests
11. Valid row passes
12. Empty SKU fails
13. Negative quantity fails
14. Non-existent warehouse fails
15. Invalid numeric values fail
16. Duplicate SKU in file (warn or error)

#### Import Logic Tests
17. Import creates new products
18. Import updates existing products
19. Import creates inventory levels
20. Import updates inventory levels
21. Partial success on errors
22. Rollback on critical error
23. Org isolation enforced

#### Limits Tests
24. File size limit enforced
25. Row count limit enforced
26. Batch processing works

#### Error Reporting Tests
27. Errors collected per row
28. Error report downloadable
29. Import log created

### New Tests to Add: 10

30. Download products template
31. Download inventory template
32. Header mapping applied correctly
33. Preview returns first 5 rows
34. Import history list
35. Import history filtered by type
36. Import history pagination
37. Error count aggregation
38. Duration tracked accurately
39. Concurrent imports (job queue)
40. Import cancellation

---

## Phase C: Implementation Checklist

### Backend
- [ ] Create ImportLog migration
- [ ] Enhance import.service.ts with history
- [ ] Create import.controller.ts
- [ ] Create import.module.ts
- [ ] Create CSV templates
- [ ] Add template download endpoint
- [ ] Add history endpoint
- [ ] Add error report download

### Frontend
- [ ] Enhance ImportCsvModal with progress
- [ ] Create FileDropzone component
- [ ] Create ValidationPreview component
- [ ] Create ImportProgress component
- [ ] Create ImportHistory component
- [ ] Wire to useInventoryImport hook
- [ ] Add toast notifications

### Wiring
- [ ] Connect upload to API
- [ ] Connect validation preview
- [ ] Connect import action
- [ ] Handle errors gracefully
- [ ] Show progress updates

---

## Verification Checklist

- [ ] All 40 unit tests pass
- [ ] Can upload CSV file
- [ ] Validation shows errors before import
- [ ] Import progress visible
- [ ] Partial success handled
- [ ] Error report downloadable
- [ ] Import history visible
- [ ] Templates downloadable
- [ ] RTL Arabic layout correct
- [ ] Mobile responsive
- [ ] Dark mode supported
- [ ] File size limit enforced
- [ ] Row limit enforced
