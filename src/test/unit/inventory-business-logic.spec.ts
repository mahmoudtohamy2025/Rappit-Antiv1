/**
 * Unit Tests for Inventory Business Logic
 * 
 * These tests verify the pure business logic functions without database dependencies.
 * Uses the in-memory repository for testing.
 * 
 * @packageDocumentation
 */

import {
  calculateReservation,
  calculateRelease,
  calculateAdjustment,
  validateStockLevel,
  calculateInventorySummary,
  validateAdjustmentInput,
  hasActiveReservations,
  getActiveReservations,
  getTotalReservedQuantity,
  MAX_INVENTORY_QUANTITY,
  InventoryLevelData,
  ReservationData,
  OrderItemData,
} from '@modules/inventory/inventory-business-logic';

import {
  InMemoryInventoryRepository,
} from '@modules/inventory/inventory-repository.interface';

describe('Inventory Business Logic - Pure Functions', () => {
  describe('calculateReservation', () => {
    const orderItem: OrderItemData = {
      skuId: 'sku_1',
      quantity: 10,
      sku: { sku: 'TEST-SKU-001' },
    };

    it('should calculate reservation when sufficient stock is available', () => {
      const inventoryLevels: InventoryLevelData[] = [
        {
          id: 'inv_1',
          organizationId: 'org_1',
          skuId: 'sku_1',
          warehouseId: 'wh_1',
          available: 100,
          reserved: 0,
        },
      ];

      const result = calculateReservation(orderItem, inventoryLevels);

      expect(result.inventoryLevelId).toBe('inv_1');
      expect(result.quantityToReserve).toBe(10);
      expect(result.newAvailable).toBe(90);
      expect(result.newReserved).toBe(10);
    });

    it('should select inventory level with sufficient stock', () => {
      const inventoryLevels: InventoryLevelData[] = [
        {
          id: 'inv_1',
          organizationId: 'org_1',
          skuId: 'sku_1',
          warehouseId: 'wh_1',
          available: 5, // Insufficient
          reserved: 0,
        },
        {
          id: 'inv_2',
          organizationId: 'org_1',
          skuId: 'sku_1',
          warehouseId: 'wh_2',
          available: 50, // Sufficient
          reserved: 10,
        },
      ];

      const result = calculateReservation(orderItem, inventoryLevels);

      expect(result.inventoryLevelId).toBe('inv_2');
      expect(result.newAvailable).toBe(40);
      expect(result.newReserved).toBe(20);
    });

    it('should throw error when no inventory levels exist', () => {
      expect(() => calculateReservation(orderItem, [])).toThrow(
        'Inventory not found for SKU: TEST-SKU-001',
      );
    });

    it('should throw error when insufficient stock', () => {
      const inventoryLevels: InventoryLevelData[] = [
        {
          id: 'inv_1',
          organizationId: 'org_1',
          skuId: 'sku_1',
          warehouseId: 'wh_1',
          available: 5,
          reserved: 0,
        },
      ];

      expect(() => calculateReservation(orderItem, inventoryLevels)).toThrow(
        'Insufficient stock for SKU TEST-SKU-001. Available: 5, Required: 10',
      );
    });

    it('should throw error when reservation would exceed max quantity', () => {
      const largeOrderItem: OrderItemData = {
        skuId: 'sku_1',
        quantity: 100,
        sku: { sku: 'TEST-SKU-001' },
      };

      const inventoryLevels: InventoryLevelData[] = [
        {
          id: 'inv_1',
          organizationId: 'org_1',
          skuId: 'sku_1',
          warehouseId: 'wh_1',
          available: 1000,
          reserved: MAX_INVENTORY_QUANTITY - 50, // Near max
        },
      ];

      expect(() => calculateReservation(largeOrderItem, inventoryLevels)).toThrow(
        `Reserved quantity would exceed maximum of ${MAX_INVENTORY_QUANTITY}`,
      );
    });

    it('should throw error when order quantity is less than minimum', () => {
      const zeroQuantityItem: OrderItemData = {
        skuId: 'sku_1',
        quantity: 0,
        sku: { sku: 'TEST-SKU-001' },
      };

      const inventoryLevels: InventoryLevelData[] = [
        {
          id: 'inv_1',
          organizationId: 'org_1',
          skuId: 'sku_1',
          warehouseId: 'wh_1',
          available: 100,
          reserved: 0,
        },
      ];

      expect(() => calculateReservation(zeroQuantityItem, inventoryLevels)).toThrow(
        'Order item quantity must be at least 1',
      );
    });
  });

  describe('calculateRelease', () => {
    it('should calculate release correctly', () => {
      const reservation: ReservationData = {
        id: 'res_1',
        organizationId: 'org_1',
        orderId: 'order_1',
        skuId: 'sku_1',
        warehouseId: 'wh_1',
        quantityReserved: 10,
        releasedAt: null,
      };

      const inventoryLevel: InventoryLevelData = {
        id: 'inv_1',
        organizationId: 'org_1',
        skuId: 'sku_1',
        warehouseId: 'wh_1',
        available: 90,
        reserved: 10,
      };

      const result = calculateRelease(reservation, inventoryLevel);

      expect(result.quantityToRelease).toBe(10);
      expect(result.newAvailable).toBe(100);
      expect(result.newReserved).toBe(0);
    });

    it('should throw error when reservation already released', () => {
      const releasedReservation: ReservationData = {
        id: 'res_1',
        organizationId: 'org_1',
        orderId: 'order_1',
        skuId: 'sku_1',
        warehouseId: 'wh_1',
        quantityReserved: 10,
        releasedAt: new Date(),
      };

      const inventoryLevel: InventoryLevelData = {
        id: 'inv_1',
        organizationId: 'org_1',
        skuId: 'sku_1',
        warehouseId: 'wh_1',
        available: 90,
        reserved: 10,
      };

      expect(() => calculateRelease(releasedReservation, inventoryLevel)).toThrow(
        'Reservation res_1 has already been released',
      );
    });

    it('should not result in negative reserved quantity', () => {
      const reservation: ReservationData = {
        id: 'res_1',
        organizationId: 'org_1',
        orderId: 'order_1',
        skuId: 'sku_1',
        warehouseId: 'wh_1',
        quantityReserved: 15,
        releasedAt: null,
      };

      const inventoryLevel: InventoryLevelData = {
        id: 'inv_1',
        organizationId: 'org_1',
        skuId: 'sku_1',
        warehouseId: 'wh_1',
        available: 85,
        reserved: 10, // Less than reservation
      };

      const result = calculateRelease(reservation, inventoryLevel);

      expect(result.newReserved).toBe(0); // Should not go negative
      expect(result.newAvailable).toBe(100);
    });
  });

  describe('calculateAdjustment', () => {
    const inventoryLevel: InventoryLevelData = {
      id: 'inv_1',
      organizationId: 'org_1',
      skuId: 'sku_1',
      warehouseId: 'wh_1',
      available: 100,
      reserved: 10,
    };

    it('should calculate positive adjustment correctly', () => {
      const result = calculateAdjustment(inventoryLevel, 50);

      expect(result.isValid).toBe(true);
      expect(result.newAvailable).toBe(150);
    });

    it('should calculate negative adjustment correctly', () => {
      const result = calculateAdjustment(inventoryLevel, -30);

      expect(result.isValid).toBe(true);
      expect(result.newAvailable).toBe(70);
    });

    it('should reject adjustment that would result in negative quantity', () => {
      const result = calculateAdjustment(inventoryLevel, -150);

      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain('negative available quantity');
    });

    it('should reject adjustment that would exceed max quantity', () => {
      const result = calculateAdjustment(inventoryLevel, MAX_INVENTORY_QUANTITY);

      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain('exceed maximum quantity');
    });
  });

  describe('validateStockLevel', () => {
    it('should return valid for sufficient stock', () => {
      const inventoryLevel: InventoryLevelData = {
        id: 'inv_1',
        organizationId: 'org_1',
        skuId: 'sku_1',
        warehouseId: 'wh_1',
        available: 100,
        reserved: 10,
      };

      const result = validateStockLevel(inventoryLevel, 50);

      expect(result.isValid).toBe(true);
      expect(result.available).toBe(100);
    });

    it('should return invalid for insufficient stock', () => {
      const inventoryLevel: InventoryLevelData = {
        id: 'inv_1',
        organizationId: 'org_1',
        skuId: 'sku_1',
        warehouseId: 'wh_1',
        available: 30,
        reserved: 10,
      };

      const result = validateStockLevel(inventoryLevel, 50);

      expect(result.isValid).toBe(false);
      expect(result.message).toContain('Insufficient stock');
    });

    it('should return invalid when inventory level is null', () => {
      const result = validateStockLevel(null, 10);

      expect(result.isValid).toBe(false);
      expect(result.message).toBe('Inventory level not found');
    });
  });

  describe('calculateInventorySummary', () => {
    it('should calculate summary correctly', () => {
      const inventoryLevels: InventoryLevelData[] = [
        {
          id: 'inv_1',
          organizationId: 'org_1',
          skuId: 'sku_1',
          warehouseId: 'wh_1',
          available: 100,
          reserved: 10,
          damaged: 5,
        },
        {
          id: 'inv_2',
          organizationId: 'org_1',
          skuId: 'sku_2',
          warehouseId: 'wh_1',
          available: 0, // Out of stock
          reserved: 20,
          damaged: 0,
        },
        {
          id: 'inv_3',
          organizationId: 'org_1',
          skuId: 'sku_3',
          warehouseId: 'wh_1',
          available: 50,
          reserved: 0,
        },
      ];

      const result = calculateInventorySummary(inventoryLevels);

      expect(result.totalItems).toBe(3);
      expect(result.totalAvailable).toBe(150);
      expect(result.totalReserved).toBe(30);
      expect(result.totalQuantity).toBe(180);
      expect(result.totalDamaged).toBe(5);
      expect(result.outOfStockCount).toBe(1);
    });

    it('should handle empty array', () => {
      const result = calculateInventorySummary([]);

      expect(result.totalItems).toBe(0);
      expect(result.totalAvailable).toBe(0);
      expect(result.totalReserved).toBe(0);
      expect(result.outOfStockCount).toBe(0);
    });
  });

  describe('validateAdjustmentInput', () => {
    it('should accept valid input', () => {
      const result = validateAdjustmentInput(10, 'Received shipment');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject zero delta', () => {
      const result = validateAdjustmentInput(0, 'Some reason');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Delta cannot be zero');
    });

    it('should reject empty reason', () => {
      const result = validateAdjustmentInput(10, '');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Reason is required');
    });

    it('should reject excessive delta', () => {
      const result = validateAdjustmentInput(MAX_INVENTORY_QUANTITY + 1, 'Reason');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(`Delta magnitude cannot exceed ${MAX_INVENTORY_QUANTITY}`);
    });

    it('should reject reason that is too long', () => {
      const longReason = 'a'.repeat(501);
      const result = validateAdjustmentInput(10, longReason);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Reason cannot exceed 500 characters');
    });
  });

  describe('Reservation Helpers', () => {
    const reservations: ReservationData[] = [
      {
        id: 'res_1',
        organizationId: 'org_1',
        orderId: 'order_1',
        skuId: 'sku_1',
        warehouseId: 'wh_1',
        quantityReserved: 10,
        releasedAt: null,
      },
      {
        id: 'res_2',
        organizationId: 'org_1',
        orderId: 'order_1',
        skuId: 'sku_2',
        warehouseId: 'wh_1',
        quantityReserved: 5,
        releasedAt: new Date(), // Released
      },
      {
        id: 'res_3',
        organizationId: 'org_1',
        orderId: 'order_1',
        skuId: 'sku_3',
        warehouseId: 'wh_1',
        quantityReserved: 15,
        releasedAt: null,
      },
    ];

    describe('hasActiveReservations', () => {
      it('should return true when active reservations exist', () => {
        expect(hasActiveReservations(reservations)).toBe(true);
      });

      it('should return false when no active reservations', () => {
        const allReleased = reservations.map((r) => ({
          ...r,
          releasedAt: new Date(),
        }));
        expect(hasActiveReservations(allReleased)).toBe(false);
      });
    });

    describe('getActiveReservations', () => {
      it('should filter to only active reservations', () => {
        const active = getActiveReservations(reservations);

        expect(active).toHaveLength(2);
        expect(active.every((r) => r.releasedAt === null)).toBe(true);
      });
    });

    describe('getTotalReservedQuantity', () => {
      it('should sum only active reservation quantities', () => {
        const total = getTotalReservedQuantity(reservations);

        expect(total).toBe(25); // 10 + 15, not including released
      });
    });
  });
});

