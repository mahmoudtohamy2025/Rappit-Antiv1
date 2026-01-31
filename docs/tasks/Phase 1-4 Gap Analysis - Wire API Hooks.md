# Phase 1-4 Gap Analysis - Wire API Hooks

**Task ID:** GAP-03  
**Priority:** P0 (Critical)  
**Est. Hours:** 16  
**Dependencies:** GAP-01 ✅, GAP-02 ✅  
**Status:** 🔄 In Progress

---

## Phase A+D: Planning & Design

### Problem Statement

The inventory management tabs currently use mock data:
- **MovementPanel** - displays hardcoded movements
- **TransferPanel** - displays hardcoded transfers  
- **CycleCountPanel** - displays hardcoded cycle counts
- **AuditTrailPanel** - displays hardcoded audit logs

These need to be connected to the existing backend APIs.

---

### Existing Backend APIs

The backend has these services already implemented:

| Service | API Endpoint | Status |
|---------|-------------|--------|
| Stock Movements | `/api/v1/inventory/movements` | ✅ Exists |
| Inventory Transfers | `/api/v1/inventory/transfers` | ✅ Exists |
| Cycle Counts | `/api/v1/inventory/cycle-counts` | ✅ Exists |
| Audit Trail | `/api/v1/inventory/adjustments` | ✅ Exists |
| Force Release | `/api/v1/inventory/reservations/force-release` | ✅ Exists |

---

### Business Requirements

#### Components to Wire
1. **MovementPanel** - Stock movements (IN, OUT, ADJUST)
2. **TransferPanel** - Inter-warehouse transfers
3. **CycleCountPanel** - Physical inventory counts
4. **AuditTrailPanel** - All inventory changes
5. **ForceReleasePanel** - Stuck reservation release

---

### API Hooks to Create

```typescript
// 1. useMovements
interface UseMovementsReturn {
  movements: Movement[];
  isLoading: boolean;
  error: Error | null;
  fetch: (filters?: MovementFilters) => Promise<void>;
  create: (dto: CreateMovementDto) => Promise<Movement>;
}

// 2. useTransfers
interface UseTransfersReturn {
  transfers: Transfer[];
  pendingCount: number;
  isLoading: boolean;
  fetch: (filters?: TransferFilters) => Promise<void>;
  create: (dto: CreateTransferDto) => Promise<Transfer>;
  approve: (id: string) => Promise<Transfer>;
  reject: (id: string, reason: string) => Promise<Transfer>;
}

// 3. useCycleCounts
interface UseCycleCountsReturn {
  cycleCounts: CycleCount[];
  isLoading: boolean;
  fetch: (filters?: CycleCountFilters) => Promise<void>;
  create: (dto: CreateCycleCountDto) => Promise<CycleCount>;
  submit: (id: string, items: CycleCountItem[]) => Promise<CycleCount>;
}

// 4. useAuditTrail
interface UseAuditTrailReturn {
  auditLogs: AuditLog[];
  isLoading: boolean;
  fetch: (filters?: AuditFilters) => Promise<void>;
}

// 5. useForceRelease
interface UseForceReleaseReturn {
  stuckReservations: Reservation[];
  isLoading: boolean;
  fetch: () => Promise<void>;
  release: (reservationId: string, reason: string) => Promise<void>;
  batchRelease: (ids: string[], reason: string) => Promise<void>;
}
```

---

### Files to Create/Modify

#### Hooks
```
src/hooks/inventory/
├── useMovements.ts
├── useTransfers.ts
├── useCycleCounts.ts
├── useAuditTrail.ts
├── useForceRelease.ts
└── index.ts
```

#### Components to Modify
```
src/components/inventory/
├── movements/MovementPanel.tsx      - Wire to useMovements
├── transfers/TransferPanel.tsx      - Wire to useTransfers
├── cycle-count/CycleCountPanel.tsx  - Wire to useCycleCounts
├── audit/AuditTrailPanel.tsx        - Wire to useAuditTrail
└── force-release/ (existing)        - Wire to useForceRelease
```

---

## Phase B: Testing (Write First!)

### Unit Tests Target: 25

#### useMovements Tests
1. fetch - returns movements
2. fetch - applies date filter
3. fetch - applies type filter
4. fetch - applies warehouse filter
5. create - adds new movement
6. error handling - sets error on failure

#### useTransfers Tests
7. fetch - returns transfers
8. fetch - returns pending count
9. create - creates transfer
10. approve - approves transfer
11. reject - rejects with reason
12. error handling

#### useCycleCounts Tests
13. fetch - returns cycle counts
14. create - creates cycle count
15. submit - submits items
16. error handling

#### useAuditTrail Tests
17. fetch - returns audit logs
18. fetch - applies filters
19. pagination works

#### useForceRelease Tests
20. fetch - returns stuck reservations
21. release - releases single
22. batchRelease - releases multiple
23. error handling

#### Integration Tests
24. Movement creates audit log
25. Transfer creates audit log

---

## Phase C: Implementation Checklist

### Hooks
- [ ] Create useMovements hook
- [ ] Create useTransfers hook
- [ ] Create useCycleCounts hook  
- [ ] Create useAuditTrail hook
- [ ] Create useForceRelease hook
- [ ] Create barrel export

### Wire Components
- [ ] Update MovementPanel to use useMovements
- [ ] Update TransferPanel to use useTransfers
- [ ] Update CycleCountPanel to use useCycleCounts
- [ ] Update AuditTrailPanel to use useAuditTrail
- [ ] Update ForceRelease components to use useForceRelease

### Error Handling
- [ ] Add loading states to all panels
- [ ] Add error displays
- [ ] Add empty states
- [ ] Add retry buttons

---

## Verification Checklist

- [ ] All 25 unit tests pass
- [ ] MovementPanel loads real data
- [ ] TransferPanel loads real data
- [ ] CycleCountPanel loads real data
- [ ] AuditTrailPanel loads real data
- [ ] Create operations work
- [ ] Filters work
- [ ] RTL Arabic layout correct
- [ ] Mobile responsive
- [ ] Dark mode supported
