/**
 * Inventory Repository Interface
 * 
 * Defines the contract for inventory data access operations.
 * This allows for dependency injection and enables in-memory implementations for testing.
 * 
 * @packageDocumentation
 */

import { 
  InventoryLevelData, 
  ReservationData, 
  OrderItemData 
} from './inventory-business-logic';

/**
 * Order data for inventory operations
 */
export interface OrderData {
  id: string;
  organizationId: string;
  orderNumber: string;
  items: OrderItemData[];
}

/**
 * Inventory adjustment data
 */
export interface AdjustmentData {
  organizationId: string;
  skuId: string;
  warehouseId: string;
  quantityDelta: number;
  reason: string;
  referenceId?: string;
  notes?: string;
  createdBy: string;
}

/**
 * Repository interface for inventory operations
 * 
 * Implementations can be:
 * - PrismaInventoryRepository: Real database implementation
 * - InMemoryInventoryRepository: For unit testing
 */
export interface IInventoryRepository {
  /**
   * Find inventory levels for a SKU within an organization
   */
  findInventoryLevelsBySkuId(
    skuId: string,
    organizationId: string,
  ): Promise<InventoryLevelData[]>;

  /**
   * Find inventory level by ID
   */
  findInventoryLevelById(
    id: string,
    organizationId: string,
  ): Promise<InventoryLevelData | null>;

  /**
   * Find inventory level by SKU and warehouse
   */
  findInventoryLevelBySkuAndWarehouse(
    skuId: string,
    warehouseId: string,
  ): Promise<InventoryLevelData | null>;

  /**
   * Update inventory level
   */
  updateInventoryLevel(
    id: string,
    data: { available?: number; reserved?: number; damaged?: number },
  ): Promise<InventoryLevelData>;

  /**
   * Create reservation
   */
  createReservation(data: {
    organizationId: string;
    orderId: string;
    skuId: string;
    warehouseId: string;
    quantityReserved: number;
  }): Promise<ReservationData>;

  /**
   * Find reservations for order
   */
  findReservationsByOrderId(orderId: string): Promise<ReservationData[]>;

  /**
   * Release reservation
   */
  releaseReservation(id: string): Promise<ReservationData>;

  /**
   * Create adjustment record
   */
  createAdjustment(data: AdjustmentData): Promise<void>;

  /**
   * Find order by ID with items
   */
  findOrderById(
    orderId: string,
    organizationId: string,
  ): Promise<OrderData | null>;

  /**
   * Get all inventory levels for organization
   */
  findAllInventoryLevels(
    organizationId: string,
    filters?: {
      search?: string;
      outOfStock?: boolean;
      page?: number;
      limit?: number;
    },
  ): Promise<{ data: InventoryLevelData[]; total: number }>;
}

/**
 * In-Memory Inventory Repository for Testing
 * 
 * This implementation stores data in memory and is suitable for unit tests.
 * It provides full control over the test data without database dependencies.
 */
export class InMemoryInventoryRepository implements IInventoryRepository {
  private inventoryLevels: Map<string, InventoryLevelData> = new Map();
  private reservations: Map<string, ReservationData> = new Map();
  private orders: Map<string, OrderData> = new Map();
  private reservationIdCounter = 0;

  /**
   * Seed inventory levels for testing
   */
  seedInventoryLevel(data: InventoryLevelData): void {
    this.inventoryLevels.set(data.id, { ...data });
  }

  /**
   * Seed order for testing
   */
  seedOrder(data: OrderData): void {
    this.orders.set(data.id, { ...data });
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.inventoryLevels.clear();
    this.reservations.clear();
    this.orders.clear();
    this.reservationIdCounter = 0;
  }

  async findInventoryLevelsBySkuId(
    skuId: string,
    organizationId: string,
  ): Promise<InventoryLevelData[]> {
    const results: InventoryLevelData[] = [];
    this.inventoryLevels.forEach((level) => {
      if (level.skuId === skuId && level.organizationId === organizationId) {
        results.push({ ...level });
      }
    });
    return results;
  }

