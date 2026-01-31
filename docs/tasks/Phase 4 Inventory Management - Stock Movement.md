# INV-02: Stock Movement & Transfers

## Problem Statement

Inventory constantly moves within and between warehouses. Without proper tracking, businesses lose visibility into:

- **Where stock is going** - Items disappear without trace
- **Why stock moved** - No record of movement reasons
- **Who moved stock** - No accountability
- **Movement history** - Can't analyze patterns

### Common Scenarios

1. **Internal Transfers** - Move stock between warehouses
2. **Receiving** - Stock arriving from suppliers (purchase orders)
3. **Shipping** - Stock leaving for customers (orders)
4. **Returns Processing** - Returned items back to inventory
5. **Damage Write-off** - Remove damaged items from system
6. **Inventory Adjustment** - Correct discrepancies (cycle count, audit)

---

## Business Logic

### Movement Types

| Type | Direction | Description | Use Case |
|------|-----------|-------------|----------|
| RECEIVE | Inbound | Stock from supplier | Purchase orders, restocking |
| SHIP | Outbound | Stock to customer | Order fulfillment |
| RETURN | Inbound | Customer return | Returns processing |
| TRANSFER_OUT | Outbound | Leaving warehouse | Inter-warehouse transfers |
| TRANSFER_IN | Inbound | Arriving at warehouse | Inter-warehouse transfers |
| ADJUSTMENT_ADD | Inbound | Positive adjustment | Cycle count correction |
| ADJUSTMENT_REMOVE | Outbound | Negative adjustment | Discrepancy correction |
| DAMAGE | Outbound | Write-off | Damaged goods removal |
| INTERNAL_MOVE | Internal | Within warehouse | Zone-to-zone (future) |

### Movement Lifecycle

```
[Create Movement Request]
        │
        ├──▶ Validate quantity > 0
        ├──▶ Validate warehouse exists
        ├──▶ Validate reason provided
        │
        ▼ For OUTBOUND movements:
        │
        ├──▶ Check available stock
        │    Available = quantity - reservedQuantity
        │
        ├──▶ If insufficient → Return error
        │
        ▼
[Movement Status: PENDING]
        │
        ▼
[Execute Movement]
        │
        ├──▶ Re-check stock availability
        ├──▶ Update inventory quantities
        ├──▶ Create audit log
        ├──▶ Emit events
        │
        ▼
[Status: COMPLETED]
```

### Paired Transfers

Transfer between warehouses creates **two linked movements**:

```
Warehouse A: TRANSFER_OUT  ←──linked──→  Warehouse B: TRANSFER_IN
    -10 units                                 +10 units
```

Both movements reference each other via `linkedMovementId`.

---

## API Design

### Create Movement

```typescript
createMovement(
    request: {
        warehouseId: string;         // Source warehouse
        sku: string;                 // Product SKU
        quantity: number;            // Amount to move
        type: MovementType;          // RECEIVE, SHIP, RETURN, etc.
        targetWarehouseId?: string;  // For transfers
        referenceId?: string;        // Order ID, PO number, etc.
        referenceType?: ReferenceType;
        reason: string;              // Required justification
        notes?: string;              // Additional notes
        scheduledAt?: Date;          // For scheduled movements
    },
    context: { organizationId: string; userId: string }
): Promise<MovementResult>

interface MovementResult {
    success: boolean;
    movementId?: string;
    status?: MovementStatus;
    error?: string;
}
```

### Create Transfer (Convenience Method)

```typescript
createTransfer(
    request: {
        sourceWarehouseId: string;
        targetWarehouseId: string;
        sku: string;
        quantity: number;
        reason: string;
        scheduledAt?: Date;
    },
    context: { organizationId: string; userId: string }
): Promise<TransferResult>

interface TransferResult {
    success: boolean;
    transferOutId?: string;     // TRANSFER_OUT movement ID
    transferInId?: string;      // TRANSFER_IN movement ID
    error?: string;
}
```

### Execute Movement

```typescript
executeMovement(
    movementId: string,
    context: { organizationId: string; userId: string }
): Promise<ExecuteResult>

interface ExecuteResult {
    success: boolean;
    status?: MovementStatus;
    error?: string;
}
```

### Cancel Movement

```typescript
cancelMovement(
    movementId: string,
    reason: string,
    context: { organizationId: string; userId: string }
): Promise<ExecuteResult>
```

### Query Movements

```typescript
getMovements(
    filters: {
        warehouseId?: string;
        sku?: string;
        type?: MovementType;
        status?: MovementStatus;
        startDate?: Date;
        endDate?: Date;
        referenceId?: string;
        page?: number;
        pageSize?: number;
    },
    context: { organizationId: string }
): Promise<{ items: Movement[]; total: number }>
```

### Get Movement Summary

