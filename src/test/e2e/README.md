# E2E Test Suite

This directory contains comprehensive end-to-end tests for the Rappit application, implementing the test strategy outlined in TASK-015 through TASK-018.

## Overview

The E2E test suite covers:
- Full system integration with real PostgreSQL and Redis (via testcontainers)
- Order lifecycle testing
- Multi-tenant isolation and security
- Concurrent operations and race conditions
- Chaos engineering scenarios
- Subscription billing enforcement
- Rate limiting behavior

## Test Infrastructure

### Test Containers (TASK-015)

All E2E tests use testcontainers to provide isolated, reproducible test environments:

- **PostgreSQL**: Fresh database for each test run
- **Redis**: Isolated cache and queue storage

Configuration: See `../helpers/testContainers.ts`

### Running Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run specific test file
npm test src/test/e2e/order-lifecycle.e2e-spec.ts

# Run with coverage
npm run test:coverage
```

### Prerequisites

- Docker installed and running (for testcontainers)
- Node.js 18+
- PostgreSQL and Redis will be automatically provisioned by testcontainers

## Test Files

### 1. Order Lifecycle (`order-lifecycle.e2e-spec.ts`)

**TASK-016**: Full order flow from creation to delivery

Tests:
- Order import from channel
- Inventory reservation on placement
- State transitions (NEW → PROCESSING → ... → DELIVERED)
- Inventory deduction on shipment
- Timeline event tracking

**Key Scenarios:**
- ✅ Order creation and reservation
- ✅ State machine transitions
- ✅ Shipment creation and tracking
- ✅ Order delivery completion
- ✅ Inventory consistency verification

### 2. Webhook Queue Flow (`webhook-queue-flow.e2e-spec.ts`)

**TASK-016**: Webhook → Queue → Worker → Database flow

Tests:
- Webhook signature verification
- BullMQ job enqueueing
- Worker job processing
- Database persistence
- Idempotency (duplicate prevention)

**Key Scenarios:**
- ✅ Valid webhook processing
- ✅ Invalid signature rejection
- ✅ Job queue integration
- ✅ Duplicate webhook handling
- ✅ End-to-end data flow

### 3. Concurrent Inventory (`concurrent-inventory.e2e-spec.ts`)

**TASK-016 & TASK-017**: Concurrent order placement and inventory

Tests:
- Multiple simultaneous orders
- Race condition prevention
- Database transaction isolation
- Inventory overselling prevention

**Key Scenarios:**
- ✅ 30 concurrent orders
- ✅ No overselling
- ✅ Reservation consistency
- ✅ Transaction isolation
- ✅ 100 orders stress test

### 4. Order Cancellation (`order-cancellation.e2e-spec.ts`)

**TASK-016**: Order cancellation with inventory release

Tests:
- Cancel before shipping (release reservation)
- Cancel after shipping (return to stock)
- Concurrent cancellations
- Double cancellation handling

**Key Scenarios:**
- ✅ Reservation release
- ✅ Inventory restoration
- ✅ Concurrent cancellations
- ✅ Consistency verification
- ✅ Edge cases (double cancel, delivered order)

### 5. Security: Tenant Isolation (`security-tenant-isolation.e2e-spec.ts`)

**TASK-018**: Comprehensive multi-tenant security

Tests:
- Direct ID access attempts across tenants
- SQL injection prevention
- API authorization enforcement
- Query parameter manipulation
- JWT token tampering
- Cross-tenant data aggregation

**Key Scenarios:**
- ✅ Cross-tenant access returns 404 (not 403)
- ✅ SQL injection safely handled
- ✅ Invalid JWT rejected
- ✅ Token tampering detected
- ✅ Bidirectional isolation verified

### 6. Chaos Engineering (`chaos-engineering.e2e-spec.ts`)

**TASK-017**: System resilience under adverse conditions

Tests:
- High-volume concurrent load (200 requests)
- Database connection pool stress
- Redis connection failures
- Carrier API timeouts
- Memory exhaustion
- Resource recovery

**Key Scenarios:**
- ✅ 200 concurrent requests handled
- ✅ Connection pool stress
- ✅ Redis stress scenarios
- ✅ Graceful degradation
- ✅ System recovery verified

### 7. Stripe Billing Enforcement (`stripe-billing-enforcement.e2e-spec.ts`)

**TASK-016**: Subscription-based access control

Tests:
- ACTIVE: Full access
- TRIAL: Limited access with warnings
- EXPIRED: Read-only access
- PAYMENT_FAILED: Grace period behavior
- CANCELLED: Export-only access
- Webhook processing

**Key Scenarios:**
- ✅ Active subscription allows operations
- ✅ Expired subscription blocks writes
- ✅ Trial period enforcement
- ✅ Payment failed grace period
- ✅ Subscription webhooks handled

### 8. Rate Limiting (`rate-limiting.e2e-spec.ts`)

**TASK-016**: API rate limiting behavior

Tests:
- Public endpoint limits
- Authenticated endpoint limits
- Per-organization isolation
- Burst vs sustained load
- Rate limit recovery
- Different limits for read/write

**Key Scenarios:**
- ✅ Rate limit enforcement
- ✅ 429 responses with retry-after
- ✅ Burst handling
- ✅ Rate limit recovery
- ✅ Per-org isolation

## Test Patterns and Best Practices

### Setup and Teardown

All tests follow this pattern:

```typescript
beforeAll(async () => {
  // 1. Start test containers
  await startPostgresContainer();
  await startRedisContainer();

  // 2. Initialize NestJS app
  const moduleFixture = await Test.createTestingModule({...}).compile();
  app = moduleFixture.createNestApplication();
  await app.init();

  // 3. Seed test data
  // Create organizations, users, channels, etc.
});

