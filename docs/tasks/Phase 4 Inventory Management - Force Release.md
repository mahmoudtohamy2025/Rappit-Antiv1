# INV-05: Force Release Reservation

## Problem Statement

When orders are placed, inventory is "reserved" to ensure stock is available for fulfillment. Sometimes these reservations get "stuck" due to:

- **System failures** - Order processing crashed mid-way
- **Cancelled orders** - Order cancelled but reservation remains
- **Payment failures** - Payment declined but stock still reserved
- **Integration bugs** - Third-party systems failed to release
- **Timeout issues** - Order expired but cleanup didn't run

Stuck reservations cause:
- **Phantom stock-outs** - Items appear unavailable when they're actually in stock
- **Lost sales** - Cannot sell items that are really available
- **Inventory discrepancies** - Reports show wrong available quantities
- **Customer complaints** - "Why is it out of stock? I see it on the shelf!"

### Common Scenarios

1. **Stuck Order** - Order processing failed, reservation remains
2. **Expired Cart** - Customer abandoned cart but reservation persists
3. **System Recovery** - After system crash, clean up orphaned reservations
4. **Manual Override** - Admin needs to manually release for special cases
5. **Batch Cleanup** - Scheduled job to release all expired reservations

---

## Business Logic

### Force Release Flow

```
[Stuck Reservation]
        │
        ├──▶ Order #123 stuck for 2 hours
        │    Reserved: 10 units of SKU-001
        │    Status: Still ACTIVE (should be RELEASED)
        │
        ▼
[Admin Initiates Force Release]
        │
        ├──▶ Validates Permission (ADMIN or INVENTORY_MANAGER)
        ├──▶ Validates Reservation exists and is active
        │
        ▼
[Release Process]
        │
        ├──▶ Update reservation status: ACTIVE → FORCE_RELEASED
        ├──▶ Decrease reservedQuantity on inventory item
        ├──▶ Create audit log entry
        ├──▶ Emit event for downstream services
        └──▶ Notify order owner (optional)
        │
        ▼
[Result]
        │
        └──▶ 10 units now available for sale
```

### Reservation Lifecycle

```
[Order Placed] → ACTIVE
        │
        ├──▶ Order Fulfilled → RELEASED (normal)
        ├──▶ Order Cancelled → RELEASED (normal)
        └──▶ Stuck/Failed → FORCE_RELEASED (admin action)
```

### Expiry Cleanup Job

```
[Scheduled Job Runs]
        │
        ▼
[Find Reservations Older Than X Minutes]
        │
        ├──▶ Default: 30 minutes (configurable)
        │
        ▼
[Optional: Skip Active Orders]
        │
        ├──▶ If order still processing, skip
        │
        ▼
[Batch Release]
        │
        ├──▶ Default max: 500 per run (configurable)
        │
        ▼
[Create Audit Logs]
        │
        ▼
[Report Summary]
```

---

## Reason Codes

Every force release requires a reason code for audit purposes:

| Code | Description | When to Use |
|------|-------------|-------------|
| STUCK_ORDER | Order processing failed | Order stuck in processing state |
| ORDER_CANCELLED | Order was cancelled | Manual cleanup after cancellation |
| EXPIRED | Reservation too old | Automatic cleanup job |
| DUPLICATE | Duplicate reservation created | System bug created double reservation |
| ADMIN_OVERRIDE | General admin action | Manual intervention needed |
| SYSTEM_RECOVERY | System recovery needed | After system crash or failure |

---

## API Design

### Force Release Single Reservation

```typescript
forceReleaseReservation(
    reservationId: string,
    options: {
        reason: string;              // Detailed explanation
        reasonCode: ReleaseReasonCode;
        notifyOrderOwner?: boolean;  // Default: false
    },
    context: {
        organizationId: string;
        userId: string;
        userRole: string;            // Must be ADMIN or INVENTORY_MANAGER
    }
): Promise<ForceReleaseResult>

interface ForceReleaseResult {
    success: boolean;
    reservationId: string;
    sku: string;
    quantityReleased: number;
    previousStatus: string;
    error?: string;                  // If success is false
}
```

### Force Release All for SKU

```typescript
forceReleaseAllForSku(
    sku: string,
    options: {
        reason: string;
        reasonCode: ReleaseReasonCode;
        olderThanMinutes?: number;   // Only release old ones
        notifyOrderOwners?: boolean;
    },
    context: { organizationId: string; userId: string; userRole: string }
): Promise<BatchReleaseResult>

interface BatchReleaseResult {
    success: boolean;
    totalFound: number;              // Active reservations found
    releasedCount: number;           // Successfully released
    skippedCount: number;            // Skipped (e.g., active orders)
    totalQuantityReleased: number;
    errors?: string[];               // Any errors encountered
}
```

### Force Release Expired (Cleanup Job)

```typescript
forceReleaseExpired(
    options: {
        expiryMinutes?: number;      // Default: 30
        maxToRelease?: number;       // Default: 500
        dryRun?: boolean;            // Preview without releasing
        skipActiveOrders?: boolean;  // Don't release if order active
    },
    context: { organizationId: string; userId: string; userRole: string }
): Promise<BatchReleaseResult>

// Additional fields for cleanup result:
interface BatchReleaseResult {
    // ... same as above, plus:
    dryRun?: boolean;
    wouldRelease?: number;           // For dry run preview
    totalFound?: number;
    skippedCount?: number;
    totalQuantityReleased?: number;
}
```

### Get Default Configuration

```typescript
getDefaultConfig(): ForceReleaseConfig

interface ForceReleaseConfig {
    defaultExpiryMinutes: number;    // 30
    defaultMaxBatchSize: number;     // 500
    allowedRoles: string[];          // ['ADMIN', 'INVENTORY_MANAGER']
    enableNotifications: boolean;    // true
}
```

