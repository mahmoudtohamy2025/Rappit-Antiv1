# INV-03: Bulk Inventory Update / Cycle Count

## Problem Statement

Physical inventory counts (cycle counts) are essential for maintaining accurate inventory records. Over time, system quantities drift from actual quantities due to theft, damage, miscounts, and system errors. Without regular verification, businesses experience:

- **Overselling** - Selling items not actually in stock
- **Lost Sales** - Items in stock but system shows zero 
- **Financial Discrepancies** - Book value doesn't match physical value
- **Audit Failures** - Compliance issues with inaccurate records

### Common Scenarios

1. **Annual Physical Inventory** - Complete warehouse count once a year
2. **Rolling Cycle Counts** - Count portion of inventory each week
3. **ABC Cycle Counting** - High-value items counted more frequently
4. **Spot Checks** - Random verification of specific SKUs
5. **Discrepancy Investigation** - Verify quantities after reported issues
6. **Post-Shipment Verification** - Confirm remaining stock after large orders

---

## Business Logic

### Cycle Count Lifecycle

```
[Create Cycle Count Session]
        │
        ▼
[Select SKUs to Count]
        │
        ├──▶ All SKUs in warehouse
        ├──▶ Specific SKU list
        └──▶ By category/zone
        │
        ▼
[Lock Items] ← Prevents changes during count
        │
        ▼
[Record Physical Counts]
        │
        ├──▶ Count: 100, System: 95 → Variance: +5
        ├──▶ Count: 50, System: 60 → Variance: -10
        └──▶ Count: 25, System: 25 → Variance: 0
        │
        ▼
[Review Variances]
        │
        ├──▶ Within Threshold → Auto-approve
        └──▶ Exceeds Threshold → Requires Manager Approval
        │
        ▼
[Complete Cycle Count]
        │
        ├──▶ Apply Adjustments → Update inventory quantities
        └──▶ Cancel → Discard counts, unlock items
```

### Variance Calculation

```typescript
variance = countedQuantity - systemQuantity

// Examples:
// Positive variance: Found more than expected (good!)
// Negative variance: Found less than expected (loss)
// Zero variance: Perfect match
```

### Variance Thresholds

| Threshold Type | Default | Description |
|---------------|---------|-------------|
| Auto-Approve | ±2% | Apply without review |
| Manager Review | ±2% to ±10% | Requires manager approval |
| Executive Review | >±10% | Requires executive approval |
| Dollar Threshold | >$1000 | Regardless of percentage |

---

## Cycle Count Statuses

| Status | Description |
|--------|-------------|
| DRAFT | Session created, not started |
| IN_PROGRESS | Counting underway |
| PENDING_REVIEW | Counts complete, awaiting approval |
| APPROVED | Adjustments approved |
| APPLIED | Adjustments applied to inventory |
| CANCELLED | Session cancelled |
| EXPIRED | Session expired without completion |

---

## API Design

### Create Cycle Count Session

```typescript
createCycleCount(
    request: {
        warehouseId: string;         // Which warehouse
        name: string;                // "Q1 2026 Cycle Count"
        skus?: string[];             // Specific SKUs (optional)
        zoneId?: string;             // Specific zone (optional)
        categoryId?: string;         // Specific category (optional)
        dueDate?: Date;              // Deadline
        assigneeId?: string;         // Assigned counter
        notes?: string;              // Instructions
    },
    context: { organizationId: string; userId: string }
): Promise<CycleCountResult>

interface CycleCountResult {
    success: boolean;
    cycleCountId: string;
    itemCount: number;              // Number of items to count
    status: CycleCountStatus;
}
```

### Get Cycle Count Details

```typescript
getCycleCount(
    cycleCountId: string,
    context: { organizationId: string }
): Promise<CycleCount>

interface CycleCount {
    id: string;
    name: string;
    warehouseId: string;
    status: CycleCountStatus;
    items: CycleCountItem[];
    summary: {
        totalItems: number;
        countedItems: number;
        remainingItems: number;
        totalVariance: number;
        positiveVariance: number;
        negativeVariance: number;
    };
    createdBy: string;
    assigneeId?: string;
    dueDate?: Date;
    startedAt?: Date;
    completedAt?: Date;
}
```

### Record a Count

