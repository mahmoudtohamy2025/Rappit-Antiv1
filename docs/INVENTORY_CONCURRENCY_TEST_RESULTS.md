# Inventory Concurrency Test Results

## Overview
This document provides manual test execution results for inventory concurrency scenarios to verify that the system prevents overselling and handles concurrent reservations correctly.

**Priority**: P1 (High)  
**Risk IDs**: RISK-04  
**Test Suite**: `src/test/integration/inventory.concurrency.e2e-spec.ts`  
**Status**: ✅ Automated Tests Available

---

## Test Environment Setup

### Prerequisites
1. PostgreSQL database running (localhost:5432 or via Docker)
2. Redis running (for queue management)
3. Test organization and warehouse seeded
4. Test SKU with known inventory quantity

### Database Configuration
```bash
DATABASE_URL=postgresql://rappit_test:rappit_test_pass@localhost:5433/rappit_test
REDIS_HOST=localhost
REDIS_PORT=6380
NODE_ENV=test
```

### Running the Tests
```bash
# Start Docker services (PostgreSQL + Redis)
docker-compose up -d

# Run inventory concurrency tests
npm run test:e2e -- --testPathPattern=inventory.concurrency

# Or run specific test file
jest src/test/integration/inventory.concurrency.e2e-spec.ts --runInBand --detectOpenHandles
```

---

## Test Scenarios

### Scenario 1: Concurrent Reservations for Same SKU
**Objective**: Verify that concurrent orders cannot over-reserve stock

**Setup**:
- SKU: `SKU-CONCURRENCY-TEST-001`
- Available Stock: 50 units
- Concurrent Orders: 100 (each requesting 1 unit)

**Expected Result**:
- ✅ Exactly 50 reservations succeed
- ✅ 50 reservations fail with "Insufficient inventory" error
- ✅ No negative inventory levels
- ✅ Total reserved quantity = 50
- ✅ Available quantity = 0

**Test Implementation**:
```typescript
it('should handle 100 concurrent reservations for 50 units', async () => {
    const availableStock = 50;
    const concurrentRequests = 100;
    
    // Create 100 simultaneous reservation requests
    const promises = Array.from({ length: concurrentRequests }, (_, i) =>
        inventoryService.reserveInventory(organizationId, skuId, 1, `order-${i}`)
    );
    
    const results = await Promise.allSettled(promises);
    const successes = results.filter(r => r.status === 'fulfilled').length;
    const failures = results.filter(r => r.status === 'rejected').length;
    
    expect(successes).toBe(availableStock);
    expect(failures).toBe(concurrentRequests - availableStock);
    
    // Verify inventory level
    const finalInventory = await prisma.inventoryLevel.findUnique({
        where: { skuId_warehouseId: { skuId, warehouseId } }
    });
    expect(finalInventory.reservedQuantity).toBe(availableStock);
    expect(finalInventory.availableQuantity - finalInventory.reservedQuantity).toBe(0);
});
```

**Status**: ⬜ Not Yet Executed | ✅ Passed | ❌ Failed

---

### Scenario 2: Reservations for Different SKUs
**Objective**: Verify no deadlocks when reserving different SKUs concurrently

**Setup**:
- SKU A: 100 units available
- SKU B: 100 units available
- 50 concurrent orders for SKU A (2 units each)
- 50 concurrent orders for SKU B (2 units each)

**Expected Result**:
- ✅ All 100 orders complete successfully
- ✅ No deadlocks detected
- ✅ Both SKUs have correct reserved quantities
- ✅ Execution time < 5 seconds

**Test Implementation**:
```typescript
it('should handle concurrent reservations for different SKUs without deadlock', async () => {
    const ordersPerSku = 50;
    
    const promisesA = Array.from({ length: ordersPerSku }, (_, i) =>
        inventoryService.reserveInventory(organizationId, skuIdA, 2, `order-A-${i}`)
    );
    
    const promisesB = Array.from({ length: ordersPerSku }, (_, i) =>
        inventoryService.reserveInventory(organizationId, skuIdB, 2, `order-B-${i}`)
    );
    
    const startTime = Date.now();
    const results = await Promise.all([...promisesA, ...promisesB]);
    const duration = Date.now() - startTime;
    
    expect(results).toHaveLength(100);
    expect(duration).toBeLessThan(5000);
    
    // Verify both SKUs
    const inventoryA = await prisma.inventoryLevel.findUnique({
        where: { skuId_warehouseId: { skuId: skuIdA, warehouseId } }
    });
    expect(inventoryA.reservedQuantity).toBe(100);
});
```

**Status**: ⬜ Not Yet Executed | ✅ Passed | ❌ Failed

---

### Scenario 3: Concurrent Reserve and Release Operations
**Objective**: Verify system handles concurrent reserve/release correctly

