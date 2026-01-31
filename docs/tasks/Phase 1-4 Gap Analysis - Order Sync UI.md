# Phase 1-4 Gap Analysis - Order Sync UI

**Task ID:** GAP-19  
**Priority:** P1 (High)  
**Est. Hours:** 6  
**Dependencies:** GAP-18 (Channel OAuth) ✅  
**Status:** 🔄 In Progress

---

## Phase A+D: Planning & Design

### Problem Statement

After connecting channels, users cannot:
- See sync status per channel
- Manually trigger syncs
- View sync history/logs
- Resolve sync errors

---

### Business Requirements

1. **Sync Dashboard** - Status per channel
2. **Manual Sync** - Trigger sync button
3. **Sync History** - Log of syncs
4. **Error Resolution** - View/resolve errors
5. **Sync Settings** - Configure sync frequency

---

### Files to Create

```
src/hooks/
└── useOrderSync.ts

src/components/sync/
├── SyncDashboard.tsx
├── SyncHistoryTable.tsx
├── SyncErrorList.tsx
├── SyncTriggerButton.tsx
└── index.ts
```

---

## Phase B: Testing (15 tests)

1. getSyncStatus - returns status
2. triggerSync - starts sync
3. getSyncHistory - returns logs
4. getSyncErrors - returns errors
5. resolveError - marks resolved
6. SyncDashboard - renders channels
7. SyncDashboard - shows status
8. SyncHistoryTable - renders rows
9. SyncHistoryTable - empty state
10. SyncErrorList - renders errors
11. SyncErrorList - resolve button
12. SyncTriggerButton - triggers sync
13. SyncTriggerButton - loading state
14. Last sync time display
15. Auto-refresh works

---

## Phase C: Implementation

- [ ] Create useOrderSync hook
- [ ] Create SyncDashboard
- [ ] Create SyncHistoryTable
- [ ] Create SyncErrorList
- [ ] Create SyncTriggerButton
