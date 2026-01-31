# Phase 1-4 Gap Analysis - Shipping Carrier Connect

**Task ID:** GAP-21 (NEW)  
**Priority:** P1 (High)  
**Est. Hours:** 8  
**Dependencies:** None  
**Status:** ⬜ Pending

---

## Phase A+D: Planning & Design

### Problem Statement

Organizations cannot connect shipping carriers:
- No FedEx integration UI
- No DHL integration UI
- No shipping account management
- Cannot get rates or print labels

---

### Business Requirements

1. **Carrier Connect Wizard** - Step-by-step setup
2. **FedEx OAuth 2.0** - OAuth flow for FedEx
3. **DHL API Key** - API key form for DHL
4. **Account Management** - View/edit/delete accounts
5. **Connection Test** - Validate credentials

---

### Authentication Methods

| Carrier | Auth Type | Required Fields |
|---------|-----------|-----------------|
| FedEx | OAuth 2.0 | client_id, client_secret, account_number |
| DHL Express | API Key | customer_id, api_key |
| UPS | OAuth 2.0 | client_id, client_secret, account_number |
| Aramex | API Key | account_number, username, password, pin |

---

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/shipping-accounts` | List accounts |
| POST | `/api/v1/shipping-accounts/connect/:carrier` | Connect carrier |
| DELETE | `/api/v1/shipping-accounts/:id` | Delete account |
| POST | `/api/v1/shipping-accounts/:id/test` | Test connection |

---

### Files to Create

```
src/hooks/
└── useShippingAccounts.ts

src/components/shipping/
├── CarrierConnectWizard.tsx
├── ShippingAccountList.tsx
├── CarrierCard.tsx
└── index.ts
```

---

## Phase B: Testing (15 tests)

1. getAccounts - returns list
2. connectFedEx - OAuth flow
3. connectDHL - API key flow
4. deleteAccount - removes account
5. testConnection - validates creds
6. CarrierCard - renders FedEx
7. CarrierCard - renders DHL
8. CarrierConnectWizard - shows form
9. CarrierConnectWizard - FedEx OAuth
10. CarrierConnectWizard - DHL form
11. ShippingAccountList - renders
12. ShippingAccountList - empty state
13. ShippingAccountList - delete button
14. Test connection button works
15. Error handling for invalid creds

---

## Phase C: Implementation

- [ ] Create useShippingAccounts hook
- [ ] Create CarrierConnectWizard
- [ ] Create ShippingAccountList
- [ ] Create CarrierCard
- [ ] Add shipping tab to settings
