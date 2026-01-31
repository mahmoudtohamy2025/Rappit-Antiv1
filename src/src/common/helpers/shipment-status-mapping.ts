/**
 * Shipment Status Mapping Helper
 * 
 * Maps carrier-specific tracking status codes to internal ShipmentStatus enum.
 * Supports multiple carriers: FedEx, DHL, etc.
 */

import { ShipmentStatus, ShippingCarrier } from '@prisma/client';
import { mapFedExStatusToInternal, isFedExStatusTerminal } from '@integrations/shipping/fedex.constants';

/**
 * Map carrier-specific status code to internal ShipmentStatus
 * 
 * @param carrierType - Shipping carrier (DHL, FEDEX)
 * @param carrierStatus - Carrier's status code
 * @returns Internal ShipmentStatus enum value
 */
export function mapCarrierStatusToInternal(
  carrierType: ShippingCarrier,
  carrierStatus: string,
): ShipmentStatus {
  switch (carrierType) {
    case 'FEDEX':
      return mapFedExStatusToInternal(carrierStatus);
    
    case 'DHL':
      return mapDHLStatusToInternal(carrierStatus);
    
    default:
      // Default to IN_TRANSIT for unknown carriers
      return ShipmentStatus.IN_TRANSIT;
  }
}

/**
 * Terminal statuses - no further updates expected
 */
const TERMINAL_STATUSES = [
  ShipmentStatus.DELIVERED,
  ShipmentStatus.CANCELLED,
  ShipmentStatus.RETURNED,
];

/**
 * Check if status is terminal (no further updates expected)
 * 
 * @param status - Internal ShipmentStatus
 * @returns True if status is terminal
 */
export function isTerminalStatus(status: ShipmentStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/**
 * Check if carrier status is terminal
 * 
 * @param carrierType - Shipping carrier
 * @param carrierStatus - Carrier's status code
 * @returns True if status is terminal
 */
export function isCarrierStatusTerminal(
  carrierType: ShippingCarrier,
  carrierStatus: string,
): boolean {
  switch (carrierType) {
    case 'FEDEX':
      return isFedExStatusTerminal(carrierStatus);
    
    case 'DHL':
      return isDHLStatusTerminal(carrierStatus);
    
    default:
      return false;
  }
}

// ============================================================================
// DHL Status Mappings
// ============================================================================

/**
 * Map DHL tracking status codes to internal ShipmentStatus
 * 
 * DHL Status Codes:
 * - pre-transit: Label created, not yet picked up
 * - transit: In transit
 * - out-for-delivery: Out for delivery
 * - delivered: Delivered
 * - failure: Delivery failed / exception
 * - returned: Returned to sender
 */
const DHL_STATUS_MAPPING: Record<string, ShipmentStatus> = {
  'pre-transit': ShipmentStatus.LABEL_CREATED,
  'transit': ShipmentStatus.IN_TRANSIT,
  'out-for-delivery': ShipmentStatus.OUT_FOR_DELIVERY,
  'delivered': ShipmentStatus.DELIVERED,
  'failure': ShipmentStatus.EXCEPTION,
  'returned': ShipmentStatus.RETURNED,
  'cancelled': ShipmentStatus.CANCELLED,
  
  // Alternative DHL codes
  'picked_up': ShipmentStatus.IN_TRANSIT,
  'in_transit': ShipmentStatus.IN_TRANSIT,
  'out_for_delivery': ShipmentStatus.OUT_FOR_DELIVERY,
  'exception': ShipmentStatus.EXCEPTION,
};

function mapDHLStatusToInternal(dhlStatus: string): ShipmentStatus {
  return DHL_STATUS_MAPPING[dhlStatus] || ShipmentStatus.IN_TRANSIT;
}

function isDHLStatusTerminal(dhlStatus: string): boolean {
  const status = DHL_STATUS_MAPPING[dhlStatus];
  return isTerminalStatus(status);
}
