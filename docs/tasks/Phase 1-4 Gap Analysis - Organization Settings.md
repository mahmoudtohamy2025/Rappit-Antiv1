# Phase 1-4 Gap Analysis - Organization Settings

**Task ID:** GAP-10  
**Priority:** P2 (Medium)  
**Est. Hours:** 6  
**Dependencies:** GAP-20 (Multi-Currency) ✅ 
**Status:** 🔄 In Progress

---

## Phase A+D: Planning & Design

### Problem Statement

Organizations cannot:
- Update their profile (name, logo)
- Configure notification preferences
- Set timezone for reports
- View organization statistics
- Manage general settings

This is essential for a complete org management experience.

---

### Business Requirements

#### Core Features
1. **Organization Profile** - Name, logo
2. **Notification Settings** - Email preferences, alerts
3. **Timezone Settings** - For reports and timestamps
4. **Organization Stats** - Orders count, inventory count, users
5. **Currency Settings** - Already done in GAP-20

#### Settings Categories
- **General**: Name, logo, timezone
- **Notifications**: Email alerts, low stock alerts
- **Currency**: Default and supported (GAP-20)
- **Security**: Future (session timeout, 2FA)

---

### API Design

#### Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/organizations/current` | Get current org | All |
| PATCH | `/api/v1/organizations/current` | Update org profile | ADMIN |
| GET | `/api/v1/organizations/current/stats` | Get org statistics | All |
| GET | `/api/v1/organizations/current/settings` | Get org settings | All |
| PATCH | `/api/v1/organizations/current/settings` | Update settings | ADMIN |

#### DTOs

```typescript
// Organization profile
interface OrganizationProfile {
  id: string;
  name: string;
  logo: string | null;
  timezone: string;
  isActive: boolean;
  createdAt: Date;
  
  // Stats (computed)
  usersCount: number;
  warehousesCount: number;
  productsCount: number;
  ordersCount: number;
}

// Update profile
interface UpdateOrganizationDto {
  name?: string;
  logo?: string;
  timezone?: string;
}

// Organization settings
interface OrganizationSettings {
  notifications: {
    emailEnabled: boolean;
    lowStockAlerts: boolean;
    orderAlerts: boolean;
    weeklyReport: boolean;
  };
  general: {
    timezone: string;
    dateFormat: string;
    language: string;
  };
}

// Update settings
interface UpdateSettingsDto {
  notifications?: Partial<OrganizationSettings['notifications']>;
  general?: Partial<OrganizationSettings['general']>;
}

// Organization stats
interface OrganizationStats {
  users: number;
  warehouses: number;
  products: number;
  orders: {
    total: number;
    thisMonth: number;
    pending: number;
  };
  inventory: {
    totalItems: number;
    lowStock: number;
    outOfStock: number;
  };
}
```

---

### Database Changes

#### Add to Organization Model

```prisma
model Organization {
  // ... existing fields
  
  // Settings (GAP-10)
  logo          String?
  timezone      String   @default("Asia/Riyadh")
  settings      Json?    // { notifications: {...}, general: {...} }
}
```

---

### Files to Create/Modify

#### Backend
```
src/modules/organizations/
├── dto/
│   ├── update-organization.dto.ts
│   └── organization-settings.dto.ts
├── organization.service.ts   (enhance)
├── organization.controller.ts (enhance)
└── organization.spec.ts (enhance)
```

#### Frontend
```
src/components/settings/
├── OrganizationSettings.tsx
├── NotificationSettings.tsx
├── GeneralSettings.tsx
├── OrganizationStats.tsx
└── index.ts

src/hooks/
└── useOrganization.ts

src/app/settings/
└── page.tsx (enhance)
```

#### Tests
```
test/unit/organization-settings.spec.ts
```

---

## Phase B: Testing (Write First!)

### Unit Tests Target: 18

#### OrganizationService Tests
1. getCurrentOrganization - returns org profile
2. getCurrentOrganization - includes stats
3. updateOrganization - updates name
4. updateOrganization - updates logo
5. updateOrganization - updates timezone
6. updateOrganization - validates timezone
7. getSettings - returns settings
8. getSettings - returns defaults if null
9. updateSettings - updates notifications
10. updateSettings - updates general settings
11. updateSettings - partial update
12. getStats - returns user count
13. getStats - returns warehouse count
14. getStats - returns product count
15. getStats - returns order counts (total, thisMonth, pending)
16. getStats - returns inventory stats (total, low, out)
17. validateTimezone - accepts valid timezone
18. validateTimezone - rejects invalid timezone

---

## Phase C: Implementation Checklist

### Backend
- [ ] Add fields to Organization model (migration)
- [ ] Implement getOrganization with stats
- [ ] Implement updateOrganization
- [ ] Implement getSettings / updateSettings
- [ ] Implement getStats

### Frontend
- [ ] Create useOrganization hook
- [ ] Create OrganizationSettings component
- [ ] Create NotificationSettings component
- [ ] Create GeneralSettings component
- [ ] Create OrganizationStats component
- [ ] Update Settings page to include all tabs

### Wiring
- [ ] Connect settings components to API
- [ ] Add loading states
- [ ] Add error handling
- [ ] Add success toasts

---

## Verification Checklist

- [ ] All 18 unit tests pass
- [ ] Can update org name
- [ ] Can update timezone
- [ ] Can update notification settings
- [ ] Stats display correctly
- [ ] Settings persist
- [ ] RTL Arabic layout correct
- [ ] Mobile responsive
- [ ] Dark mode supported