**Setup**:
- SKU: 50 units available
- 25 orders reserving inventory
- 25 orders releasing inventory (from previous reservations)
- All operations concurrent

**Expected Result**:
- ✅ All operations complete successfully
- ✅ No race conditions causing incorrect quantities
- ✅ Final inventory state is consistent
- ✅ Audit log records all operations

**Test Implementation**:
```typescript
it('should handle concurrent reserve and release operations', async () => {
    // First create some reservations to release
    const existingReservations = await Promise.all(
        Array.from({ length: 25 }, (_, i) =>
            inventoryService.reserveInventory(organizationId, skuId, 1, `order-existing-${i}`)
        )
    );
    
    // Now do concurrent reserve + release
    const reservePromises = Array.from({ length: 25 }, (_, i) =>
        inventoryService.reserveInventory(organizationId, skuId, 1, `order-new-${i}`)
    );
    
    const releasePromises = existingReservations.map(res =>
        inventoryService.releaseReservation(res.id)
    );
    
    await Promise.all([...reservePromises, ...releasePromises]);
    
    // Verify final state
    const finalInventory = await prisma.inventoryLevel.findUnique({
        where: { skuId_warehouseId: { skuId, warehouseId } }
    });
    expect(finalInventory.reservedQuantity).toBe(25);
});
```

**Status**: ⬜ Not Yet Executed | ✅ Passed | ❌ Failed

---

### Scenario 4: High-Volume Concurrent Order Placement
**Objective**: Verify system performance under high load

**Setup**:
- SKU: 1000 units available
- 50 concurrent orders (10-50 units each)
- Total requested: ~1500 units (exceeds available)

**Expected Result**:
- ✅ Orders succeed until inventory exhausted
- ✅ Remaining orders fail gracefully
- ✅ No inventory goes negative
- ✅ Total reserved never exceeds available
- ✅ Response time acceptable (<3s for all operations)

**Test Implementation**:
```typescript
it('should handle high-volume concurrent orders gracefully', async () => {
    const availableStock = 1000;
    
    const orders = Array.from({ length: 50 }, (_, i) => ({
        id: `order-${i}`,
        quantity: Math.floor(Math.random() * 40) + 10 // 10-50 units
    }));
    
    const totalRequested = orders.reduce((sum, o) => sum + o.quantity, 0);
    expect(totalRequested).toBeGreaterThan(availableStock); // Ensure overselling attempt
    
    const startTime = Date.now();
    const results = await Promise.allSettled(
        orders.map(o => inventoryService.reserveInventory(organizationId, skuId, o.quantity, o.id))
    );
    const duration = Date.now() - startTime;
    
    const successes = results.filter(r => r.status === 'fulfilled');
    const totalReserved = successes.reduce((sum, r: any) => sum + r.value.quantity, 0);
    
    expect(totalReserved).toBeLessThanOrEqual(availableStock);
    expect(duration).toBeLessThan(3000);
    
    // Verify no negative inventory
    const finalInventory = await prisma.inventoryLevel.findUnique({
        where: { skuId_warehouseId: { skuId, warehouseId } }
    });
    expect(finalInventory.availableQuantity).toBeGreaterThanOrEqual(0);
    expect(finalInventory.reservedQuantity).toBeLessThanOrEqual(availableStock);
});
```

**Status**: ⬜ Not Yet Executed | ✅ Passed | ❌ Failed

---

## Manual Testing Procedure (If Automated Tests Unavailable)

### Step 1: Setup Test Environment
```bash
# Start services
docker-compose up -d

# Create test organization and warehouse
psql $DATABASE_URL -c "
INSERT INTO organizations (id, name, is_active) 
VALUES ('test-org-concurrency', 'Concurrency Test Org', true);

INSERT INTO warehouses (id, organization_id, name, code, is_active)
VALUES ('test-wh-concurrency', 'test-org-concurrency', 'Test Warehouse', 'WH-CONC', true);

INSERT INTO products (id, organization_id, name)
VALUES ('test-prod-001', 'test-org-concurrency', 'Test Product');

INSERT INTO skus (id, organization_id, product_id, sku)
VALUES ('test-sku-001', 'test-org-concurrency', 'test-prod-001', 'SKU-CONCURRENCY-001');

INSERT INTO inventory_levels (sku_id, warehouse_id, available_quantity, reserved_quantity)
VALUES ('test-sku-001', 'test-wh-concurrency', 50, 0);
"
```

### Step 2: Run Concurrent API Requests
```bash
# Use Apache Bench or similar tool
ab -n 100 -c 100 -p reserve.json -T application/json \
  http://localhost:3000/api/v1/inventory/reserve

# reserve.json content:
{
  "skuId": "test-sku-001",
  "warehouseId": "test-wh-concurrency",
  "quantity": 1,
  "orderId": "order-{{UUID}}"
}
```

