# Phase 1-4 Gap Analysis - Orders Enhancements

**Task ID:** GAP-08  
**Priority:** P2 (Medium)  
**Est. Hours:** 10  
**Dependencies:** None  
**Status:** 🔄 In Progress

---

## Phase A+D: Planning & Design

### Problem Statement

Order management needs enhancement:
- Cannot create orders manually (only from integrations)
- No bulk status update
- No order export
- Limited order filters
- No order timeline view

---

### Business Requirements

#### Core Features
1. **Manual Order Creation** - Create order without integration
2. **Bulk Status Update** - Update multiple orders at once
3. **Order Export** - Export orders as CSV
4. **Enhanced Filters** - Status, date, channel, customer
5. **Order Timeline** - Visual status history

#### Use Cases
- Create test orders for development
- Manually add phone/walk-in orders
- Bulk update orders after shipment
- Export for accounting/reporting

---

### API Design

#### Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/v1/orders` | Create manual order | ADMIN, MANAGER |
| PATCH | `/api/v1/orders/bulk-status` | Bulk status update | ADMIN, MANAGER |
| GET | `/api/v1/orders/export` | Export orders CSV | All |
| GET | `/api/v1/orders/:id/timeline` | Get order timeline | All |

#### DTOs

```typescript
// Create Order
interface CreateOrderDto {
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  shippingAddress: {
    street: string;
    city: string;
    country: string;
    postalCode?: string;
  };
  items: Array<{
    skuId: string;
    quantity: number;
    price: number;
  }>;
  notes?: string;
  channel?: string;  // Default: 'MANUAL'
}

// Bulk Status Update
interface BulkStatusUpdateDto {
  orderIds: string[];
  status: OrderStatus;
  notes?: string;
}

// Order Timeline
interface OrderTimelineEvent {
  id: string;
  status: OrderStatus;
  notes?: string;
  userId?: string;
  userName?: string;
  createdAt: Date;
}
```

---

### Files to Create/Modify

#### Frontend
```
src/components/orders/
├── OrderFormModal.tsx       # Manual order creation
├── BulkStatusModal.tsx      # Bulk status update
├── OrderFilters.tsx         # Enhanced filters
├── OrderTimeline.tsx        # Status timeline
├── OrderExportButton.tsx    # Export button
└── index.ts

src/hooks/
└── useOrders.ts             # Orders hook
```

#### Backend (if needed)
```
src/modules/orders/
├── orders.service.ts        # Enhance existing
└── orders.controller.ts     # Add endpoints
```

---

## Phase B: Testing (Write First!)

### Unit Tests Target: 20

#### useOrders Hook Tests
1. fetchOrders - returns orders
2. fetchOrders - applies status filter
3. fetchOrders - applies date filter
4. fetchOrders - applies channel filter
5. createOrder - creates manual order
6. createOrder - validates required fields
7. bulkUpdateStatus - updates multiple
8. bulkUpdateStatus - requires orderIds
9. getTimeline - returns events
10. exportOrders - triggers download

#### OrderFormModal Tests
11. renders form fields
12. validates customer name required
13. validates items required
14. submits order successfully
15. shows error on failure

#### BulkStatusModal Tests
16. shows selected count
17. validates status required
18. submits update successfully

#### OrderFilters Tests
19. renders all filter controls
20. clear filters works

---

## Phase C: Implementation Checklist

### Hook
- [ ] Create useOrders hook
  - [ ] fetchOrders with filters
  - [ ] createOrder
  - [ ] bulkUpdateStatus
  - [ ] getTimeline
  - [ ] exportOrders

### Components
- [ ] Create OrderFormModal
- [ ] Create BulkStatusModal
- [ ] Create OrderFilters
- [ ] Create OrderTimeline
- [ ] Create barrel export

### Wiring
- [ ] Add "إنشاء طلب" button to orders page
- [ ] Add bulk actions toolbar
- [ ] Add export button
- [ ] Add enhanced filters

---

## Verification Checklist

- [ ] All 20 unit tests pass
- [ ] Can create manual order
- [ ] Can bulk update status
- [ ] Can export orders
- [ ] Filters work correctly
- [ ] Timeline displays events
- [ ] RTL Arabic layout correct
- [ ] Mobile responsive
