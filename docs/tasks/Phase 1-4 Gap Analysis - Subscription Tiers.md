# Phase 1-4 Gap Analysis - Subscription Tiers

**Task ID:** GAP-15  
**Priority:** P0+ (Platform Founder)  
**Est. Hours:** 8  
**Dependencies:** GAP-14 (Admin Platform Dashboard) ✅  
**Status:** 🔄 In Progress

---

## Phase A+D: Planning & Design

### Problem Statement

Platform needs subscription tier management:
- Cannot create/edit subscription plans
- No pricing table for customers
- No feature limits per tier
- Plans not synced with Stripe

---

### Business Requirements

#### Core Features
1. **Plan Management** - CRUD for subscription plans
2. **Feature Limits** - Define limits per plan
3. **Pricing Table** - Customer-facing pricing
4. **Stripe Sync** - Sync with Stripe Products/Prices

#### Plan Features/Limits
- Max users
- Max warehouses
- Max SKUs
- Max orders/month
- Integrations (Shopify, WooCommerce)
- API access
- Support level

---

### API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/admin/plans` | List all plans | SUPER_ADMIN |
| POST | `/api/v1/admin/plans` | Create plan | SUPER_ADMIN |
| PATCH | `/api/v1/admin/plans/:id` | Update plan | SUPER_ADMIN |
| DELETE | `/api/v1/admin/plans/:id` | Delete plan | SUPER_ADMIN |
| GET | `/api/v1/plans` | Public pricing (no auth) | Public |

---

### DTOs

```typescript
interface SubscriptionPlan {
  id: string;
  name: string;
  nameAr: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  features: PlanFeatures;
  stripePriceIdMonthly?: string;
  stripePriceIdYearly?: string;
  isActive: boolean;
  sortOrder: number;
}

interface PlanFeatures {
  maxUsers: number;
  maxWarehouses: number;
  maxSkus: number;
  maxOrdersPerMonth: number;
  integrations: string[];
  apiAccess: boolean;
  supportLevel: 'basic' | 'priority' | 'dedicated';
}
```

---

### Files to Create

```
src/hooks/
└── useSubscriptionPlans.ts

src/components/subscription/
├── PlanFormModal.tsx         # Create/edit plan
├── PlanCard.tsx              # Single plan display
├── PricingTable.tsx          # Customer-facing
├── FeatureLimitsList.tsx     # Features display
└── index.ts
```

---

## Phase B: Testing (20 tests)

1. getPlans - returns plans
2. createPlan - creates plan
3. createPlan - validates required fields
4. updatePlan - updates plan
5. deletePlan - deletes plan
6. syncWithStripe - syncs prices
7. PlanFormModal - renders fields
8. PlanFormModal - validates name required
9. PlanFormModal - submits successfully
10. PlanCard - renders plan info
11. PlanCard - shows features
12. PlanCard - shows pricing
13. PricingTable - renders all plans
14. PricingTable - toggle monthly/yearly
15. PricingTable - highlight popular plan
16. FeatureLimitsList - shows limits
17. FeatureLimitsList - shows checkmarks
18. Filter active plans only
19. Sort by sortOrder
20. Currency formatting

---

## Phase C: Implementation Checklist

- [ ] Create useSubscriptionPlans hook
- [ ] Create PlanFormModal component
- [ ] Create PlanCard component
- [ ] Create PricingTable component
- [ ] Create FeatureLimitsList component
- [ ] Add to admin dashboard
- [ ] Create public /pricing page
