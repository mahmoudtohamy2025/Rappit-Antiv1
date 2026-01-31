# INV-07: Inventory Audit Trail

## Problem Statement

Without an audit trail, businesses cannot answer critical questions:

- **Who** made this inventory change?
- **When** did this change happen?
- **What** was the previous value?
- **Why** was this change made?

This causes:
- **Compliance failures** - Auditors require change history
- **Unable to investigate discrepancies** - "Who reduced stock by 50?"
- **No accountability** - Staff can make changes without trace
- **Difficult debugging** - Can't understand how system got to current state
- **Security concerns** - Cannot detect unauthorized changes

### Common Scenarios

1. **Annual Audit** - Auditors need to see all inventory changes
2. **Discrepancy Investigation** - Find who/when stock was reduced
3. **Compliance Reporting** - SOX, ISO requirements for change tracking
4. **Performance Review** - Evaluate staff accuracy over time
5. **System Debugging** - Understand sequence of events leading to issue
6. **Fraud Detection** - Identify suspicious patterns of changes

---

## Business Logic

### What Gets Logged

Every inventory-related action creates an audit log entry:

| Action | Description | Example |
|--------|-------------|---------|
| CREATE | New inventory item created | Added SKU-001 with 100 units |
| UPDATE | Quantity changed | SKU-001: 100 → 95 |
| DELETE | Item removed | Removed SKU-001 |
| ADJUSTMENT | Manual correction | Cycle count adjustment |
| IMPORT | Bulk CSV import | Imported 500 items |
| CYCLE_COUNT | Physical verification | Counted 98, system had 100 |
| FORCE_RELEASE | Administrative release | Released stuck reservation |
| TRANSFER | Moved between warehouses | WH-A → WH-B: 10 units |
| RESERVE | Reserved for order | Order #123: reserved 5 |
| UNRESERVE | Reservation released | Order #123: released 5 |

### Audit Log Entry

```
┌──────────────────────────────────────────────┐
│ Audit Log Entry                              │
├──────────────────────────────────────────────┤
│ ID:           log-abc-123                    │
│ Timestamp:    2026-01-15 14:32:45            │
│ Action:       UPDATE                         │
│ User:         john.doe@company.com           │
│ Organization: Acme Corp                      │
│ Warehouse:    Cairo Main                     │
│ SKU:          SKU-001                        │
│ Previous Qty: 100                            │
│ New Qty:      95                             │
│ Variance:     -5                             │
│ Notes:        "Damaged items removed"        │
│ Metadata:     { orderId: "123", ... }        │
└──────────────────────────────────────────────┘
```

### Immutability Principle

**Audit logs are IMMUTABLE** - they cannot be:
- Modified after creation
- Deleted (except by retention policy)
- Backdated

This ensures the audit trail is trustworthy for compliance.

---

## API Design

### Log Change (Usually Automatic)

```typescript
logChange(
    input: {
        sku: string;
        warehouseId: string;
        previousQuantity: number;
        newQuantity: number;
        action: AuditAction;
        notes?: string;
        metadata?: Record<string, any>;
    },
    context: { organizationId: string; userId: string; warehouseId: string }
): Promise<AuditEntry>

interface AuditEntry {
    id: string;
    organizationId: string;
    warehouseId: string;
    userId: string;
    sku: string;
    action: AuditAction;
    previousQuantity: number;
    newQuantity: number;
    variance: number;              // Calculated: newQty - prevQty
    notes?: string;
    metadata?: Record<string, any>;
    createdAt: Date;
}
```

### Query Audit Logs

```typescript
query(
    query: {
        sku?: string;
        warehouseId?: string;
        action?: AuditAction;
        userId?: string;
        startDate?: Date;
        endDate?: Date;
        page?: number;
        pageSize?: number;
        sortBy?: 'createdAt' | 'sku' | 'action';
        sortOrder?: 'asc' | 'desc';
    },
    context: { organizationId: string }
): Promise<AuditQueryResult>

interface AuditQueryResult {
    items: AuditEntry[];
    pagination: {
        page: number;
        pageSize: number;
        totalItems: number;
        totalPages: number;
    };
}
```

