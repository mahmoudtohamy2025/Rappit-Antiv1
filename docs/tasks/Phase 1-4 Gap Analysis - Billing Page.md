# Phase 1-4 Gap Analysis - Billing Page

**Task ID:** GAP-16  
**Priority:** P0+ (Platform Founder)  
**Est. Hours:** 8  
**Dependencies:** GAP-15 (Subscription Tiers) ✅  
**Status:** 🔄 In Progress

---

## Phase A+D: Planning & Design

### Problem Statement

Organizations cannot manage their billing:
- View current subscription
- Upgrade/downgrade plan
- Update payment method
- View invoice history

---

### Business Requirements

#### Core Features
1. **Current Plan Card** - Show active subscription
2. **Upgrade/Downgrade** - Change plan
3. **Payment Method** - Update card
4. **Invoice History** - Past invoices
5. **Stripe Integration** - Checkout & portal

---

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/billing/subscription` | Current subscription |
| POST | `/api/v1/billing/create-checkout` | Create Stripe checkout |
| POST | `/api/v1/billing/customer-portal` | Stripe portal link |
| GET | `/api/v1/billing/invoices` | Invoice history |

---

### Files to Create

```
src/hooks/
└── useBilling.ts

src/components/billing/
├── BillingPage.tsx           # Main page
├── CurrentPlanCard.tsx       # Active subscription
├── PaymentMethodCard.tsx     # Card on file
├── InvoiceHistory.tsx        # Past invoices
├── UpgradePlanModal.tsx      # Plan change
└── index.ts
```

---

## Phase B: Testing (20 tests)

1. getSubscription - returns current sub
2. getInvoices - returns invoices
3. createCheckout - returns URL
4. openCustomerPortal - opens Stripe
5. CurrentPlanCard - renders plan name
6. CurrentPlanCard - shows trial days
7. CurrentPlanCard - shows past due warning
8. PaymentMethodCard - shows last 4 digits
9. PaymentMethodCard - update button works
10. InvoiceHistory - renders rows
11. InvoiceHistory - download link
12. InvoiceHistory - empty state
13. UpgradePlanModal - shows plans
14. UpgradePlanModal - selects plan
15. UpgradePlanModal - submits change
16. BillingPage - renders all cards
17. BillingPage - loading state
18. BillingPage - error state
19. Trial expiry warning
20. Cancelled status display

---

## Phase C: Implementation Checklist

- [ ] Create useBilling hook
- [ ] Create CurrentPlanCard
- [ ] Create PaymentMethodCard
- [ ] Create InvoiceHistory
- [ ] Create UpgradePlanModal
- [ ] Create BillingPage
- [ ] Add billing tab to settings