```typescript
getMovementSummary(
    query: {
        warehouseId?: string;
        startDate?: Date;
        endDate?: Date;
    },
    context: { organizationId: string }
): Promise<MovementSummary>

interface MovementSummary {
    totalInbound: number;
    totalOutbound: number;
    netChange: number;               // totalInbound - totalOutbound
    byType: Record<MovementType, { count: number; quantity: number }>;
}
```

### Get SKU Movement History

```typescript
getSkuMovements(
    sku: string,
    options: { warehouseId?: string; limit?: number },
    context: { organizationId: string }
): Promise<Movement[]>
```

### Configuration APIs (Future-Ready)

```typescript
// MVP: { requiresApproval: false }
getApprovalConfig(): ApprovalConfig

// MVP: { zoneEnabled: false }
getZoneConfig(): ZoneConfig

// Returns: ORDER, PURCHASE_ORDER, RETURN, TRANSFER, ADJUSTMENT
getAvailableReferenceTypes(): ReferenceType[]
```

---

## Movement Statuses

| Status | Description |
|--------|-------------|
| PENDING | Created, awaiting execution |
| APPROVED | Approved (future, for approval workflow) |
| IN_PROGRESS | Currently executing |
| COMPLETED | Successfully completed |
| CANCELLED | Cancelled before execution |
| FAILED | Execution failed |

---

## Reference Types (Best Practice)

| Type | Use Case |
|------|----------|
| ORDER | Customer order (SHIP movements) |
| PURCHASE_ORDER | Supplier delivery (RECEIVE movements) |
| RETURN | Customer return (RETURN movements) |
| TRANSFER | Inter-warehouse transfer |
| ADJUSTMENT | Manual adjustment (cycle count, etc.) |

---

## Safety Guards

1. **Negative Stock Prevention** - Always blocks outbound exceeding available
2. **Availability Check** - Available = quantity - reservedQuantity
3. **Warehouse Existence** - Validates warehouses exist
4. **Same Organization** - Cross-org movements blocked
5. **Reason Required** - Must provide movement reason
6. **XSS Prevention** - Sanitizes reason and notes text
7. **Transaction Safety** - Full rollback on failure
8. **Audit Trail** - All movements logged via INV-07

---

## Design Decisions (User Approved)

| Feature | MVP Decision | Future-Ready |
|---------|--------------|--------------|
| **Approval Workflow** | Disabled | `getApprovalConfig()` returns config |
| **Zone Tracking** | Disabled | `getZoneConfig()` returns config |
| **Negative Stock** | Always block | No exceptions |
| **Reservations** | Auto-check | Respects reservedQuantity |
| **Reference Types** | 5 types | Dynamic via `getAvailableReferenceTypes()` |

---

## Test Coverage

### Unit Tests (62 tests)

| Category | Tests |
|----------|-------|
| Create Movement (9 types) | 9 |
| Validation | 6 |
| Negative Stock Prevention | 4 |
| Transfer Operations | 5 |
| Execute Movement | 9 |
| Cancel Movement | 3 |
| Query Operations | 8 |
| Movement Summary | 2 |
| SKU History | 3 |
| Reference Types | 5 |
| Configuration | 2 |
| Hardening: DB & Concurrent | 6 |

### Integration Tests (22 tests)

| Category | Tests |
|----------|-------|
| E2E Movement Workflow | 7 |
| Transfer Workflow | 4 |
| Negative Stock Prevention | 2 |
| Security | 3 |
| Query Performance | 2 |
| Hardening: DB Failures | 2 |
| Hardening: Concurrent | 2 |

---

## Data Model

### StockMovement

```typescript
interface StockMovement {
    id: string;
    organizationId: string;
    warehouseId: string;
    sku: string;
    quantity: number;
    type: MovementType;
    direction: 'INBOUND' | 'OUTBOUND' | 'INTERNAL';
    status: MovementStatus;
    
    // For transfers
    linkedMovementId?: string;
    targetWarehouseId?: string;
    
    // For zone movements (future)
    sourceZone?: string;
    targetZone?: string;
    
    // Reference linking
    referenceId?: string;
    referenceType?: ReferenceType;
    
    // Metadata
    reason: string;
    notes?: string;
    
    // Tracking
    scheduledAt?: Date;
    executedAt?: Date;
    executedBy?: string;
    createdBy: string;
    createdAt: Date;
    cancelledAt?: Date;
    cancelledBy?: string;
    cancellationReason?: string;
}
```

---

## Configuration (Future-Ready)

| Setting | MVP Value | Description |
|---------|-----------|-------------|
| REQUIRES_APPROVAL | false | Enable approval workflow |
| ZONE_ENABLED | false | Enable zone-level tracking |
| DEFAULT_PAGE_SIZE | 20 | Query results per page |

---

## Implementation File

`src/modules/inventory/stock-movement.service.ts`

## Total Tests: 84 (62 unit + 22 integration)