afterAll(async () => {
  // 1. Cleanup test data
  await prisma.order.deleteMany({...});
  // ... delete all test entities

  // 2. Close app
  await app.close();

  // 3. Stop containers
  await stopAllContainers();
});
```

### Multi-Tenant Testing

Always test bidirectional isolation:

```typescript
// Org A cannot access Org B
await request(app).get(`/orders/${orgB.orderId}`)
  .set('Authorization', `Bearer ${orgA.token}`)
  .expect(404);

// Org B cannot access Org A
await request(app).get(`/orders/${orgA.orderId}`)
  .set('Authorization', `Bearer ${orgB.token}`)
  .expect(404);
```

### Concurrent Operations

Use `Promise.allSettled()` for concurrent tests:

```typescript
const results = await Promise.allSettled(orderPromises);

const successful = results.filter(
  r => r.status === 'fulfilled' && r.value.status === 201
);

const failed = results.filter(
  r => r.status === 'rejected' || r.value.status !== 201
);
```

### Timeouts

Set appropriate timeouts for long-running tests:

```typescript
it('should handle 200 concurrent requests', async () => {
  // Test implementation
}, 120000); // 2 minutes
```

## Performance Metrics

Expected performance characteristics:

- **Order Creation**: P50 < 200ms, P99 < 2s
- **Concurrent Load**: 200 requests in < 60s
- **Success Rate**: > 70% under heavy load
- **Rate Limiting**: Graceful 429 responses
- **Recovery Time**: < 5s after stress

## Debugging Tests

### Enable Debug Logging

```bash
LOG_LEVEL=debug npm test src/test/e2e/order-lifecycle.e2e-spec.ts
```

### View Container Logs

```bash
docker logs rappit-postgres-test
docker logs rappit-redis-test
```

### Inspect Database

Tests leave data in containers. Connect to inspect:

```bash
# Get connection string from test output
docker exec -it rappit-postgres-test psql -U rappit_test -d rappit_test
```

## CI/CD Integration

Tests are designed to run in CI environments:

```yaml
test-e2e:
  runs-on: ubuntu-latest
  services:
    docker:
      image: docker:dind
  steps:
    - uses: actions/checkout@v3
    - uses: actions/setup-node@v3
    - run: npm ci
    - run: npm run test:e2e
```

## Maintenance

### Adding New Tests

1. Create new test file in `src/test/e2e/`
2. Use testcontainers for database/redis
3. Follow existing patterns for setup/teardown
4. Add to this README with description

### Updating Tests

When adding new features:
1. Update relevant test files
2. Ensure multi-tenant isolation
3. Add chaos/load scenarios if applicable
4. Update security tests if touching auth

## Troubleshooting

### Tests Failing Locally

1. **Docker not running**: Start Docker Desktop
2. **Port conflicts**: Stop local PostgreSQL/Redis
3. **Timeout errors**: Increase timeout values
4. **Container start failures**: Check Docker resources

### Tests Passing Locally, Failing in CI

1. **Resource constraints**: CI may have less memory/CPU
2. **Network issues**: CI may have stricter network policies
3. **Timing issues**: Add wait time for async operations
4. **Parallel execution**: Tests may conflict when run in parallel

## Coverage

Target coverage for E2E tests:

- ✅ Order lifecycle: 100%
- ✅ Multi-tenant isolation: 100%
- ✅ Inventory management: 95%
- ✅ Security scenarios: 100%
- ✅ Chaos scenarios: 80%
- ✅ Subscription enforcement: 90%
- ✅ Rate limiting: 85%

Run coverage report:

```bash
npm run test:coverage
```

## Future Enhancements

- [ ] Network partition simulation (chaos)
- [ ] Database failover testing
- [ ] Multi-region latency simulation
- [ ] Load balancer behavior
- [ ] Backup/restore testing
- [ ] Performance regression testing
- [ ] Visual regression testing for UI

## Support

For questions or issues with tests:
1. Check test output for specific errors
2. Review container logs
3. Verify Docker is running with sufficient resources
4. Check for port conflicts
5. Ensure dependencies are up to date
