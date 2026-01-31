import { Test, TestingModule } from '@nestjs/testing';
import { InventoryService } from './inventory.service';
import { PrismaService } from '@common/database/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('InventoryService - Model C Implementation', () => {
  let service: InventoryService;
  let prisma: PrismaService;

  // Mock data
  const mockOrgId = 'org-123';
  const mockUserId = 'user-123';
  const mockOrderId = 'order-123';
  const mockSkuId = 'sku-123';
  const mockInventoryItemId = 'inv-123';

  const mockSku = {
    id: mockSkuId,
    sku: 'LAPTOP-HP-15',
    name: 'HP Laptop 15-inch',
    productId: 'prod-123',
  };

  const mockInventoryItem = {
    id: mockInventoryItemId,
    organizationId: mockOrgId,
    skuId: mockSkuId,
    quantityTotal: 100,
    quantityAvailable: 80,
    quantityReserved: 20,
    reorderPoint: 10,
    sku: mockSku,
  };

  // DB-01: Updated mock data for InventoryLevel schema
  const mockWarehouseId = 'warehouse-123';

  const mockInventoryLevel = {
    id: mockInventoryItemId,
    organization_id: mockOrgId,
    sku_id: mockSkuId,
    warehouse_id: mockWarehouseId,
    available: 80,
    reserved: 20,
    damaged: 0,
  };

  const mockOrder = {
    id: mockOrderId,
    organizationId: mockOrgId,
    orderNumber: 'ORD-001',
    createdById: mockUserId,
    updatedById: mockUserId,
    items: [
      {
        id: 'item-123',
        skuId: mockSkuId,
        quantity: 5,
        sku: mockSku,
      },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        {
          provide: PrismaService,
          useValue: {
            order: {
              findFirst: jest.fn(),
            },
            inventoryItem: {
              findFirst: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
            },
            inventoryLevel: {
              update: jest.fn(),
            },
            inventoryReservation: {
              create: jest.fn(),
              update: jest.fn(),
              findMany: jest.fn(),
            },
            inventoryAdjustment: {
              create: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('reserveStockForOrder - DB-01 Row Level Locking', () => {
    it('should successfully reserve stock using row-level lock', async () => {
      const mockReservation = {
        id: 'res-123',
        organizationId: mockOrgId,
        orderId: mockOrderId,
        skuId: mockSkuId,
        warehouseId: mockWarehouseId,
        quantityReserved: 5,
        createdAt: new Date(),
        releasedAt: null,
      };

      jest.spyOn(prisma.order, 'findFirst').mockResolvedValue(mockOrder as any);
      jest.spyOn(prisma.inventoryReservation, 'findMany').mockResolvedValue([]);

      let queryRawCalled = false;
      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        const tx = {
          $queryRaw: jest.fn().mockImplementation(() => {
            queryRawCalled = true;
            return Promise.resolve([mockInventoryLevel]);
          }),
          inventoryLevel: {
            update: jest.fn().mockResolvedValue(mockInventoryLevel),
          },
          inventoryReservation: {
            create: jest.fn().mockResolvedValue(mockReservation),
          },
          inventoryAdjustment: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(tx);
      });

      const result = await service.reserveStockForOrder(mockOrderId, mockOrgId);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        orderId: mockOrderId,
        quantityReserved: 5,
      });
      // DB-01: Verify row-level lock query was executed
      expect(queryRawCalled).toBe(true);
    });

    it('should use SELECT FOR UPDATE for row-level locking', async () => {
      jest.spyOn(prisma.order, 'findFirst').mockResolvedValue(mockOrder as any);
      jest.spyOn(prisma.inventoryReservation, 'findMany').mockResolvedValue([]);

      let capturedQuery = '';
      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        const tx = {
          $queryRaw: jest.fn().mockImplementation((query: any) => {
            // Capture the template literal query
            if (query && query.strings) {
              capturedQuery = query.strings.join('');
            }
            return Promise.resolve([mockInventoryLevel]);
          }),
          inventoryLevel: {
            update: jest.fn().mockResolvedValue(mockInventoryLevel),
          },
          inventoryReservation: {
            create: jest.fn().mockResolvedValue({}),
          },
          inventoryAdjustment: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(tx);
      });

      await service.reserveStockForOrder(mockOrderId, mockOrgId);

      // DB-01: Verify FOR UPDATE clause is present in the query
      expect(capturedQuery.toLowerCase()).toContain('for update');
    });

    it('should skip reservation if order already has active reservations (idempotency)', async () => {
      const existingReservations = [{
        id: 'res-existing',
        orderId: mockOrderId,
        releasedAt: null,
      }];

      jest.spyOn(prisma.order, 'findFirst').mockResolvedValue(mockOrder as any);
      jest.spyOn(prisma.inventoryReservation, 'findMany').mockResolvedValue(existingReservations as any);

      const result = await service.reserveStockForOrder(mockOrderId, mockOrgId);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('res-existing');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if order not found', async () => {
      jest.spyOn(prisma.order, 'findFirst').mockResolvedValue(null);

      await expect(
        service.reserveStockForOrder(mockOrderId, mockOrgId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if insufficient stock', async () => {
      const lowStockInventory = {
        ...mockInventoryLevel,
        available: 2, // Less than order quantity (5)
      };

      jest.spyOn(prisma.order, 'findFirst').mockResolvedValue(mockOrder as any);
      jest.spyOn(prisma.inventoryReservation, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        const tx = {
          $queryRaw: jest.fn().mockResolvedValue([lowStockInventory]),
        };
        return callback(tx);
      });

      await expect(
        service.reserveStockForOrder(mockOrderId, mockOrgId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if inventory not found for SKU', async () => {
      jest.spyOn(prisma.order, 'findFirst').mockResolvedValue(mockOrder as any);
      jest.spyOn(prisma.inventoryReservation, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        const tx = {
          $queryRaw: jest.fn().mockResolvedValue([]), // No inventory found
        };
        return callback(tx);
      });

      await expect(
        service.reserveStockForOrder(mockOrderId, mockOrgId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should rollback transaction on error (partial reservation)', async () => {
      const orderWithMultipleItems = {
        ...mockOrder,
        items: [
          { id: 'item-1', skuId: 'sku-1', quantity: 5, sku: { ...mockSku, sku: 'SKU-1' } },
          { id: 'item-2', skuId: 'sku-2', quantity: 10, sku: { ...mockSku, sku: 'SKU-2' } },
        ],
      };

      jest.spyOn(prisma.order, 'findFirst').mockResolvedValue(orderWithMultipleItems as any);
      jest.spyOn(prisma.inventoryReservation, 'findMany').mockResolvedValue([]);

      let callCount = 0;
      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        const tx = {
          $queryRaw: jest.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
              // First SKU has stock
              return Promise.resolve([{ ...mockInventoryLevel, sku_id: 'sku-1' }]);
            } else {
              // Second SKU has insufficient stock
              return Promise.resolve([{ ...mockInventoryLevel, sku_id: 'sku-2', available: 0 }]);
            }
          }),
          inventoryLevel: {
            update: jest.fn().mockResolvedValue(mockInventoryLevel),
          },
          inventoryReservation: {
            create: jest.fn().mockResolvedValue({}),
          },
          inventoryAdjustment: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(tx);
      });

      // Transaction should roll back due to insufficient stock on second item
      await expect(
        service.reserveStockForOrder(mockOrderId, mockOrgId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should configure 30-second transaction timeout', async () => {
      jest.spyOn(prisma.order, 'findFirst').mockResolvedValue(mockOrder as any);
      jest.spyOn(prisma.inventoryReservation, 'findMany').mockResolvedValue([]);

      let transactionOptions: any = null;
      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any, options?: any) => {
        transactionOptions = options;
        const tx = {
          $queryRaw: jest.fn().mockResolvedValue([mockInventoryLevel]),
          inventoryLevel: {
            update: jest.fn().mockResolvedValue(mockInventoryLevel),
          },
          inventoryReservation: {
            create: jest.fn().mockResolvedValue({}),
          },
          inventoryAdjustment: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(tx);
      });

      await service.reserveStockForOrder(mockOrderId, mockOrgId);

      // DB-01: Verify 30-second timeout is configured
      expect(transactionOptions.timeout).toBe(30000);
    });
  });

  describe('releaseStockForOrder', () => {
    it('should successfully release stock for cancelled order', async () => {
      const mockReservation = {
        id: 'res-123',
        inventoryItemId: mockInventoryItemId,
        orderId: mockOrderId,
        quantityReserved: 5,
        reservedAt: new Date(),
        releasedAt: null,
        inventoryItem: mockInventoryItem,
      };

      const orderWithReservations = {
        ...mockOrder,
        items: [
          {
            ...mockOrder.items[0],
            reservations: [mockReservation],
          },
        ],
      };

      jest.spyOn(prisma.order, 'findFirst').mockResolvedValue(orderWithReservations as any);
      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        const tx = {
          inventoryReservation: {
            update: jest.fn().mockResolvedValue({
              ...mockReservation,
              releasedAt: new Date(),
              reason: 'cancelled',
            }),
          },
          inventoryItem: {
            update: jest.fn().mockResolvedValue(mockInventoryItem),
          },
          inventoryAdjustment: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(tx);
      });

      const result = await service.releaseStockForOrder(
        mockOrderId,
        mockOrgId,
        'cancelled',
      );

      expect(result).toHaveLength(1);
      expect(result[0].reason).toBe('cancelled');
      expect(result[0].releasedAt).toBeTruthy();
    });

    it('should skip release if no active reservations (idempotency)', async () => {
      const orderWithoutReservations = {
        ...mockOrder,
        items: [
          {
            ...mockOrder.items[0],
            reservations: [], // No active reservations
          },
        ],
      };

      jest.spyOn(prisma.order, 'findFirst').mockResolvedValue(orderWithoutReservations as any);

      const result = await service.releaseStockForOrder(
        mockOrderId,
        mockOrgId,
        'cancelled',
      );

      expect(result).toHaveLength(0);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if order not found', async () => {
      jest.spyOn(prisma.order, 'findFirst').mockResolvedValue(null);

      await expect(
        service.releaseStockForOrder(mockOrderId, mockOrgId, 'cancelled'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('adjustStock', () => {
    it('should successfully increase stock quantity', async () => {
      const updatedItem = {
        ...mockInventoryItem,
        quantityTotal: 110, // 100 + 10
        quantityAvailable: 90, // 110 - 20
      };

      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        const tx = {
          inventoryItem: {
            findFirst: jest.fn().mockResolvedValue(mockInventoryItem),
            update: jest.fn().mockResolvedValue(updatedItem),
          },
          inventoryAdjustment: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(tx);
      });

      const result = await service.adjustStock(
        mockSkuId,
        10, // Increase by 10
        'Stock received',
        mockUserId,
        mockOrgId,
        'PURCHASE',
      );

      expect(result.quantityTotal).toBe(110);
      expect(result.quantityAvailable).toBe(90);
    });

    it('should successfully decrease stock quantity', async () => {
      const updatedItem = {
        ...mockInventoryItem,
        quantityTotal: 95, // 100 - 5
        quantityAvailable: 75, // 95 - 20
      };

      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        const tx = {
          inventoryItem: {
            findFirst: jest.fn().mockResolvedValue(mockInventoryItem),
            update: jest.fn().mockResolvedValue(updatedItem),
          },
          inventoryAdjustment: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(tx);
      });

      const result = await service.adjustStock(
        mockSkuId,
        -5, // Decrease by 5
        'Damaged goods',
        mockUserId,
        mockOrgId,
        'DAMAGE',
      );

      expect(result.quantityTotal).toBe(95);
      expect(result.quantityAvailable).toBe(75);
    });

    it('should throw BadRequestException if adjustment would result in negative total', async () => {
      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        const tx = {
          inventoryItem: {
            findFirst: jest.fn().mockResolvedValue(mockInventoryItem),
          },
        };
        return callback(tx);
      });

      await expect(
        service.adjustStock(
          mockSkuId,
          -150, // Decrease by more than available
          'Test',
          mockUserId,
          mockOrgId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if adjustment would go below reserved quantity', async () => {
      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        const tx = {
          inventoryItem: {
            findFirst: jest.fn().mockResolvedValue(mockInventoryItem),
          },
        };
        return callback(tx);
      });

      await expect(
        service.adjustStock(
          mockSkuId,
          -85, // Would result in total=15, but reserved=20
          'Test',
          mockUserId,
          mockOrgId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if inventory item not found', async () => {
      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        const tx = {
          inventoryItem: {
            findFirst: jest.fn().mockResolvedValue(null),
          },
        };
        return callback(tx);
      });

      await expect(
        service.adjustStock(
          mockSkuId,
          10,
          'Test',
          mockUserId,
          mockOrgId,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findBySkuId', () => {
    it('should return inventory item with details', async () => {
      const itemWithDetails = {
        ...mockInventoryItem,
        reservations: [],
        adjustments: [],
      };

      jest.spyOn(prisma.inventoryItem, 'findFirst').mockResolvedValue(itemWithDetails as any);

      const result = await service.findBySkuId(mockSkuId, mockOrgId);

      expect(result.id).toBe(mockInventoryItemId);
      expect(result.sku).toBeDefined();
    });

    it('should throw NotFoundException if not found', async () => {
      jest.spyOn(prisma.inventoryItem, 'findFirst').mockResolvedValue(null);

      await expect(
        service.findBySkuId(mockSkuId, mockOrgId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getLowStockItems', () => {
    it('should return items with quantity at or below reorder point', async () => {
      const items = [
        { ...mockInventoryItem, quantityAvailable: 5, reorderPoint: 10 }, // Low stock
        { ...mockInventoryItem, quantityAvailable: 20, reorderPoint: 10 }, // OK
        { ...mockInventoryItem, quantityAvailable: 0, reorderPoint: 5 }, // Out of stock
      ];

      jest.spyOn(prisma.inventoryItem, 'findMany').mockResolvedValue(items as any);

      const result = await service.getLowStockItems(mockOrgId);

      expect(result).toHaveLength(2); // Two items below reorder point
    });
  });

  describe('getInventorySummary', () => {
    it('should return correct inventory statistics', async () => {
      const items = [
        { ...mockInventoryItem, quantityTotal: 100, quantityReserved: 20, quantityAvailable: 80, reorderPoint: 10 },
        { ...mockInventoryItem, quantityTotal: 50, quantityReserved: 10, quantityAvailable: 40, reorderPoint: 50 }, // Low stock
        { ...mockInventoryItem, quantityTotal: 0, quantityReserved: 0, quantityAvailable: 0, reorderPoint: 10 }, // Out of stock
      ];

      jest.spyOn(prisma.inventoryItem, 'findMany').mockResolvedValue(items as any);

      const result = await service.getInventorySummary(mockOrgId);

      expect(result.totalItems).toBe(3);
      expect(result.totalQuantity).toBe(150);
      expect(result.totalReserved).toBe(30);
      expect(result.totalAvailable).toBe(120);
      expect(result.lowStockCount).toBe(2); // Items at or below reorder point
      expect(result.outOfStockCount).toBe(1);
    });
  });
});
