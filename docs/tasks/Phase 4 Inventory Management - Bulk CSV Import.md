# INV-01: Bulk CSV Import

## Problem Statement

When managing inventory across large operations, manually entering thousands of inventory items is time-consuming, error-prone, and impractical. Warehouses need to import inventory data from external systems (ERP, suppliers, physical counts) in bulk.

### Common Scenarios

1. **Initial System Setup** - Loading existing inventory when first adopting the system
2. **Supplier Delivery** - Receiving large shipments with 100+ SKUs
3. **Warehouse Takeover** - Inheriting inventory from acquired business
4. **System Migration** - Moving data from legacy system
5. **Seasonal Restocking** - Pre-holiday inventory loading

Without this feature, staff would need to manually enter each item one-by-one, which for 5,000 items at 2 minutes each = 166 hours of manual work!

---

## Business Logic

### Import Flow

```
[CSV File Upload]
        │
        ▼
[Parse & Validate Headers]
        │
        ├──▶ Invalid Headers → Return Error
        │
        ▼
[Validate Each Row]
        │
        ├──▶ Invalid Rows → Collect in Error Report
        │
        ▼
[Check for Duplicates]
        │
        ├──▶ updateExisting: true → Update existing items
        │
        ├──▶ skipDuplicates: true → Skip without error
        │
        └──▶ Neither → Error on duplicates
        │
        ▼
[Batch Insert/Update]
        │
        ▼
[Return Summary Report]
```

### CSV Format

| Column | Required | Description | Example |
|--------|----------|-------------|---------|
| sku | ✅ Yes | Product SKU | `ABC-12345` |
| name | ✅ Yes | Product name | `Widget Pro` |
| quantity | ✅ Yes | Stock quantity | `100` |
| warehouseId | ✅ Yes | Warehouse identifier | `wh-cairo-01` |
| minStock | ❌ No | Reorder threshold | `10` |
| maxStock | ❌ No | Maximum capacity | `500` |
| unitCost | ❌ No | Cost per unit | `25.99` |
| location | ❌ No | Bin/shelf location | `A-12-3` |

### Example CSV

```csv
sku,name,quantity,warehouseId,minStock,maxStock,location
ABC-001,Widget Small,100,wh-cairo-01,10,500,A-12-1
ABC-002,Widget Medium,75,wh-cairo-01,15,400,A-12-2
ABC-003,Widget Large,50,wh-cairo-01,5,200,A-12-3
```

### Import Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| updateExisting | boolean | false | Update if SKU already exists |
| skipDuplicates | boolean | false | Skip duplicates silently |
| validateOnly | boolean | false | Dry run - validate without importing |
| batchSize | number | 100 | Records per batch (performance) |

---

## API Design

### Import from CSV

```typescript
importFromCsv(
    file: Buffer,                    // The CSV file content
    options: {
        updateExisting?: boolean;    // Update existing SKUs
        skipDuplicates?: boolean;    // Skip duplicates without error
        validateOnly?: boolean;      // Dry run mode
        batchSize?: number;          // Records per transaction
    },
    context: {
        organizationId: string;
        userId: string;
    }
): Promise<ImportResult>
```

### Import Result

```typescript
interface ImportResult {
    success: boolean;
    importId: string;                // For tracking progress
    summary: {
        totalRows: number;           // Total rows in file
        imported: number;            // Successfully imported
        updated: number;             // Updated existing items
        skipped: number;             // Skipped (duplicates)
        failed: number;              // Failed validation
    };
    errors: ImportError[];           // Detailed error list
    duration: number;                // Time in milliseconds
}

interface ImportError {
    row: number;                     // Row number in CSV
    sku: string;                     // SKU that failed
    field: string;                   // Which field failed
    message: string;                 // Error description
    value: any;                      // Invalid value
}
```

### Validate CSV (Dry Run)

```typescript
validateCsv(
    file: Buffer,
    context: { organizationId: string; userId: string }
): Promise<ValidationResult>
```

### Get Import Progress (Long-Running)

```typescript
getImportProgress(
    importId: string,
    context: { organizationId: string }
): Promise<ImportProgress>

interface ImportProgress {
    importId: string;
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
    progress: number;                // 0-100 percentage
    processedRows: number;
    totalRows: number;
    startedAt: Date;
    completedAt?: Date;
}
```

### Get Import History

```typescript
getImportHistory(
    filters: {
        startDate?: Date;
        endDate?: Date;
        status?: ImportStatus;
    },
    context: { organizationId: string }
): Promise<ImportHistoryItem[]>
```

---

## Validation Rules