---

## Access Control

| Role | Can Force Release? |
|------|-------------------|
| ADMIN | ✅ Yes |
| INVENTORY_MANAGER | ✅ Yes |
| WAREHOUSE_MANAGER | ❌ No |
| USER | ❌ No |
| VIEWER | ❌ No |

---

## Safety Guards

1. **Permission Check** - Only ADMIN or INVENTORY_MANAGER can force release
2. **Active Check** - Can only release ACTIVE reservations
3. **Double Release Prevention** - Cannot release already-released reservation
4. **Reason Required** - Must provide reason for audit trail
5. **Batch Limits** - Maximum 500 releases per job run
6. **Organization Isolation** - Cannot release other org's reservations
7. **Notification Option** - Can notify affected order owners
8. **Dry Run Mode** - Preview before actual release
9. **Audit Trail** - Full logging of who, when, why
10. **Transaction Safety** - Rollback on failure

---

## Test Coverage Plan

### Unit Tests (~63 tests)

| Category | Tests |
|----------|-------|
| **Single Release** | 15 |
| - Successfully release active reservation | |
| - Reject if reservation not found | |
| - Reject if already released | |
| - Reject if wrong organization | |
| - Reject without reason | |
| - Reject with invalid reason code | |
| - Update inventory reserved quantity | |
| - Create audit log entry | |
| - Emit release event | |
| - Send notification if enabled | |
| - Don't send notification if disabled | |
| - Handle notification failure gracefully | |
| - Return released quantity | |
| - Sanitize reason text (XSS) | |
| - Handle graceful re-release attempt | |
| **Batch Release by SKU** | 12 |
| - Release all for SKU | |
| - Filter by age (olderThanMinutes) | |
| - Return accurate counts | |
| - Skip already released | |
| - Handle no matching reservations | |
| - Cross-org isolation | |
| - Create audit log for each | |
| - Emit batch notification | |
| - Handle partial failure | |
| - Update inventory correctly | |
| - Respect max limit | |
| - Return detailed summary | |
| **Expired Cleanup** | 12 |
| - Release expired reservations | |
| - Respect expiry threshold | |
| - Enforce batch limit | |
| - Support dry run | |
| - Skip active orders if flag set | |
| - Return detailed summary | |
| - Handle mixed states | |
| - Cross-org isolation | |
| - Calculate total quantity | |
| - Use default config if not specified | |
| - Handle empty result set | |
| - Create batch audit logs | |
| **Permission Check** | 8 |
| - Allow ADMIN role | |
| - Allow INVENTORY_MANAGER role | |
| - Reject USER role | |
| - Reject VIEWER role | |
| - Reject WAREHOUSE_MANAGER role | |
| - Throw ForbiddenException | |
| - Check on single release | |
| - Check on batch release | |
| **Reason Codes** | 8 |
| - Accept all valid codes | |
| - Reject invalid code | |
| - Require reason text | |
| - Reject empty reason | |
| - Store in audit log | |
| - Sanitize reason (XSS prevention) | |
| - Support custom reason text | |
| - Include in notification | |
| **Hardening** | 8 |
| - Database failure recovery | |
| - Concurrent releases | |
| - Large batch handling | |
| - Input validation | |
| - Transaction rollback | |
| - Memory efficient processing | |
| - Timeout handling | |
| - Performance under load | |

### Integration Tests (~24 tests)

| Category | Tests |
|----------|-------|
| E2E Release Workflow | 5 |
| Cross-Service Integration | 4 |
| Cleanup Job Scenarios | 4 |
| Security | 5 |
| Concurrent Operations | 2 |
| Database Failures | 2 |
| Performance | 2 |

---

## Data Model

### Reservation (relevant fields)

```typescript
interface Reservation {
    id: string;
    organizationId: string;
    warehouseId: string;
    sku: string;
    quantity: number;
    orderId: string;
    orderOwnerEmail?: string;
    status: ReservationStatus;
    createdAt: Date;
    releasedAt?: Date;
    releasedBy?: string;
    releaseReason?: string;
    releaseReasonCode?: ReleaseReasonCode;
}

enum ReservationStatus {
    ACTIVE = 'ACTIVE',
    RELEASED = 'RELEASED',
    FORCE_RELEASED = 'FORCE_RELEASED',
    FULFILLED = 'FULFILLED',
    CANCELLED = 'CANCELLED',
}

enum ReleaseReasonCode {
    STUCK_ORDER = 'STUCK_ORDER',
    ORDER_CANCELLED = 'ORDER_CANCELLED',
    EXPIRED = 'EXPIRED',
    DUPLICATE = 'DUPLICATE',
    ADMIN_OVERRIDE = 'ADMIN_OVERRIDE',
    SYSTEM_RECOVERY = 'SYSTEM_RECOVERY',
}
```

---

## Design Decisions (Approved by User)

| Decision | User Choice |
|----------|-------------|
| Required roles for force release | Both **ADMIN** and **INVENTORY_MANAGER** |
| Default expiry threshold | **30 minutes** (configurable) |
| Default batch limit | **500** (configurable) |
| Notify order owner on release | **Yes** (optional per call) |

---

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| DEFAULT_EXPIRY_MINUTES | 30 | When reservation considered expired |
| DEFAULT_MAX_BATCH_SIZE | 500 | Max releases per cleanup job |
| ENABLE_NOTIFICATIONS | true | Send notifications to order owners |
| ALLOWED_ROLES | ['ADMIN', 'INVENTORY_MANAGER'] | Who can force release |

---

## Implementation File

`src/modules/inventory/force-release.service.ts`

## Total Tests: 87 (63 unit + 24 integration)
