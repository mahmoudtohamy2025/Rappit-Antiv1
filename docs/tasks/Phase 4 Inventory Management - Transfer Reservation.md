# INV-06: Transfer Reservation Request

## Problem Statement

When fulfilling orders across multiple warehouses or during inventory rebalancing, **reserved inventory** often needs to be **transferred** from one location to another while maintaining the reservation link to the original order.

### Common Scenarios

1. **Regional Fulfillment** - Order placed in Cairo but stock only in Alexandria warehouse
2. **Warehouse Consolidation** - Moving inventory from closing warehouse
3. **Stock Rebalancing** - Distributing inventory based on regional demand
4. **Backorder Fulfillment** - When expected stock arrives at different location

**Without this feature**, transfers require releasing the reservation, risking oversell during the gap.

---

## Business Logic

### Transfer Types

| Type | Description | Use Case |
|------|-------------|----------|
| IMMEDIATE | Transfer completes instantly | Same-facility or pre-approved transfers |
| PENDING | Requires approval before transfer | Cross-region or high-value items |
| SCHEDULED | Transfer at specific future time | Batch processing, overnight moves |

### Transfer Lifecycle

```
[Warehouse A: Reserved 10 for Order #123]
        │
        ▼ Transfer Request Created
[Transfer Request: PENDING]
        │
        ├──▶ Manager Approves
        │         │
        │         ▼
        │    [Warehouse A: Reserved 0]
        │    [Warehouse B: Reserved 10 for Order #123]
        │    [Transfer: COMPLETED]
        │
        └──▶ Manager Rejects
                  │
                  ▼
             [Transfer: REJECTED]
             [Warehouse A: Still Reserved 10]
```

### Reservation Continuity

**Critical Requirement:** The reservation link to the order must be maintained throughout the transfer:

```typescript
// Before transfer
Reservation { orderId: "123", warehouseId: "WH-A", sku: "SKU-001", qty: 10 }

// After transfer (same order, different warehouse)
Reservation { orderId: "123", warehouseId: "WH-B", sku: "SKU-001", qty: 10 }
```

---

## Transfer Statuses

| Status | Description |
|--------|-------------|
| PENDING | Awaiting approval |
| APPROVED | Approved, ready to execute |
| IN_TRANSIT | Being transferred |
| COMPLETED | Successfully transferred |
| REJECTED | Denied by approver |
| CANCELLED | Cancelled by requester |
| FAILED | Transfer failed (rollback occurred) |

---

## Priority Levels

Priorities determine processing order (configurable, can add more):

| Priority | Description |
|----------|-------------|
| LOW | Standard processing |
| NORMAL | Default priority |
| HIGH | Process before NORMAL |
| URGENT | Process first |

---

## API Design

### Create Transfer Request

```typescript
createTransferRequest(
    request: {
        reservationId: string;       // Original reservation
        sourceWarehouseId: string;   // From
        targetWarehouseId: string;   // To
        quantity: number;            // Amount to transfer (can be partial)
        transferType: 'IMMEDIATE' | 'PENDING' | 'SCHEDULED';
        scheduledAt?: Date;          // For SCHEDULED type
        reason: string;              // Required justification
        priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
    },
    context: { organizationId: string; userId: string }
): Promise<TransferRequestResult>

interface TransferRequestResult {
    success: boolean;
    transferId?: string;
    status?: TransferStatus;         // APPROVED for IMMEDIATE, PENDING otherwise
    error?: string;
}
```

### Approve/Reject Transfer

```typescript
approveTransfer(
    transferId: string,
    options: { notes?: string },
    context: { organizationId: string; userId: string; userRole: string }
): Promise<TransferResult>

rejectTransfer(
    transferId: string,
    options: { reason: string },
    context: { organizationId: string; userId: string; userRole: string }
): Promise<TransferResult>

interface TransferResult {
    success: boolean;
    status?: TransferStatus;
    error?: string;
}
```

### Execute Transfer

```typescript
executeTransfer(
    transferId: string,
    context: { organizationId: string; userId: string }
): Promise<TransferResult>
```

### Query Transfers