| Rule | Description | Error Message |
|------|-------------|---------------|
| Required Fields | sku, name, quantity, warehouseId | `Missing required field: {field}` |
| SKU Format | Alphanumeric + dashes | `Invalid SKU format` |
| Quantity | Positive integer | `Quantity must be positive` |
| Warehouse Exists | Must exist in system | `Warehouse not found: {id}` |
| Organization Match | Warehouse belongs to org | `Warehouse not in organization` |
| No Empty SKU | SKU cannot be empty/whitespace | `SKU cannot be empty` |
| Numeric Fields | quantity, minStock, maxStock | `{field} must be a number` |

---

## Safety Guards

1. **Transaction Rollback** - If critical error, rollback entire batch
2. **Batch Processing** - Process in chunks to prevent memory issues
3. **Rate Limiting** - Max 10 imports per hour per organization
4. **File Size Limit** - Maximum 10MB file size
5. **Row Limit** - Maximum 50,000 rows per import
6. **Organization Isolation** - Cannot import to other org's warehouses
7. **Duplicate Handling** - Configurable behavior for existing SKUs
8. **Audit Trail** - Every import logged with user, timestamp, results

---

## Test Coverage Plan

### Unit Tests (~65 tests)

| Category | Tests |
|----------|-------|
| **CSV Parsing** | 12 |
| - Parse valid CSV with all columns | |
| - Parse CSV with only required columns | |
| - Handle different line endings (Windows/Unix) | |
| - Handle quoted fields with commas | |
| - Handle UTF-8 characters (Arabic, etc.) | |
| - Reject invalid CSV structure | |
| - Handle empty file | |
| - Handle file with only headers | |
| - Handle missing headers | |
| - Handle extra columns (ignore) | |
| - Handle different column orders | |
| - Handle BOM (Byte Order Mark) | |
| **Validation** | 15 |
| - Validate required fields present | |
| - Validate SKU format | |
| - Validate quantity is positive | |
| - Validate warehouse exists | |
| - Validate warehouse in organization | |
| - Validate numeric fields | |
| - Validate min/max stock logic | |
| - Collect multiple errors per row | |
| - Continue validation after errors | |
| - Return row numbers in errors | |
| - Sanitize input (XSS prevention) | |
| - Handle null/undefined values | |
| - Handle whitespace trimming | |
| - Handle empty strings | |
| - Validate maximum field lengths | |
| **Import Logic** | 15 |
| - Successfully import valid rows | |
| - Skip invalid rows, import valid | |
| - Update existing when flag enabled | |
| - Skip duplicates when flag enabled | |
| - Error on duplicates when neither flag | |
| - Batch processing (100 per batch) | |
| - Calculate correct totals | |
| - Return detailed error report | |
| - Handle partial success | |
| - Create audit log entries | |
| - Emit import events | |
| - Handle empty valid set | |
| - Handle all rows invalid | |
| - Preserve original row numbers in errors | |
| - Calculate import duration | |
| **Progress Tracking** | 8 |
| - Create import record on start | |
| - Update progress during processing | |
| - Mark completed on success | |
| - Mark failed on error | |
| - Calculate accurate percentage | |
| - Store start/end timestamps | |
| - Allow progress query during import | |
| - Handle concurrent progress queries | |
| **Hardening** | 15 |
| - Database failure recovery | |
| - Transaction rollback on error | |
| - Large file handling (10K rows) | |
| - Memory efficient processing | |
| - Timeout handling | |
| - Concurrent import prevention | |
| - Rate limiting enforcement | |
| - File size limit | |
| - Row limit enforcement | |
| - Cross-org isolation | |
| - Invalid file type rejection | |
| - Corrupted file handling | |
| - Network interruption recovery | |
| - Duplicate import ID prevention | |
| - Cleanup on failure | |

### Integration Tests (~40 tests)

| Category | Tests |
|----------|-------|
| E2E Workflow | 10 |
| Large File Processing | 8 |
| Error Recovery | 8 |
| Security | 6 |
| Performance | 5 |
| Concurrent Operations | 3 |

---

## Data Model

### Import Record

```typescript
interface ImportRecord {
    id: string;
    organizationId: string;
    userId: string;
    fileName: string;
    fileSize: number;
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
    options: {
        updateExisting: boolean;
        skipDuplicates: boolean;
        validateOnly: boolean;
        batchSize: number;
    };
    summary: {
        totalRows: number;
        imported: number;
        updated: number;
        skipped: number;
        failed: number;
    };
    errors: ImportError[];
    startedAt: Date;
    completedAt?: Date;
    duration?: number;
    createdAt: Date;
}
```

---

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| MAX_FILE_SIZE | 10MB | Maximum upload size |
| MAX_ROWS | 50,000 | Maximum rows per import |
| BATCH_SIZE | 100 | Default batch size |
| RATE_LIMIT | 10/hour | Imports per hour per org |
| TIMEOUT | 5 minutes | Maximum processing time |

---

## Implementation File

`src/modules/inventory/inventory-import.service.ts`

## Total Tests: 105 (65 unit + 40 integration)