```typescript
recordCount(
    cycleCountId: string,
    count: {
        sku: string;
        countedQuantity: number;
        location?: string;           // Physical location verified
        notes?: string;              // Counter notes
    },
    context: { organizationId: string; userId: string }
): Promise<CountResult>

interface CountResult {
    success: boolean;
    item: {
        sku: string;
        systemQuantity: number;
        countedQuantity: number;
        variance: number;
        variancePercentage: number;
        requiresApproval: boolean;
    };
}
```

### Record Batch Counts

```typescript
recordBatchCounts(
    cycleCountId: string,
    counts: Array<{
        sku: string;
        countedQuantity: number;
        location?: string;
        notes?: string;
    }>,
    context: { organizationId: string; userId: string }
): Promise<BatchCountResult>
```

### Complete Cycle Count

```typescript
completeCycleCount(
    cycleCountId: string,
    options: {
        applyAdjustments: boolean;   // Apply changes to inventory
        approvalNotes?: string;      // Justification
    },
    context: { organizationId: string; userId: string }
): Promise<CompletionResult>

interface CompletionResult {
    success: boolean;
    adjustmentsApplied: number;
    totalVariance: number;
    auditLogId: string;
}
```

### Get Variance Report

```typescript
getVarianceReport(
    cycleCountId: string,
    options: {
        showZeroVariance?: boolean;  // Include perfect matches
        sortBy?: 'variance' | 'percentage' | 'sku';
        order?: 'asc' | 'desc';
    },
    context: { organizationId: string }
): Promise<VarianceReport>

interface VarianceReport {
    cycleCountId: string;
    warehouseId: string;
    countDate: Date;
    items: VarianceItem[];
    summary: {
        totalItems: number;
        itemsWithVariance: number;
        positiveVarianceTotal: number;
        negativeVarianceTotal: number;
        netVariance: number;
        varianceValue: number;       // Dollar value
    };
}

interface VarianceItem {
    sku: string;
    name: string;
    location?: string;
    systemQuantity: number;
    countedQuantity: number;
    variance: number;
    variancePercentage: number;
    unitCost?: number;
    varianceValue?: number;         // variance × unitCost
    notes?: string;
    countedBy: string;
    countedAt: Date;
}
```

### Approve/Reject Adjustments

```typescript
approveAdjustments(
    cycleCountId: string,
    approvals: Array<{
        sku: string;
        approved: boolean;
        reason?: string;
    }>,
    context: { organizationId: string; userId: string }
): Promise<ApprovalResult>
```

### Cancel Cycle Count

```typescript
cancelCycleCount(
    cycleCountId: string,
    reason: string,
    context: { organizationId: string; userId: string }
): Promise<CancelResult>
```

---

## Safety Guards

1. **Item Locking** - Items locked during count to prevent conflicting changes
2. **Session Timeout** - Auto-expire incomplete sessions after 24 hours
3. **Recount Limit** - Maximum 3 recounts per item per session
4. **Approval Requirements** - Large variances require management approval
5. **Audit Trail** - Every count and adjustment logged
6. **Concurrent Prevention** - Cannot have multiple active counts for same SKU
7. **Rollback Capability** - Can reverse applied adjustments within 24 hours
8. **Organization Isolation** - Cross-org data completely isolated

---

## Test Coverage Plan

### Unit Tests (~75 tests)

