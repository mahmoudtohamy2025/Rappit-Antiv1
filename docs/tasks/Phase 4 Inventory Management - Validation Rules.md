# INV-04: Inventory Validation Rules

## Problem Statement

Without validation rules, bad data enters the inventory system causing:

- **Negative quantities** - System shows -5 items in stock
- **Invalid SKUs** - Misspelled or malformed product codes
- **Missing warehouses** - Items assigned to non-existent locations
- **Impossible values** - 999,999,999 quantity entered by mistake
- **Duplicate entries** - Same SKU created twice with different quantities
- **Data inconsistencies** - Related data doesn't match

### Common Scenarios

1. **Manual Entry Errors** - Staff typing mistakes
2. **CSV Import Issues** - Malformed import data
3. **API Integration Bugs** - Third-party systems sending bad data
4. **Copy/Paste Mistakes** - Wrong data in wrong fields
5. **System Migration** - Legacy data with different formats

Without validation, these errors propagate through the system causing order failures, incorrect reports, and customer complaints.

---

## Business Logic

### Validation Flow

```
[Incoming Inventory Data]
        │
        ▼
[Load Active Rules for Organization]
        │
        ▼
[Apply Rules in Priority Order]
        │
        ├──▶ Rule 1: SKU Format → Pass/Fail
        ├──▶ Rule 2: Quantity Range → Pass/Fail
        ├──▶ Rule 3: Warehouse Required → Pass/Fail
        └──▶ Rule N: Custom Rule → Pass/Fail
        │
        ▼
[Collect All Errors]
        │
        ├──▶ Any Failures → Reject with detailed errors
        └──▶ All Pass → Allow operation to proceed
```

### Rule Types

| Rule Type | Description | Example |
|-----------|-------------|---------|
| SKU_FORMAT | SKU must match pattern | `^[A-Z]{3}-\d{5}$` |
| QUANTITY_NON_NEGATIVE | Cannot be negative | `quantity >= 0` |
| QUANTITY_MAXIMUM | Maximum allowed | `quantity <= 100000` |
| WAREHOUSE_REQUIRED | Must specify warehouse | `warehouseId != null` |
| WAREHOUSE_EXISTS | Warehouse must exist | DB lookup |
| DUPLICATE_SKU | Prevent duplicates | Unique check |
| MIN_MAX_LOGIC | minStock < maxStock | Comparison |
| COST_NON_NEGATIVE | Cost cannot be negative | `unitCost >= 0` |
| NAME_REQUIRED | Product name required | `name != empty` |
| CUSTOM_REGEX | Custom pattern match | User-defined |

### Rule Priority

Rules execute in order of priority (lower number = higher priority):

```
Priority 1: REQUIRED fields (fastest to check, most common errors)
Priority 2: FORMAT validation (quick regex checks)
Priority 3: RANGE validation (simple comparisons)
Priority 4: EXISTENCE checks (require DB lookups)
Priority 5: UNIQUENESS checks (most expensive)
```

---

## API Design

### Validate Inventory Item

```typescript
validate(
    item: {
        sku: string;
        name?: string;
        quantity: number;
        warehouseId: string;
        minStock?: number;
        maxStock?: number;
        unitCost?: number;
        [key: string]: any;          // Additional fields
    },
    context: { organizationId: string }
): Promise<ValidationResult>

interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];   // Non-blocking issues
}

interface ValidationError {
    field: string;                   // Which field failed
    rule: string;                    // Which rule failed
    message: string;                 // Human-readable error
    value: any;                      // The invalid value
    code: string;                    // Error code for i18n
}

interface ValidationWarning {
    field: string;
    message: string;
    suggestion: string;              // How to fix
}
```

### Validate Batch