### Get Item History

```typescript
getItemHistory(
    sku: string,
    options: {
        warehouseId?: string;
        limit?: number;
    },
    context: { organizationId: string }
): Promise<AuditEntry[]>
```

### Get Variance Summary

```typescript
getVarianceSummary(
    query: {
        startDate?: Date;
        endDate?: Date;
    },
    context: { organizationId: string }
): Promise<AuditSummary>

interface AuditSummary {
    totalVariance: number;           // Net change
    positiveVariance: number;        // Total increases
    negativeVariance: number;        // Total decreases (absolute)
    absoluteVariance: number;        // Sum of absolute changes
    entryCount: number;              // Number of entries
}
```

### Get Activity by User

```typescript
getActivityByUser(
    query: {
        startDate?: Date;
        endDate?: Date;
    },
    context: { organizationId: string }
): Promise<UserActivity[]>

interface UserActivity {
    userId: string;
    userName?: string;
    actionCount: number;
    totalVariance: number;
    lastActivityAt: Date;
}
```

### Get Activity by Action

```typescript
getActivityByAction(
    query: {
        startDate?: Date;
        endDate?: Date;
    },
    context: { organizationId: string }
): Promise<ActionActivity[]>

interface ActionActivity {
    action: AuditAction;
    count: number;
    totalVariance: number;
}
```

### Get Daily Trends

```typescript
getDailyTrends(
    query: {
        days?: number;              // Default: 30
    },
    context: { organizationId: string }
): Promise<DailyTrend[]>

interface DailyTrend {
    date: string;                   // YYYY-MM-DD
    count: number;
    variance: number;
}
```

### Export to CSV

```typescript
exportToCsv(
    query: AuditQuery,
    context: { organizationId: string }
): Promise<Buffer>                   // CSV file content
```

### Export to JSON

```typescript
exportToJson(
    query: AuditQuery,
    context: { organizationId: string }
): Promise<Buffer>                   // JSON file content
```

### Cleanup Old Entries (Retention)

```typescript
cleanupOldEntries(
    retentionDays: number,           // Delete entries older than X days
    context: { organizationId: string }
): Promise<{ deletedCount: number }>
```

---

## Automatic Logging

The audit service listens to events and logs automatically:

```typescript
// These events trigger automatic audit logging:
'inventory.updated'   → Creates UPDATE audit log
'inventory.created'   → Creates CREATE audit log  
'inventory.import.completed' → Creates IMPORT audit log
```

No manual logging required for these common operations.

---

## Audit Action Types

```typescript
enum AuditAction {
    CREATE = 'CREATE',
    UPDATE = 'UPDATE',
    DELETE = 'DELETE',
    ADJUSTMENT = 'ADJUSTMENT',
    IMPORT = 'IMPORT',
    CYCLE_COUNT = 'CYCLE_COUNT',
    FORCE_RELEASE = 'FORCE_RELEASE',
    TRANSFER = 'TRANSFER',
    RESERVE = 'RESERVE',
    UNRESERVE = 'UNRESERVE',
}
```

---

## Safety Guards

1. **Immutability** - Logs cannot be modified or deleted by users
2. **Automatic Logging** - Key events logged without manual intervention
3. **Cross-Org Isolation** - Can only see own organization's logs
4. **Input Sanitization** - Notes sanitized to prevent XSS
5. **Retention Policy** - Old logs automatically cleaned up
6. **Variance Calculation** - Automatically computed, not user-provided
7. **Timestamp Accuracy** - Server-side timestamps only
8. **Required Fields** - Cannot create incomplete entries

---

## Test Coverage Plan

### Unit Tests (~63 tests)