### Step 3: Verify Results
```bash
# Check final inventory state
psql $DATABASE_URL -c "
SELECT 
  available_quantity,
  reserved_quantity,
  (available_quantity - reserved_quantity) as remaining
FROM inventory_levels 
WHERE sku_id = 'test-sku-001';
"

# Check reservations count
psql $DATABASE_URL -c "
SELECT COUNT(*) as total_reservations,
       SUM(quantity) as total_reserved
FROM inventory_reservations
WHERE sku_id = 'test-sku-001' AND status = 'ACTIVE';
"

# Verify no negative inventory
psql $DATABASE_URL -c "
SELECT * FROM inventory_levels 
WHERE (available_quantity - reserved_quantity) < 0;
"
```

**Expected**:
- `remaining` = 0
- `total_reservations` = 50
- `total_reserved` = 50
- No rows with negative inventory

---

## Test Results Summary

| Scenario | Status | Notes |
|----------|--------|-------|
| Scenario 1: 100 concurrent reservations for 50 units | ⬜ Pending | |
| Scenario 2: Different SKUs without deadlock | ⬜ Pending | |
| Scenario 3: Concurrent reserve and release | ⬜ Pending | |
| Scenario 4: High-volume concurrent orders | ⬜ Pending | |

---

## Database-Level Concurrency Protection

### Row-Level Locking
The inventory service uses Prisma transactions with row-level locking:

```sql
BEGIN;
-- Lock the row for update
SELECT * FROM inventory_levels 
WHERE sku_id = ? AND warehouse_id = ? 
FOR UPDATE;

-- Check available quantity
UPDATE inventory_levels 
SET reserved_quantity = reserved_quantity + ?
WHERE sku_id = ? 
  AND warehouse_id = ?
  AND (available_quantity - reserved_quantity) >= ?;

-- If updated rows = 0, rollback (insufficient inventory)
COMMIT;
```

### Transaction Isolation
- **Isolation Level**: `READ COMMITTED` (Prisma default)
- **Lock Type**: `FOR UPDATE` (pessimistic locking)
- **Timeout**: 30 seconds (configurable)

---

## Performance Metrics

### Target Metrics
- **Concurrent Operations**: 100+ simultaneous requests
- **Response Time**: < 500ms per operation (p95)
- **Throughput**: 200+ operations/second
- **Error Rate**: < 0.1% under normal load
- **Deadlock Rate**: 0%

### Monitoring Queries
```sql
-- Active locks
SELECT * FROM pg_locks 
WHERE relation = (SELECT oid FROM pg_class WHERE relname = 'inventory_levels');

-- Transaction wait times
SELECT pid, wait_event_type, wait_event, state, query 
FROM pg_stat_activity 
WHERE wait_event IS NOT NULL;
```

---

## Troubleshooting

### Issue: Deadlock Detected
**Symptoms**: `deadlock detected` errors in logs

**Solution**:
1. Ensure consistent lock order (always lock SKU A before SKU B)
2. Use shorter transactions
3. Retry with exponential backoff

### Issue: Transaction Timeout
**Symptoms**: `Lock timeout` after 30 seconds

**Solution**:
1. Reduce transaction duration
2. Increase timeout limit (not recommended for production)
3. Implement circuit breaker pattern

### Issue: Negative Inventory
**Symptoms**: `available_quantity - reserved_quantity < 0`

**Solution**:
1. This should NEVER happen - indicates bug in locking logic
2. Review row-level locking implementation
3. Check for race conditions in reservation logic

---

## Verification Sign-Off

| Test Scenario | Tester | Date | Result | Notes |
|---------------|--------|------|--------|-------|
| Scenario 1 | | | | |
| Scenario 2 | | | | |
| Scenario 3 | | | | |
| Scenario 4 | | | | |

---

## References

- **Test Suite**: `src/test/integration/inventory.concurrency.e2e-spec.ts`
- **Service Implementation**: `src/src/modules/inventory/inventory.service.ts`
- **Database Schema**: `src/prisma/schema.prisma`
- **Inventory Model**: Model C (reserve-on-order, deduct-on-ship)

---

## Conclusion

**Status**: ⬜ Manual Testing Required

The automated test suite is available but must be executed with actual database to verify:
1. ✅ Row-level locking prevents overselling
2. ✅ Concurrent operations don't create race conditions
3. ✅ System handles high load gracefully
4. ✅ No deadlocks under concurrent SKU access

**Next Steps**:
1. Execute automated test suite: `npm run test:e2e -- --testPathPattern=inventory.concurrency`
2. Review test results
3. If any failures, investigate and fix
4. Document findings in this report
5. Sign off on verification checklist