```typescript
getTransferRequests(
    filters: {
        status?: TransferStatus;
        sourceWarehouseId?: string;
        targetWarehouseId?: string;
        priority?: Priority;
        sortByPriority?: boolean;
        page?: number;
        pageSize?: number;
    },
    context: { organizationId: string }
): Promise<{ items: TransferRequest[]; total: number }>
```

### Scheduling APIs

```typescript
// Reschedule a scheduled transfer
rescheduleTransfer(
    transferId: string,
    newScheduledAt: Date,
    context: { organizationId: string; userId: string }
): Promise<TransferResult>

// Cancel a transfer
cancelTransfer(
    transferId: string,
    reason: string,
    context: { organizationId: string; userId: string }
): Promise<TransferResult>

// Get transfers due for execution (for scheduled job)
getDueScheduledTransfers(
    context: { organizationId: string }
): Promise<TransferRequest[]>
```

### Configuration APIs

```typescript
// Get available priority levels (dynamic)
getAvailablePriorities(): TransferPriority[]
// Returns: ['LOW', 'NORMAL', 'HIGH', 'URGENT']

// Get notification configuration (dynamic)
getNotificationConfig(): NotificationConfig
// Returns: { notifyRequester: true, notifyWarehouseManagers: true, notifyOrderOwner: true }
```

---

## Access Control

### Transfer Creation
Any authenticated user can create a transfer request.

### Approval/Rejection

| Role | Can Approve? |
|------|-------------|
| ADMIN | ✅ Yes |
| WAREHOUSE_MANAGER | ✅ Yes |
| INVENTORY_MANAGER | ❌ No |
| USER | ❌ No |
| VIEWER | ❌ No |

---

## Safety Guards

1. **Quantity Validation** - Cannot transfer more than reserved
2. **Available Stock Check** - Source must have sufficient stock
3. **Same Organization** - Cross-org transfers blocked
4. **Warehouse Existence** - Both warehouses must exist
5. **Active Reservation** - Reservation must be active
6. **No Double Transfer** - Cannot transfer same reservation twice
7. **Source/Target Different** - Cannot transfer to same warehouse
8. **Approval Status** - Cannot execute un-approved transfers
9. **Transaction Rollback** - Rollback on any failure
10. **Audit Trail** - Full logging of all transfer actions

---

## Notifications

Configurable, currently enabled for all:

