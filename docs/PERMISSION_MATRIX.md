# RAPPIT Permission Matrix

> **Version:** 1.0  
> **Task:** AUTH-01  
> **Status:** Approved for Implementation  
> **Date:** 2025-12-28

---

## Roles

| Role | Description | Scope |
|------|-------------|-------|
| **ADMIN** | Full access to organization | All operations + user/billing management |
| **MANAGER** | Operational access | Orders, inventory, shipping — no user management |
| **OPERATOR** | Execute operations | View + execute, no configuration changes |

---

## Permission Matrix

### Orders

| Action | ADMIN | MANAGER | OPERATOR |
|--------|:-----:|:-------:|:--------:|
| View orders | ✅ | ✅ | ✅ |
| View order details | ✅ | ✅ | ✅ |
| Create order (manual) | ✅ | ✅ | ❌ |
| Edit order | ✅ | ✅ | ❌ |
| Cancel order | ✅ | ✅ | ❌ |
| Fulfill order | ✅ | ✅ | ✅ |
| Split order | ✅ | ✅ | ❌ |
| Export orders | ✅ | ✅ | ✅ |

---

### Inventory

| Action | ADMIN | MANAGER | OPERATOR |
|--------|:-----:|:-------:|:--------:|
| View inventory | ✅ | ✅ | ✅ |
| View stock levels | ✅ | ✅ | ✅ |
| Create inventory item | ✅ | ✅ | ❌ |
| Edit inventory item | ✅ | ✅ | ❌ |
| Adjust stock quantity | ✅ | ✅ | ✅ |
| Import inventory (CSV) | ✅ | ✅ | ❌ |
| Export inventory | ✅ | ✅ | ✅ |
| Force release reservation | ✅ | ❌ | ❌ |

---

### Shipments

| Action | ADMIN | MANAGER | OPERATOR |
|--------|:-----:|:-------:|:--------:|
| View shipments | ✅ | ✅ | ✅ |
| View shipment details | ✅ | ✅ | ✅ |
| Create shipment | ✅ | ✅ | ✅ |
| Cancel shipment | ✅ | ✅ | ❌ |
| Reprint label | ✅ | ✅ | ✅ |
| Update tracking | ✅ | ✅ | ✅ |
| Export shipments | ✅ | ✅ | ✅ |

---

### Channels (Integrations)

| Action | ADMIN | MANAGER | OPERATOR |
|--------|:-----:|:-------:|:--------:|
| View channels | ✅ | ✅ | ✅ |
| View channel status | ✅ | ✅ | ✅ |
| Connect channel (OAuth) | ✅ | ❌ | ❌ |
| Disconnect channel | ✅ | ❌ | ❌ |
| Configure channel settings | ✅ | ❌ | ❌ |
| Trigger manual sync | ✅ | ✅ | ❌ |
| View sync history | ✅ | ✅ | ✅ |

---

### Users

| Action | ADMIN | MANAGER | OPERATOR |
|--------|:-----:|:-------:|:--------:|
| View users | ✅ | ❌ | ❌ |
| Invite user | ✅ | ❌ | ❌ |
| Edit user role | ✅ | ❌ | ❌ |
| Remove user | ✅ | ❌ | ❌ |
| Reset user password | ✅ | ❌ | ❌ |

---

### Organization

| Action | ADMIN | MANAGER | OPERATOR |
|--------|:-----:|:-------:|:--------:|
| View organization | ✅ | ✅ | ✅ |
| Edit organization name | ✅ | ❌ | ❌ |
| Edit organization settings | ✅ | ❌ | ❌ |
| View audit logs | ✅ | ✅ | ❌ |
| Export audit logs | ✅ | ❌ | ❌ |

---

### Billing (ADMIN ONLY)

| Action | ADMIN | MANAGER | OPERATOR |
|--------|:-----:|:-------:|:--------:|
| View subscription status | ✅ | ❌ | ❌ |
| View billing history | ✅ | ❌ | ❌ |
| Manage subscription | ✅ | ❌ | ❌ |
| Update payment method | ✅ | ❌ | ❌ |
| Download invoices | ✅ | ❌ | ❌ |

---

### Warehouses

| Action | ADMIN | MANAGER | OPERATOR |
|--------|:-----:|:-------:|:--------:|
| View warehouses | ✅ | ✅ | ✅ |
| Create warehouse | ✅ | ❌ | ❌ |
| Edit warehouse | ✅ | ❌ | ❌ |
| Delete warehouse | ✅ | ❌ | ❌ |
| Assign default warehouse | ✅ | ❌ | ❌ |

---

### Shipping Accounts

| Action | ADMIN | MANAGER | OPERATOR |
|--------|:-----:|:-------:|:--------:|
| View shipping accounts | ✅ | ✅ | ✅ |
| Add shipping account | ✅ | ❌ | ❌ |
| Edit shipping account | ✅ | ❌ | ❌ |
| Delete shipping account | ✅ | ❌ | ❌ |
| Set default carrier | ✅ | ✅ | ❌ |

---

## Summary by Role

### ADMIN
- Full access to all operations
- User management (invite, edit, remove)
- Organization configuration
- Billing and subscription management
- Channel integration management
- Warehouse and shipping account management

### MANAGER
- View all operational data
- Create, edit, cancel orders
- Manage inventory (except force release)
- Create and manage shipments
- Trigger channel syncs
- View audit logs

### OPERATOR
- View all operational data
- Fulfill orders
- Create shipments, reprint labels
- Adjust stock quantities
- Execute day-to-day warehouse operations

---

## Implementation Notes

### Decorator Usage

```typescript
// ADMIN only
@Roles('ADMIN')

// ADMIN or MANAGER
@Roles('ADMIN', 'MANAGER')

// All authenticated users
@Roles('ADMIN', 'MANAGER', 'OPERATOR')
```

### Default Behavior

- Endpoints without `@Roles()` decorator default to `@Roles('ADMIN')`
- Public endpoints use `@Public()` decorator
- Role is extracted from JWT token (`role` claim)

---

*This document is the source of truth for role-based access control in Rappit.*
