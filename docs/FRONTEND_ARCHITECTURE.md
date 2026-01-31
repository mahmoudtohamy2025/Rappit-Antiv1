# RAPPIT Frontend Architecture

## Overview

This document describes the actual frontend structure of the RAPPIT application. The frontend uses React with Next.js conventions, organized by feature domains.

---

## Component Structure

Components are organized in `src/components/[feature]/` following a domain-driven structure:

```
src/components/
├── billing/               # Billing & Subscription UI (FE-PAGE-03)
│   ├── BillingPage.tsx    # Main billing management page
│   └── index.ts
│
├── users/                 # User Management (FE-PAGE-01)
│   ├── UserList.tsx       # User list with invite modal
│   └── index.ts
│
├── settings/              # Organization Settings (FE-PAGE-02)
│   ├── OrganizationSettings.tsx
│   └── CurrencySettings.tsx
│
├── channels/              # Channel/OAuth Integration (FE-PAGE-05)
│   ├── ChannelConnectWizard.tsx  # Shopify/WooCommerce OAuth
│   └── ConnectedChannelList.tsx
│
├── inventory/             # Inventory Management
│   ├── movements/
│   ├── transfers/
│   ├── cycle-count/
│   ├── force-release/
│   └── validation/
│
├── common/                # Shared Components
│   ├── ErrorBoundary.tsx
│   └── ConfirmationDialog.tsx
│
├── TopBar.tsx             # Header with subscription badge (FE-PAGE-04)
├── LoginPage.tsx          # Authentication UI (FE-AUTH-01)
└── LandingPage.tsx        # Marketing page (FE-LAND-01)
```

---

## Key Frontend Features

| Task ID | Feature | Component Location |
|---------|---------|-------------------|
| FE-AUTH-01 | Login Page | `components/LoginPage.tsx` |
| FE-PAGE-01 | Users Management | `components/users/UserList.tsx` |
| FE-PAGE-02 | Org Settings | `components/settings/OrganizationSettings.tsx` |
| FE-PAGE-03 | Billing + Stripe | `components/billing/BillingPage.tsx` |
| FE-PAGE-04 | TopBar Status | `components/TopBar.tsx` + `UI/BillingStatusBadge` |
| FE-PAGE-05 | Channel OAuth | `components/channels/ChannelConnectWizard.tsx` |
| FE-LAND-01 | Landing Page | `components/LandingPage.tsx` |

---

## Routing

Components are composed into routes via `App.tsx`. The `src/app/` directory contains Next.js route handlers that import these components.

**Example:**
```tsx
// In App.tsx or a route file
import { BillingPage } from './components/billing';
```

---

## Design System

- **Font:** Cairo (Arabic), Inter (English)
- **Styling:** Tailwind CSS 4.1
- **Layout:** RTL-first (Arabic default)
- **UI Library:** Radix UI primitives + custom components in `src/components/UI/`

---

## Hooks

Custom hooks in `src/hooks/`:

| Hook | Purpose |
|------|---------|
| `useUsers` | User management API |
| `useBilling` | Subscription & payment API |
| `useChannels` | Channel connection API |
| `useOrganization` | Org settings API |

---

## Notes

- Components are feature-complete and production-ready
- This structure supports code-splitting via dynamic imports
- Migration to `src/app/` pages is optional and can be done incrementally if SSR metadata is needed
