# Phase 1-4 Gap Analysis - Admin Platform Dashboard

**Task ID:** GAP-14  
**Priority:** P0+ (Platform Founder)  
**Est. Hours:** 10  
**Dependencies:** None  
**Status:** 🔄 In Progress

---

## Phase A+D: Planning & Design

### Problem Statement

Platform founders/admins cannot:
- View all organizations on the platform
- See platform-wide statistics (MRR, total orgs, users)
- Manage organizations (activate/deactivate)
- View organization details and usage

This is critical for SaaS platform management.

---

### Business Requirements

#### Core Features
1. **Platform Dashboard** - Overview with key metrics
2. **Organization List** - View all organizations
3. **Organization Details** - Usage, subscription, users
4. **Platform Stats** - Total orgs, MRR, active users
5. **Super Admin Role** - RBAC for platform access

#### Metrics to Display
- Total organizations
- Active subscriptions
- Monthly Recurring Revenue (MRR)
- Total users across all orgs
- New signups this month
- Trial organizations

---

### API Design

#### Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/admin/organizations` | List all orgs | SUPER_ADMIN |
| GET | `/api/v1/admin/organizations/:id` | Get org details | SUPER_ADMIN |
| PATCH | `/api/v1/admin/organizations/:id` | Update org | SUPER_ADMIN |
| GET | `/api/v1/admin/stats` | Platform stats | SUPER_ADMIN |

#### DTOs

```typescript
// Organization List
interface AdminOrganizationListItem {
  id: string;
  name: string;
  isActive: boolean;
  subscriptionStatus: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED';
  currentPlan: string;
  userCount: number;
  orderCount: number;
  createdAt: Date;
}

// Organization Detail
interface AdminOrganizationDetail extends AdminOrganizationListItem {
  billingEmail: string;
  trialEndsAt?: Date;
  subscriptionEndsAt?: Date;
  stripeCustomerId?: string;
  users: Array<{ id: string; email: string; role: string }>;
  recentOrders: number;
  totalRevenue: number;
}

// Platform Stats
interface PlatformStats {
  totalOrganizations: number;
  activeOrganizations: number;
  trialOrganizations: number;
  totalUsers: number;
  mrr: number;
  newSignupsThisMonth: number;
  churnRate: number;
}
```

---

### Files to Create/Modify

#### Frontend
```
src/components/admin/
├── AdminDashboard.tsx       # Main dashboard
├── OrganizationList.tsx     # Org list table
├── OrganizationDetail.tsx   # Org detail view
├── PlatformStatsCards.tsx   # Stats cards
├── OrgStatusBadge.tsx       # Status badge
└── index.ts

src/hooks/
└── useAdmin.ts              # Admin API hook

src/app/admin/
├── page.tsx                 # Admin dashboard page
└── organizations/
    └── [id]/page.tsx        # Org detail page
```

#### Backend (Add Super Admin)
```
src/modules/admin/
├── admin.service.ts
├── admin.controller.ts
└── admin.module.ts
```

---

## Phase B: Testing (Write First!)

### Unit Tests Target: 20

#### useAdmin Hook Tests
1. getStats - returns platform stats
2. getOrganizations - returns org list
3. getOrganizations - filters by status
4. getOrganizations - searches by name
5. getOrganizationById - returns details
6. getOrganizationById - not found error
7. updateOrganization - updates org
8. activateOrganization - activates
9. deactivateOrganization - deactivates

#### AdminDashboard Tests
10. renders stats cards
11. renders organization list
12. stats loading state
13. error state

#### OrganizationList Tests
14. renders org rows
15. status filter works
16. search works
17. click navigates to detail

#### OrganizationDetail Tests
18. renders org info
19. shows user list
20. activate/deactivate button

---

## Phase C: Implementation Checklist

### Hook
- [ ] Create useAdmin hook
  - [ ] getStats
  - [ ] getOrganizations
  - [ ] getOrganizationById
  - [ ] updateOrganization

### Components
- [ ] Create AdminDashboard
- [ ] Create PlatformStatsCards
- [ ] Create OrganizationList
- [ ] Create OrganizationDetail
- [ ] Create OrgStatusBadge

### Routes
- [ ] Add /admin route
- [ ] Add /admin/organizations/:id route
- [ ] Add Admin link to sidebar (Super Admin only)

---

## Verification Checklist

- [ ] All 20 unit tests pass
- [ ] Can view platform stats
- [ ] Can list all organizations
- [ ] Can filter/search organizations
- [ ] Can view organization details
- [ ] Can activate/deactivate org
- [ ] Only Super Admin can access
- [ ] RTL Arabic layout correct
- [ ] Mobile responsive