describe('InMemoryInventoryRepository', () => {
  let repository: InMemoryInventoryRepository;

  beforeEach(() => {
    repository = new InMemoryInventoryRepository();
  });

  afterEach(() => {
    repository.clear();
  });

  describe('Inventory Level Operations', () => {
    it('should seed and find inventory level by SKU', async () => {
      repository.seedInventoryLevel({
        id: 'inv_1',
        organizationId: 'org_1',
        skuId: 'sku_1',
        warehouseId: 'wh_1',
        available: 100,
        reserved: 10,
      });

      const levels = await repository.findInventoryLevelsBySkuId('sku_1', 'org_1');

      expect(levels).toHaveLength(1);
      expect(levels[0].available).toBe(100);
    });

    it('should update inventory level', async () => {
      repository.seedInventoryLevel({
        id: 'inv_1',
        organizationId: 'org_1',
        skuId: 'sku_1',
        warehouseId: 'wh_1',
        available: 100,
        reserved: 10,
      });

      const updated = await repository.updateInventoryLevel('inv_1', {
        available: 80,
        reserved: 30,
      });

      expect(updated.available).toBe(80);
      expect(updated.reserved).toBe(30);
    });
  });

  describe('Reservation Operations', () => {
    it('should create and find reservations', async () => {
      const reservation = await repository.createReservation({
        organizationId: 'org_1',
        orderId: 'order_1',
        skuId: 'sku_1',
        warehouseId: 'wh_1',
        quantityReserved: 10,
      });

      expect(reservation.id).toBeDefined();
      expect(reservation.releasedAt).toBeNull();

      const found = await repository.findReservationsByOrderId('order_1');
      expect(found).toHaveLength(1);
    });

    it('should release reservation', async () => {
      await repository.createReservation({
        organizationId: 'org_1',
        orderId: 'order_1',
        skuId: 'sku_1',
        warehouseId: 'wh_1',
        quantityReserved: 10,
      });

      const reservations = await repository.findReservationsByOrderId('order_1');
      const released = await repository.releaseReservation(reservations[0].id);

      expect(released.releasedAt).not.toBeNull();
    });
  });

  describe('Order Operations', () => {
    it('should seed and find order', async () => {
      repository.seedOrder({
        id: 'order_1',
        organizationId: 'org_1',
        orderNumber: 'ORD-001',
        items: [
          { skuId: 'sku_1', quantity: 10, sku: { sku: 'TEST-001' } },
        ],
      });

      const order = await repository.findOrderById('order_1', 'org_1');

      expect(order).not.toBeNull();
      expect(order!.orderNumber).toBe('ORD-001');
      expect(order!.items).toHaveLength(1);
    });
  });
});
