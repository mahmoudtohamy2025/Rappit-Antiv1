# Phase 1-4 Gap Analysis - Subscription TopBar

**Task ID:** GAP-17  
**Priority:** P0+ (Platform)  
**Est. Hours:** 3  
**Dependencies:** GAP-16 (Billing Page) ✅  
**Status:** 🔄 In Progress

---

## Phase A+D: Planning & Design

### Problem Statement

Users don't see subscription status in the main UI:
- No trial countdown visible
- No warning for past due
- No quick access to billing

---

### Business Requirements

1. **Show Status Badge** - TRIAL/ACTIVE/PAST_DUE
2. **Trial Countdown** - Days remaining
3. **Past Due Warning** - Visible alert
4. **Upgrade CTA** - Quick upgrade button
5. **Click to Billing** - Navigate to billing page

---

### Files to Create

```
src/components/layout/
└── SubscriptionStatusBadge.tsx

src/components/layout/TopBar.tsx  # Modify to add badge
```

---

## Phase B: Testing (10 tests)

1. Shows ACTIVE badge when active
2. Shows TRIAL badge with days
3. Shows PAST_DUE warning
4. Shows CANCELLED status
5. Upgrade button visible for trial
6. Click navigates to billing
7. Loading state
8. No badge when no subscription
9. Days remaining calculated correctly
10. Tooltip shows full info

---

## Phase C: Implementation

- [ ] Create SubscriptionStatusBadge component
- [ ] Add to TopBar
- [ ] Wire to useBilling hook
