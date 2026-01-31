# Phase 1-4 Gap Analysis - Multi-Currency

**Task ID:** GAP-20  
**Priority:** P0+ (Platform Feature)  
**Est. Hours:** 6  
**Dependencies:** GAP-10 (Org Settings) - can be done in parallel  
**Status:** 🔄 In Progress

---

## Phase A+D: Planning & Design

### Problem Statement

Organizations operate in different regions with different currencies:
- **Egypt (EGP)** - Egyptian Pound
- **Saudi Arabia (SAR)** - Saudi Riyal
- **UAE (AED)** - UAE Dirham
- **USA (USD)** - US Dollar
- **Europe (EUR)** - Euro

Currently, there's no organization-level currency setting. Orders have currency but it's not tied to org defaults.

---

### Business Requirements

#### Core Features
1. **Default Currency** - Each org has one default currency
2. **Supported Currencies** - Org can enable multiple currencies
3. **Currency Display** - Prices shown with correct symbol and format
4. **Currency Selection** - Dropdown in orders/products

#### Supported Currencies (Initial)
| Code | Symbol | Name | Format |
|------|--------|------|--------|
| EGP | ج.م | الجنيه المصري | 1,234.56 ج.م |
| SAR | ر.س | الريال السعودي | 1,234.56 ر.س |
| AED | د.إ | الدرهم الإماراتي | 1,234.56 د.إ |
| USD | $ | الدولار الأمريكي | $1,234.56 |
| EUR | € | اليورو | €1,234.56 |

#### Business Rules
- Every org must have exactly one default currency
- Orders inherit org's default currency if not specified
- Currency format respects locale (Arabic RTL)
- Future: exchange rates (out of scope for now)

---

### API Design

#### Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/currencies` | List available currencies | All |
| GET | `/api/v1/organizations/current/currency` | Get org currency settings | All |
| PATCH | `/api/v1/organizations/current/currency` | Update currency settings | ADMIN |

#### DTOs

```typescript
// Currency definition
interface Currency {
  code: string;        // EGP, SAR, AED, USD, EUR
  symbol: string;      // ج.م, ر.س, etc.
  nameAr: string;      // الجنيه المصري
  nameEn: string;      // Egyptian Pound
  decimalPlaces: number;
  symbolPosition: 'before' | 'after';
}

// Organization currency settings
interface OrgCurrencySettings {
  defaultCurrency: string;           // Currency code
  supportedCurrencies: string[];     // List of enabled currency codes
}

// Update DTO
interface UpdateCurrencySettingsDto {
  defaultCurrency?: string;
  supportedCurrencies?: string[];
}

// Format helper response
interface FormattedPrice {
  raw: number;
  formatted: string;      // "1,234.56 ج.م"
  currency: Currency;
}
```

---

### Database Changes

#### Add to Organization Model

```prisma
model Organization {
  // ... existing fields
  
  // Currency settings (GAP-20)
  defaultCurrency      String   @default("SAR") @map("default_currency")
  supportedCurrencies  String[] @default(["SAR"]) @map("supported_currencies")
}
```

#### Migration

```sql
ALTER TABLE organizations 
  ADD COLUMN default_currency VARCHAR(3) DEFAULT 'SAR',
  ADD COLUMN supported_currencies TEXT[] DEFAULT ARRAY['SAR'];
```

---

### Files to Create/Modify

#### Backend
```
src/modules/currency/
├── currency.service.ts
├── currency.controller.ts
├── currency.module.ts
├── currency.constants.ts    # Currency definitions
└── currency.service.spec.ts
```

#### Frontend
```
src/lib/
└── currency.ts              # Format helpers

src/components/settings/
└── CurrencySettings.tsx     # Settings panel

src/components/common/
└── CurrencySelect.tsx       # Dropdown
└── PriceDisplay.tsx         # Formatted price
```

#### Tests
```
test/unit/currency.spec.ts
```

---

## Phase B: Testing (Write First!)

### Unit Tests Target: 15

#### CurrencyService Tests
1. getAvailableCurrencies - returns all 5 currencies
2. getCurrencyByCode - returns currency details
3. getCurrencyByCode - throws for invalid code
4. getOrgCurrencySettings - returns org settings
5. updateCurrencySettings - updates default currency
6. updateCurrencySettings - validates currency code
7. updateCurrencySettings - adds supported currencies
8. updateCurrencySettings - removes currency from supported
9. updateCurrencySettings - cannot remove default from supported
10. formatPrice - formats with symbol after (Arabic)
11. formatPrice - formats with symbol before (USD)
12. formatPrice - handles decimal places correctly
13. formatPrice - handles large numbers with commas
14. parseFormattedPrice - extracts raw value
15. validateCurrencyCode - returns true for valid codes

---

## Phase C: Implementation Checklist

### Backend
- [ ] Create migration for currency fields
- [ ] Create currency.constants.ts with definitions
- [ ] Implement CurrencyService
- [ ] Implement CurrencyController
- [ ] Create CurrencyModule
- [ ] Register in AppModule

### Frontend
- [ ] Create currency.ts helpers
- [ ] Create CurrencySettings component
- [ ] Create CurrencySelect component
- [ ] Create PriceDisplay component
- [ ] Add currency settings to org settings page

### Wiring
- [ ] Update order display to use PriceDisplay
- [ ] Update product display to use PriceDisplay
- [ ] Update forms to use CurrencySelect

---

## Verification Checklist

- [ ] All 15 unit tests pass
- [ ] Can change default currency
- [ ] Prices display with correct format
- [ ] Arabic symbols display correctly (RTL)
- [ ] Settings persist correctly
- [ ] Mobile responsive
- [ ] Dark mode supported