| Category | Tests |
|----------|-------|
| **Audit Event Creation** | 12 |
| - Create audit entry | |
| - Calculate variance correctly | |
| - Store all required fields | |
| - Sanitize notes (XSS prevention) | |
| - Generate unique ID | |
| - Use server timestamp | |
| - Store metadata as JSON | |
| - Handle missing optional fields | |
| - Reject negative IDs | |
| - Validate organization ID | |
| - Validate warehouse ID | |
| - Validate SKU format | |
| **Audit Action Types** | 10 |
| - Log CREATE action | |
| - Log UPDATE action | |
| - Log DELETE action | |
| - Log ADJUSTMENT action | |
| - Log IMPORT action | |
| - Log CYCLE_COUNT action | |
| - Log FORCE_RELEASE action | |
| - Log TRANSFER action | |
| - Log RESERVE action | |
| - Log UNRESERVE action | |
| **Query Features** | 10 |
| - Query by SKU | |
| - Query by warehouse | |
| - Query by action type | |
| - Query by user | |
| - Query by date range | |
| - Combine multiple filters | |
| - Sort by date (asc/desc) | |
| - Sort by SKU | |
| - Default sorting | |
| - Cross-org isolation | |
| **Pagination** | 5 |
| - Paginate results | |
| - Return correct total count | |
| - Handle page 0/1 edge case | |
| - Handle last page | |
| - Default page size | |
| **Aggregations** | 8 |
| - Calculate variance summary | |
| - Calculate positive variance | |
| - Calculate negative variance | |
| - Group by user | |
| - Group by action | |
| - Daily trends | |
| - Handle empty results | |
| - Date range filtering | |
| **Immutability** | 4 |
| - Reject modifications | |
| - Reject deletions (by user) | |
| - Reject backdating | |
| - Enforce server timestamp | |
| **Retention Policy** | 4 |
| - Delete entries older than X days | |
| - Respect organization isolation | |
| - Return deleted count | |
| - Handle no entries to delete | |
| **Export Capabilities** | 4 |
| - Export to CSV | |
| - Export to JSON | |
| - Apply filters to export | |
| - Handle large exports | |
| **Event Listeners** | 3 |
| - Listen to inventory.updated | |
| - Listen to inventory.created | |
| - Listen to inventory.import.completed | |
| **Hardening** | 3 |
| - Database failure handling | |
| - Large dataset performance | |
| - Concurrent logging | |

### Integration Tests (~27 tests)

| Category | Tests |
|----------|-------|
| E2E Workflow | 6 |
| Event-Driven Logging | 5 |
| Query Performance | 4 |
| Cross-Org Security | 4 |
| Export Functionality | 4 |
| Retention Policy | 2 |
| Hardening | 2 |

---

## Data Model

### InventoryAuditLog

```typescript
interface InventoryAuditLog {
    id: string;
    organizationId: string;
    warehouseId: string;
    userId: string;
    sku: string;
    action: AuditAction;
    previousQuantity: number;
    newQuantity: number;
    variance: number;
    previousReserved?: number;
    newReserved?: number;
    notes?: string;
    metadata?: {
        orderId?: string;
        importId?: string;
        cycleCountId?: string;
        transferId?: string;
        reservationId?: string;
        [key: string]: any;
    };
    createdAt: Date;
}
```

---

## Sample Queries

### "Who changed SKU-001 last week?"

```typescript
const result = await auditService.query({
    sku: 'SKU-001',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-01-07'),
}, context);
```

### "Show all changes by John today"

```typescript
const result = await auditService.query({
    userId: 'john@company.com',
    startDate: new Date('2026-01-15'),
    endDate: new Date('2026-01-15T23:59:59'),
}, context);
```

### "Export all imports this month"

```typescript
const csv = await auditService.exportToCsv({
    action: AuditAction.IMPORT,
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-01-31'),
}, context);
```

---

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| DEFAULT_PAGE_SIZE | 20 | Results per page |
| MAX_PAGE_SIZE | 100 | Maximum results per page |
| RETENTION_DAYS | 365 | Days to keep logs (1 year) |
| AUTO_LOG_EVENTS | true | Enable automatic event logging |

---

## Implementation File

`src/modules/inventory/inventory-audit.service.ts`

## Total Tests: 90 (63 unit + 27 integration)