```typescript
validateBatch(
    items: InventoryItem[],
    context: { organizationId: string }
): Promise<BatchValidationResult>

interface BatchValidationResult {
    valid: boolean;
    totalItems: number;
    validItems: number;
    invalidItems: number;
    results: Array<{
        index: number;
        item: InventoryItem;
        valid: boolean;
        errors: ValidationError[];
    }>;
}
```

### Get Active Rules

```typescript
getActiveRules(
    context: { organizationId: string }
): Promise<ValidationRule[]>

interface ValidationRule {
    id: string;
    name: string;
    type: RuleType;
    field: string;                   // Which field it validates
    config: RuleConfig;              // Type-specific config
    priority: number;                // Execution order
    enabled: boolean;
    errorMessage: string;            // Custom error message
    createdAt: Date;
    updatedAt: Date;
}
```

### Create Custom Rule

```typescript
createRule(
    rule: {
        name: string;
        type: RuleType;
        field: string;
        config: RuleConfig;
        priority?: number;
        errorMessage?: string;
    },
    context: { organizationId: string; userId: string }
): Promise<CreateRuleResult>

// Example configs by type:
interface SkuFormatConfig {
    pattern: string;                 // Regex pattern
    flags?: string;                  // Regex flags
}

interface QuantityRangeConfig {
    min?: number;
    max?: number;
    inclusive?: boolean;
}

interface CustomRegexConfig {
    field: string;
    pattern: string;
    flags?: string;
}
```

### Update Rule

```typescript
updateRule(
    ruleId: string,
    updates: Partial<ValidationRule>,
    context: { organizationId: string; userId: string }
): Promise<UpdateRuleResult>
```

### Delete Rule

```typescript
deleteRule(
    ruleId: string,
    context: { organizationId: string; userId: string }
): Promise<DeleteRuleResult>
```

### Enable/Disable Rule

```typescript
toggleRule(
    ruleId: string,
    enabled: boolean,
    context: { organizationId: string; userId: string }
): Promise<ToggleResult>
```

---

## Built-in Rules

These rules are created by default for every organization:

| Rule | Field | Default Config | Enabled |
|------|-------|----------------|---------|
| SKU_FORMAT | sku | `^[A-Za-z0-9-_]+$` | ✅ Yes |
| QUANTITY_NON_NEGATIVE | quantity | min: 0 | ✅ Yes |
| QUANTITY_MAXIMUM | quantity | max: 1,000,000 | ✅ Yes |
| WAREHOUSE_REQUIRED | warehouseId | - | ✅ Yes |
| WAREHOUSE_EXISTS | warehouseId | - | ✅ Yes |
| DUPLICATE_SKU | sku | - | ✅ Yes |
| NAME_REQUIRED | name | - | ❌ No |
| COST_NON_NEGATIVE | unitCost | min: 0 | ❌ No |
| MIN_MAX_LOGIC | minStock/maxStock | - | ❌ No |

---

## Safety Guards

1. **Cannot Disable All Rules** - At least SKU_FORMAT required
2. **Regex Timeout** - Custom regex limited to 100ms execution
3. **Regex Complexity** - Prevent catastrophic backtracking
4. **Rule Limit** - Maximum 50 rules per organization
5. **Priority Uniqueness** - Cannot have same priority twice
6. **Built-in Protection** - Cannot delete built-in rules
7. **Error Collection** - Continue validation to collect all errors
8. **Cache Invalidation** - Rules cached but invalidated on change

---

## Test Coverage Plan

### Unit Tests (~34 tests)

