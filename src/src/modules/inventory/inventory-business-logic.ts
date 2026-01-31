/**
 * Inventory Business Logic - Pure Functions
 * 
 * This module contains pure functions for inventory calculations that can be 
 * unit tested without database dependencies.
 * 
 * These functions implement the core business rules for Model C inventory:
 * - Reserve-on-order, deduct-on-ship
 * - No negative inventory
 * - Atomic operations
 * 
 * @packageDocumentation
 */

import { BadRequestException } from '@nestjs/common';

/**
 * Maximum allowed inventory quantity per SKU
 */
export const MAX_INVENTORY_QUANTITY = 1_000_000;

/**
 * Minimum reservation quantity
 */
export const MIN_RESERVATION_QUANTITY = 1;

/**
 * Represents an inventory level for a SKU at a warehouse
 */
export interface InventoryLevelData {
  id: string;
  organizationId: string;
  skuId: string;
  warehouseId: string;
  available: number;
  reserved: number;
  damaged?: number;
}

/**
 * Represents a reservation record
 */
export interface ReservationData {
  id: string;
  organizationId: string;
  orderId: string;
  skuId: string;
  warehouseId: string;
  quantityReserved: number;
  releasedAt: Date | null;
}

/**
 * Order item with quantity and SKU information
 */
export interface OrderItemData {
  skuId: string;
  quantity: number;
  sku: { sku: string };
}

/**
 * Result of a reservation calculation
 */
export interface ReservationCalculation {
  inventoryLevelId: string;
  warehouseId: string;
  skuId: string;
  quantityToReserve: number;
  newAvailable: number;
  newReserved: number;
}

/**
 * Result of a release calculation
 */
export interface ReleaseCalculation {
  inventoryLevelId: string;
  reservationId: string;
  quantityToRelease: number;
  newAvailable: number;
  newReserved: number;
}

/**
 * Result of an adjustment calculation
 */
export interface AdjustmentCalculation {
  inventoryLevelId: string;
  delta: number;
  newAvailable: number;
  isValid: boolean;
  errorMessage?: string;
}

/**
 * Calculate reservation for a single order item
 * 
 * Finds the appropriate inventory level and calculates the reservation.
 * This is a pure function that does not modify any state.
 * 
 * @param orderItem - Order item requiring inventory
 * @param inventoryLevels - Available inventory levels for the SKU
 * @returns Reservation calculation or throws if insufficient stock
 */
export function calculateReservation(
  orderItem: OrderItemData,
  inventoryLevels: InventoryLevelData[],
): ReservationCalculation {
  if (orderItem.quantity < MIN_RESERVATION_QUANTITY) {
    throw new BadRequestException(
      `Order item quantity must be at least ${MIN_RESERVATION_QUANTITY}`,
    );
  }

  if (!inventoryLevels || inventoryLevels.length === 0) {
    throw new BadRequestException(
      `Inventory not found for SKU: ${orderItem.sku.sku}`,
    );
  }

  // Find inventory level with sufficient available stock
  const inventoryLevel = inventoryLevels.find(
    (inv) => inv.available >= orderItem.quantity,
  );

  if (!inventoryLevel) {
    const totalAvailable = inventoryLevels.reduce(
      (sum, inv) => sum + inv.available,
      0,
    );
    throw new BadRequestException(
      `Insufficient stock for SKU ${orderItem.sku.sku}. ` +
      `Available: ${totalAvailable}, Required: ${orderItem.quantity}`,
    );
  }

  // Check max quantity limit
  const newReserved = inventoryLevel.reserved + orderItem.quantity;
  if (newReserved > MAX_INVENTORY_QUANTITY) {
    throw new BadRequestException(
      `Reserved quantity would exceed maximum of ${MAX_INVENTORY_QUANTITY} for SKU ${orderItem.sku.sku}`,
    );
  }

  // Calculate new values
  const newAvailable = inventoryLevel.available - orderItem.quantity;

  return {
    inventoryLevelId: inventoryLevel.id,
    warehouseId: inventoryLevel.warehouseId,
    skuId: orderItem.skuId,
    quantityToReserve: orderItem.quantity,
    newAvailable,
    newReserved,
  };
}

/**
 * Calculate reservations for multiple order items
 * 
 * Items are sorted by SKU ID to prevent deadlocks when acquiring locks.
 * 
 * @param orderItems - Order items requiring inventory
 * @param getInventoryLevels - Function to get inventory levels for a SKU
 * @returns Array of reservation calculations
 */
export async function calculateReservationsForOrder(
  orderItems: OrderItemData[],
  getInventoryLevels: (skuId: string) => Promise<InventoryLevelData[]>,
): Promise<ReservationCalculation[]> {
  // Sort by SKU ID to prevent deadlocks
  const sortedItems = [...orderItems].sort((a, b) =>
    a.skuId.localeCompare(b.skuId),
  );

  const calculations: ReservationCalculation[] = [];

  for (const orderItem of sortedItems) {
    const inventoryLevels = await getInventoryLevels(orderItem.skuId);
    const calculation = calculateReservation(orderItem, inventoryLevels);
    calculations.push(calculation);
  }

  return calculations;
}

/**
 * Calculate release for a single reservation
 * 
 * @param reservation - Reservation to release
 * @param inventoryLevel - Current inventory level
 * @returns Release calculation
 */