| Category | Tests |
|----------|-------|
| **Create Cycle Count** | 12 |
| - Create for entire warehouse | |
| - Create for specific SKUs | |
| - Create for zone | |
| - Create for category | |
| - Assign to specific user | |
| - Set due date | |
| - Reject if warehouse not found | |
| - Reject if SKUs not in warehouse | |
| - Reject if already active count exists | |
| - Lock items on creation | |
| - Cross-org isolation | |
| - Create audit log entry | |
| **Record Counts** | 15 |
| - Record single count | |
| - Record batch counts | |
| - Calculate variance correctly | |
| - Calculate percentage correctly | |
| - Handle zero count | |
| - Handle large quantities | |
| - Reject negative quantities | |
| - Reject if not in cycle count | |
| - Reject if already counted (without recount flag) | |
| - Allow recount up to limit | |
| - Reject if session not active | |
| - Store counter ID and timestamp | |
| - Store location if provided | |
| - Store notes if provided | |
| - Update session progress | |
| **Variance Handling** | 10 |
| - Calculate positive variance | |
| - Calculate negative variance | |
| - Calculate zero variance | |
| - Calculate variance percentage | |
| - Flag items exceeding threshold | |
| - Auto-approve within threshold | |
| - Require approval above threshold | |
| - Apply dollar threshold | |
| - Handle items with no cost | |
| - Aggregate variances correctly | |
| **Complete Cycle Count** | 12 |
| - Complete and apply adjustments | |
| - Complete without applying | |
| - Update inventory quantities | |
| - Unlock items on completion | |
| - Create adjustment audit logs | |
| - Reject if not all items counted | |
| - Allow partial completion | |
| - Reject if pending approvals | |
| - Calculate total adjustments | |
| - Record completion timestamp | |
| - Emit completion event | |
| - Generate variance report | |
| **Approval Flow** | 8 |
| - Approve individual adjustments | |
| - Reject individual adjustments | |
| - Approve all at once | |
| - Reject all at once | |
| - Store approver and timestamp | |
| - Require manager role | |
| - Store rejection reason | |
| - Emit approval/rejection events | |
| **Cancel/Expire** | 6 |
| - Cancel active session | |
| - Unlock items on cancel | |
| - Store cancellation reason | |
| - Auto-expire after timeout | |
| - Cannot cancel completed session | |
| - Emit cancellation event | |
| **Hardening** | 12 |
| - Database failure recovery | |
| - Transaction rollback | |
| - Concurrent access handling | |
| - Large warehouse (10K SKUs) | |
| - Lock timeout handling | |
| - Session recovery after crash | |
| - Duplicate prevention | |
| - Permission enforcement | |
| - Input validation | |
| - Rate limiting | |
| - Memory efficient processing | |
| - Timeout handling | |

### Integration Tests (~39 tests)

| Category | Tests |
|----------|-------|
| E2E Workflow | 12 |
| Variance Calculations | 8 |
| Approval Flow | 6 |
| Concurrent Operations | 5 |
| Security | 4 |
| Performance | 4 |

---

## Data Model

### CycleCount

```typescript
interface CycleCount {
    id: string;
    organizationId: string;
    warehouseId: string;
    name: string;
    status: CycleCountStatus;
    filter: {
        skus?: string[];
        zoneId?: string;
        categoryId?: string;
    };
    settings: {
        autoApproveThreshold: number;    // Percentage
        managerApproveThreshold: number; // Percentage
        dollarThreshold: number;
        allowRecount: boolean;
        maxRecounts: number;
        timeoutHours: number;
    };
    summary: {
        totalItems: number;
        countedItems: number;
        approvedItems: number;
        appliedItems: number;
        totalVariance: number;
        positiveVariance: number;
        negativeVariance: number;
        varianceValue: number;
    };
    assigneeId?: string;
    dueDate?: Date;
    createdBy: string;
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    cancelledAt?: Date;
    cancellationReason?: string;
}
```

### CycleCountItem

```typescript
interface CycleCountItem {
    id: string;
    cycleCountId: string;
    sku: string;
    systemQuantity: number;          // Quantity at start
    countedQuantity?: number;
    variance?: number;
    variancePercentage?: number;
    unitCost?: number;
    varianceValue?: number;
    location?: string;
    notes?: string;
    status: 'PENDING' | 'COUNTED' | 'APPROVED' | 'REJECTED' | 'APPLIED';
    countedBy?: string;
    countedAt?: Date;
    approvedBy?: string;
    approvedAt?: Date;
    rejectionReason?: string;
    recountCount: number;
    isLocked: boolean;
}
```

---

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| AUTO_APPROVE_THRESHOLD | 2% | Auto-approve if variance within |
| MANAGER_THRESHOLD | 10% | Manager approval required above |
| DOLLAR_THRESHOLD | $1000 | Approval required regardless of % |
| MAX_RECOUNTS | 3 | Maximum recounts per item |
| SESSION_TIMEOUT | 24 hours | Auto-expire incomplete sessions |
| LOCK_TIMEOUT | 30 minutes | Item lock duration |

---

## Implementation File

`src/modules/inventory/cycle-count.service.ts`

## Total Tests: 114 (75 unit + 39 integration)