  async findInventoryLevelById(
    id: string,
    organizationId: string,
  ): Promise<InventoryLevelData | null> {
    const level = this.inventoryLevels.get(id);
    if (level && level.organizationId === organizationId) {
      return { ...level };
    }
    return null;
  }

  async findInventoryLevelBySkuAndWarehouse(
    skuId: string,
    warehouseId: string,
  ): Promise<InventoryLevelData | null> {
    for (const level of this.inventoryLevels.values()) {
      if (level.skuId === skuId && level.warehouseId === warehouseId) {
        return { ...level };
      }
    }
    return null;
  }

  async updateInventoryLevel(
    id: string,
    data: { available?: number; reserved?: number; damaged?: number },
  ): Promise<InventoryLevelData> {
    const level = this.inventoryLevels.get(id);
    if (!level) {
      throw new Error(`Inventory level not found: ${id}`);
    }

    const updated = {
      ...level,
      available: data.available ?? level.available,
      reserved: data.reserved ?? level.reserved,
      damaged: data.damaged ?? level.damaged,
    };

    this.inventoryLevels.set(id, updated);
    return { ...updated };
  }

  async createReservation(data: {
    organizationId: string;
    orderId: string;
    skuId: string;
    warehouseId: string;
    quantityReserved: number;
  }): Promise<ReservationData> {
    const id = `res_${++this.reservationIdCounter}`;
    const reservation: ReservationData = {
      id,
      organizationId: data.organizationId,
      orderId: data.orderId,
      skuId: data.skuId,
      warehouseId: data.warehouseId,
      quantityReserved: data.quantityReserved,
      releasedAt: null,
    };

    this.reservations.set(id, reservation);
    return { ...reservation };
  }

  async findReservationsByOrderId(orderId: string): Promise<ReservationData[]> {
    const results: ReservationData[] = [];
    this.reservations.forEach((reservation) => {
      if (reservation.orderId === orderId) {
        results.push({ ...reservation });
      }
    });
    return results;
  }

  async releaseReservation(id: string): Promise<ReservationData> {
    const reservation = this.reservations.get(id);
    if (!reservation) {
      throw new Error(`Reservation not found: ${id}`);
    }

    const updated = {
      ...reservation,
      releasedAt: new Date(),
    };

    this.reservations.set(id, updated);
    return { ...updated };
  }

  async createAdjustment(data: AdjustmentData): Promise<void> {
    // In-memory implementation doesn't persist adjustments
    // They could be tracked if needed for testing
  }

  async findOrderById(
    orderId: string,
    organizationId: string,
  ): Promise<OrderData | null> {
    const order = this.orders.get(orderId);
    if (order && order.organizationId === organizationId) {
      return { ...order };
    }
    return null;
  }

  async findAllInventoryLevels(
    organizationId: string,
    filters?: {
      search?: string;
      outOfStock?: boolean;
      page?: number;
      limit?: number;
    },
  ): Promise<{ data: InventoryLevelData[]; total: number }> {
    let results: InventoryLevelData[] = [];

    this.inventoryLevels.forEach((level) => {
      if (level.organizationId === organizationId) {
        results.push({ ...level });
      }
    });

    // Apply filters
    if (filters?.outOfStock) {
      results = results.filter((level) => level.available === 0);
    }

    // Pagination
    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 20;
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedData = results.slice(start, end);

    return {
      data: paginatedData,
      total: results.length,
    };
  }

  /**
   * Get all reservations (for testing)
   */
  getAllReservations(): ReservationData[] {
    return Array.from(this.reservations.values()).map((r) => ({ ...r }));
  }

  /**
   * Get all inventory levels (for testing)
   */
  getAllInventoryLevels(): InventoryLevelData[] {
    return Array.from(this.inventoryLevels.values()).map((l) => ({ ...l }));
  }
}