export function calculateRelease(
  reservation: ReservationData,
  inventoryLevel: InventoryLevelData,
): ReleaseCalculation {
  if (reservation.releasedAt !== null) {
    throw new BadRequestException(
      `Reservation ${reservation.id} has already been released`,
    );
  }

  const newAvailable = inventoryLevel.available + reservation.quantityReserved;
  const newReserved = Math.max(0, inventoryLevel.reserved - reservation.quantityReserved);

  return {
    inventoryLevelId: inventoryLevel.id,
    reservationId: reservation.id,
    quantityToRelease: reservation.quantityReserved,
    newAvailable,
    newReserved,
  };
}

/**
 * Calculate inventory adjustment
 * 
 * Validates that the adjustment won't result in negative inventory.
 * 
 * @param inventoryLevel - Current inventory level
 * @param delta - Adjustment amount (positive or negative)
 * @returns Adjustment calculation with validation result
 */
export function calculateAdjustment(
  inventoryLevel: InventoryLevelData,
  delta: number,
): AdjustmentCalculation {
  const newAvailable = inventoryLevel.available + delta;

  if (newAvailable < 0) {
    return {
      inventoryLevelId: inventoryLevel.id,
      delta,
      newAvailable,
      isValid: false,
      errorMessage: `Adjustment would result in negative available quantity. Available: ${inventoryLevel.available}, Delta: ${delta}`,
    };
  }

  if (newAvailable > MAX_INVENTORY_QUANTITY) {
    return {
      inventoryLevelId: inventoryLevel.id,
      delta,
      newAvailable,
      isValid: false,
      errorMessage: `Adjustment would exceed maximum quantity of ${MAX_INVENTORY_QUANTITY}`,
    };
  }

  return {
    inventoryLevelId: inventoryLevel.id,
    delta,
    newAvailable,
    isValid: true,
  };
}

/**
 * Validate stock level for a SKU
 * 
 * @param inventoryLevel - Inventory level to validate
 * @param requiredQuantity - Quantity needed
 * @returns Validation result
 */
export function validateStockLevel(
  inventoryLevel: InventoryLevelData | null,
  requiredQuantity: number,
): { isValid: boolean; available: number; message?: string } {
  if (!inventoryLevel) {
    return {
      isValid: false,
      available: 0,
      message: 'Inventory level not found',
    };
  }

  if (inventoryLevel.available < requiredQuantity) {
    return {
      isValid: false,
      available: inventoryLevel.available,
      message: `Insufficient stock. Available: ${inventoryLevel.available}, Required: ${requiredQuantity}`,
    };
  }

  return {
    isValid: true,
    available: inventoryLevel.available,
  };
}

/**
 * Calculate inventory summary from array of inventory levels
 * 
 * @param inventoryLevels - Array of inventory levels
 * @returns Summary statistics
 */
export function calculateInventorySummary(
  inventoryLevels: InventoryLevelData[],
): {
  totalItems: number;
  totalQuantity: number;
  totalReserved: number;
  totalAvailable: number;
  totalDamaged: number;
  outOfStockCount: number;
} {
  const totalItems = inventoryLevels.length;
  const totalAvailable = inventoryLevels.reduce((sum, item) => sum + item.available, 0);
  const totalReserved = inventoryLevels.reduce((sum, item) => sum + item.reserved, 0);
  const totalDamaged = inventoryLevels.reduce((sum, item) => sum + (item.damaged || 0), 0);
  const outOfStockCount = inventoryLevels.filter((item) => item.available === 0).length;

  return {
    totalItems,
    totalQuantity: totalAvailable + totalReserved,
    totalReserved,
    totalAvailable,
    totalDamaged,
    outOfStockCount,
  };
}

/**
 * Validate inventory adjustment DTO
 * 
 * @param delta - Adjustment amount
 * @param reason - Reason for adjustment
 * @returns Validation result
 */
export function validateAdjustmentInput(
  delta: number,
  reason: string,
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (delta === 0) {
    errors.push('Delta cannot be zero');
  }

  if (!Number.isInteger(delta)) {
    errors.push('Delta must be an integer');
  }

  if (Math.abs(delta) > MAX_INVENTORY_QUANTITY) {
    errors.push(`Delta magnitude cannot exceed ${MAX_INVENTORY_QUANTITY}`);
  }

  if (!reason || reason.trim().length === 0) {
    errors.push('Reason is required');
  }

  if (reason && reason.length > 500) {
    errors.push('Reason cannot exceed 500 characters');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Check if reservations exist for an order
 * 
 * @param reservations - Array of reservations
 * @returns Whether active reservations exist
 */
export function hasActiveReservations(reservations: ReservationData[]): boolean {
  return reservations.some((r) => r.releasedAt === null);
}

/**
 * Filter active (unreleased) reservations
 * 
 * @param reservations - Array of reservations
 * @returns Active reservations only
 */
export function getActiveReservations(reservations: ReservationData[]): ReservationData[] {
  return reservations.filter((r) => r.releasedAt === null);
}

/**
 * Calculate total reserved quantity across reservations
 * 
 * @param reservations - Array of reservations
 * @returns Total reserved quantity
 */
export function getTotalReservedQuantity(reservations: ReservationData[]): number {
  return getActiveReservations(reservations).reduce(
    (sum, r) => sum + r.quantityReserved,
    0,
  );
}