| Category | Tests |
|----------|-------|
| **Built-in Rules** | 12 |
| - SKU format validation | |
| - Quantity non-negative | |
| - Quantity maximum | |
| - Warehouse required | |
| - Warehouse exists | |
| - Duplicate SKU | |
| - Name required | |
| - Cost non-negative | |
| - Min/Max logic | |
| - Handle null values | |
| - Handle undefined values | |
| - Handle empty strings | |
| **Rule Management** | 10 |
| - Create custom rule | |
| - Update rule config | |
| - Delete custom rule | |
| - Cannot delete built-in | |
| - Enable/disable rule | |
| - Set priority | |
| - Reject duplicate priority | |
| - Enforce rule limit | |
| - Validate regex safety | |
| - Reject invalid regex | |
| **Validation Execution** | 8 |
| - Execute in priority order | |
| - Collect all errors | |
| - Stop on critical error (configurable) | |
| - Return warnings separately | |
| - Handle batch validation | |
| - Cache rules per org | |
| - Invalidate cache on update | |
| - Cross-org isolation | |
| **Hardening** | 4 |
| - Regex timeout protection | |
| - Large batch handling | |
| - Concurrent validation | |
| - Database failure recovery | |

### Integration Tests (~23 tests)

| Category | Tests |
|----------|-------|
| E2E Validation Flow | 8 |
| Rule CRUD Operations | 6 |
| Batch Validation | 4 |
| Security | 3 |
| Performance | 2 |

---

## Data Model

### ValidationRule

```typescript
interface ValidationRule {
    id: string;
    organizationId: string;
    name: string;
    type: RuleType;
    field: string;
    config: {
        // Type-specific configuration
        pattern?: string;            // For regex rules
        min?: number;                // For range rules
        max?: number;
        inclusive?: boolean;
        required?: boolean;
        unique?: boolean;
        lookupTable?: string;        // For existence rules
    };
    priority: number;
    enabled: boolean;
    isBuiltIn: boolean;              // Cannot delete if true
    errorMessage: string;
    errorCode: string;               // For i18n
    createdBy?: string;
    createdAt: Date;
    updatedAt: Date;
}
```

### RuleType Enum

```typescript
enum RuleType {
    SKU_FORMAT = 'SKU_FORMAT',
    QUANTITY_NON_NEGATIVE = 'QUANTITY_NON_NEGATIVE',
    QUANTITY_MAXIMUM = 'QUANTITY_MAXIMUM',
    QUANTITY_RANGE = 'QUANTITY_RANGE',
    WAREHOUSE_REQUIRED = 'WAREHOUSE_REQUIRED',
    WAREHOUSE_EXISTS = 'WAREHOUSE_EXISTS',
    DUPLICATE_SKU = 'DUPLICATE_SKU',
    NAME_REQUIRED = 'NAME_REQUIRED',
    COST_NON_NEGATIVE = 'COST_NON_NEGATIVE',
    MIN_MAX_LOGIC = 'MIN_MAX_LOGIC',
    CUSTOM_REGEX = 'CUSTOM_REGEX',
    CUSTOM_RANGE = 'CUSTOM_RANGE',
    CUSTOM_REQUIRED = 'CUSTOM_REQUIRED',
    CUSTOM_LOOKUP = 'CUSTOM_LOOKUP',
}
```

---

## Error Codes

| Code | Message | Field |
|------|---------|-------|
| INV_001 | SKU format invalid | sku |
| INV_002 | Quantity cannot be negative | quantity |
| INV_003 | Quantity exceeds maximum | quantity |
| INV_004 | Warehouse is required | warehouseId |
| INV_005 | Warehouse not found | warehouseId |
| INV_006 | Duplicate SKU exists | sku |
| INV_007 | Product name is required | name |
| INV_008 | Cost cannot be negative | unitCost |
| INV_009 | minStock must be less than maxStock | minStock |
| INV_010 | Custom validation failed | (varies) |

---

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| MAX_RULES_PER_ORG | 50 | Maximum custom rules |
| REGEX_TIMEOUT_MS | 100 | Regex execution timeout |
| CACHE_TTL_SECONDS | 300 | Rule cache duration |
| COLLECT_ALL_ERRORS | true | Don't stop on first error |
| ENABLE_WARNINGS | true | Return non-blocking warnings |

---

## Implementation File

`src/modules/inventory/inventory-validation.service.ts`

## Total Tests: 57 (34 unit + 23 integration)