| Recipient | When Notified |
|-----------|---------------|
| Requester | On all status changes |
| Source Warehouse Manager | On request, approval, completion |
| Target Warehouse Manager | On request, approval, completion |
| Order Owner | On completion (their order's stock moved) |

---

## Test Coverage Plan

### Unit Tests (~64 tests)

| Category | Tests |
|----------|-------|
| **Create Transfer Request** | 10 |
| - Successfully create IMMEDIATE transfer (auto-approved) | |
| - Successfully create PENDING transfer | |
| - Successfully create SCHEDULED transfer | |
| - Reject if reservation not found | |
| - Reject if source warehouse mismatch | |
| - Reject if quantity exceeds reserved | |
| - Reject if target warehouse doesn't exist | |
| - Reject if same source and target | |
| - Reject if reservation already being transferred | |
| - Allow partial quantity transfer | |
| **Approve/Reject Transfer** | 8 |
| - Successfully approve pending transfer | |
| - Successfully reject pending transfer | |
| - Reject if already approved | |
| - Reject if already rejected | |
| - Reject if not PENDING status | |
| - Record approver and timestamp | |
| - Emit approval notification | |
| - Permission check (ADMIN/WAREHOUSE_MANAGER only) | |
| **Execute Transfer** | 10 |
| - Successfully execute transfer | |
| - Update source warehouse (decrease reserved) | |
| - Update target warehouse (increase reserved) | |
| - Maintain reservation-order link | |
| - Handle partial quantity transfer | |
| - Handle full quantity transfer | |
| - Reject if not APPROVED status | |
| - Rollback on failure | |
| - Emit transfer completed event | |
| - Create audit log entry | |
| **Scheduled Transfers** | 6 |
| - Mark for scheduled execution | |
| - Reject scheduled time in past | |
| - Allow reschedule before execution | |
| - Allow cancel scheduled transfer | |
| - Get due scheduled transfers | |
| - Sort by priority | |
| **Query Transfers** | 5 |
| - Get all pending transfers | |
| - Filter by source warehouse | |
| - Filter by target warehouse | |
| - Filter by priority | |
| - Support pagination | |
| **Notifications** | 4 |
| - Notify requester on creation | |
| - Notify warehouse managers | |
| - Notify order owner on completion | |
| - Use configurable notification settings | |
| **Priority Levels** | 3 |
| - Accept all defined priority levels | |
| - Default to NORMAL priority | |
| - Expose available priorities | |
| **Hardening** | 18 |
| - Database connection failure | |
| - Transaction failure with rollback | |
| - Partial update failure | |
| - Prevent duplicate transfer requests | |
| - Handle concurrent approve/reject | |
| - Empty reservation ID | |
| - Zero quantity | |
| - Negative quantity | |
| - Empty reason | |
| - Sanitize reason text (XSS) | |
| - Require WAREHOUSE_MANAGER for approval | |
| - Require ADMIN for approval | |
| - Reject USER role for approval | |
| - Cross-org isolation on approval | |
| - Efficient query performance | |
| - Large batch handling | |

### Integration Tests (~25 tests)

| Category | Tests |
|----------|-------|
| E2E Transfer Workflow | 8 |
| Approval Flow | 5 |
| Security | 4 |
| Notifications | 3 |
| Concurrent Operations | 2 |
| Database Failures | 2 |
| Performance | 2 |

---

## Data Model

### TransferRequest

```typescript
interface TransferRequest {
    id: string;
    organizationId: string;
    reservationId: string;
    sourceWarehouseId: string;
    targetWarehouseId: string;
    sku: string;
    quantity: number;
    transferType: 'IMMEDIATE' | 'PENDING' | 'SCHEDULED';
    status: TransferStatus;
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
    reason: string;
    scheduledAt?: Date;
    requestedBy: string;
    requestedAt: Date;
    approvedBy?: string;
    approvedAt?: Date;
    rejectedBy?: string;
    rejectedAt?: Date;
    rejectionReason?: string;
    completedAt?: Date;
    notes?: string;
}
```

### TransferStatus Enum

```typescript
enum TransferStatus {
    PENDING = 'PENDING',
    APPROVED = 'APPROVED',
    IN_TRANSIT = 'IN_TRANSIT',
    COMPLETED = 'COMPLETED',
    REJECTED = 'REJECTED',
    CANCELLED = 'CANCELLED',
    FAILED = 'FAILED',
}
```

### TransferType Enum

```typescript
enum TransferType {
    IMMEDIATE = 'IMMEDIATE',
    PENDING = 'PENDING',
    SCHEDULED = 'SCHEDULED',
}
```

### TransferPriority Enum

```typescript
enum TransferPriority {
    LOW = 'LOW',
    NORMAL = 'NORMAL',
    HIGH = 'HIGH',
    URGENT = 'URGENT',
}
```

---

## Design Decisions (Approved by User)

| Decision | User Choice |
|----------|-------------|
| Approval roles | Both **ADMIN** and **WAREHOUSE_MANAGER** |
| IMMEDIATE transfers | **Auto-approved** (best practice) |
| Priority levels | **4 levels**, make dynamic for future changes |
| Partial transfers | **Yes**, allow transferring 5 of 10 reserved |
| Notifications | **All recipients**, make dynamic for future changes |

---

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| APPROVAL_ROLES | ['ADMIN', 'WAREHOUSE_MANAGER'] | Who can approve |
| DEFAULT_PRIORITY | NORMAL | Default if not specified |
| NOTIFY_REQUESTER | true | Notify on status changes |
| NOTIFY_MANAGERS | true | Notify warehouse managers |
| NOTIFY_ORDER_OWNER | true | Notify on completion |

---

## Implementation File

`src/modules/inventory/transfer-reservation.service.ts`

## Total Tests: 89 (64 unit + 25 integration)
