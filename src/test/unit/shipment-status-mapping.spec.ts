/**
 * Shipment Status Mapping Helper - Unit Tests
 * 
 * Tests for the shipment status mapping helper functions.
 * These are pure functions with deterministic behavior.
 */

import {
  mapCarrierStatusToInternal,
  isTerminalStatus,
  isCarrierStatusTerminal,
} from '../../src/common/helpers/shipment-status-mapping';
import { ShipmentStatus, ShippingCarrier } from '@prisma/client';

describe('Shipment Status Mapping Helper - Pure Functions', () => {
  describe('mapCarrierStatusToInternal', () => {
    describe('FedEx status mapping', () => {
      it('should map PU (Picked up) to IN_TRANSIT', () => {
        expect(mapCarrierStatusToInternal('FEDEX', 'PU')).toBe(ShipmentStatus.IN_TRANSIT);
      });

      it('should map IT (In transit) to IN_TRANSIT', () => {
        expect(mapCarrierStatusToInternal('FEDEX', 'IT')).toBe(ShipmentStatus.IN_TRANSIT);
      });

      it('should map AR (Arrived) to IN_TRANSIT', () => {
        expect(mapCarrierStatusToInternal('FEDEX', 'AR')).toBe(ShipmentStatus.IN_TRANSIT);
      });

      it('should map DP (Departed) to IN_TRANSIT', () => {
        expect(mapCarrierStatusToInternal('FEDEX', 'DP')).toBe(ShipmentStatus.IN_TRANSIT);
      });

      it('should map OD (Out for delivery) to OUT_FOR_DELIVERY', () => {
        expect(mapCarrierStatusToInternal('FEDEX', 'OD')).toBe(ShipmentStatus.OUT_FOR_DELIVERY);
      });

      it('should map DL (Delivered) to DELIVERED', () => {
        expect(mapCarrierStatusToInternal('FEDEX', 'DL')).toBe(ShipmentStatus.DELIVERED);
      });

      it('should map DE (Delivery exception) to EXCEPTION', () => {
        expect(mapCarrierStatusToInternal('FEDEX', 'DE')).toBe(ShipmentStatus.EXCEPTION);
      });

      it('should map PX (Pickup exception) to EXCEPTION', () => {
        expect(mapCarrierStatusToInternal('FEDEX', 'PX')).toBe(ShipmentStatus.EXCEPTION);
      });

      it('should map CA (Cancelled) to CANCELLED', () => {
        expect(mapCarrierStatusToInternal('FEDEX', 'CA')).toBe(ShipmentStatus.CANCELLED);
      });

      it('should map RS (Returned) to RETURNED', () => {
        expect(mapCarrierStatusToInternal('FEDEX', 'RS')).toBe(ShipmentStatus.RETURNED);
      });

      it('should return IN_TRANSIT for unknown FedEx status', () => {
        expect(mapCarrierStatusToInternal('FEDEX', 'UNKNOWN')).toBe(ShipmentStatus.IN_TRANSIT);
      });
    });

    describe('DHL status mapping', () => {
      it('should map pre-transit to LABEL_CREATED', () => {
        expect(mapCarrierStatusToInternal('DHL', 'pre-transit')).toBe(ShipmentStatus.LABEL_CREATED);
      });

      it('should map transit to IN_TRANSIT', () => {
        expect(mapCarrierStatusToInternal('DHL', 'transit')).toBe(ShipmentStatus.IN_TRANSIT);
      });

      it('should map in_transit to IN_TRANSIT', () => {
        expect(mapCarrierStatusToInternal('DHL', 'in_transit')).toBe(ShipmentStatus.IN_TRANSIT);
      });

      it('should map picked_up to IN_TRANSIT', () => {
        expect(mapCarrierStatusToInternal('DHL', 'picked_up')).toBe(ShipmentStatus.IN_TRANSIT);
      });

      it('should map out-for-delivery to OUT_FOR_DELIVERY', () => {
        expect(mapCarrierStatusToInternal('DHL', 'out-for-delivery')).toBe(ShipmentStatus.OUT_FOR_DELIVERY);
      });

      it('should map out_for_delivery to OUT_FOR_DELIVERY', () => {
        expect(mapCarrierStatusToInternal('DHL', 'out_for_delivery')).toBe(ShipmentStatus.OUT_FOR_DELIVERY);
      });

      it('should map delivered to DELIVERED', () => {
        expect(mapCarrierStatusToInternal('DHL', 'delivered')).toBe(ShipmentStatus.DELIVERED);
      });

      it('should map failure to EXCEPTION', () => {
        expect(mapCarrierStatusToInternal('DHL', 'failure')).toBe(ShipmentStatus.EXCEPTION);
      });

      it('should map exception to EXCEPTION', () => {
        expect(mapCarrierStatusToInternal('DHL', 'exception')).toBe(ShipmentStatus.EXCEPTION);
      });

      it('should map returned to RETURNED', () => {
        expect(mapCarrierStatusToInternal('DHL', 'returned')).toBe(ShipmentStatus.RETURNED);
      });

      it('should map cancelled to CANCELLED', () => {
        expect(mapCarrierStatusToInternal('DHL', 'cancelled')).toBe(ShipmentStatus.CANCELLED);
      });

      it('should return IN_TRANSIT for unknown DHL status', () => {
        expect(mapCarrierStatusToInternal('DHL', 'unknown')).toBe(ShipmentStatus.IN_TRANSIT);
      });
    });

    describe('Unknown carrier', () => {
      it('should return IN_TRANSIT for unknown carrier', () => {
        // Using type assertion since we're testing edge case
        expect(mapCarrierStatusToInternal('UNKNOWN' as ShippingCarrier, 'any-status')).toBe(ShipmentStatus.IN_TRANSIT);
      });
    });
  });

  describe('isTerminalStatus', () => {
    it('should return true for DELIVERED', () => {
      expect(isTerminalStatus(ShipmentStatus.DELIVERED)).toBe(true);
    });

    it('should return true for CANCELLED', () => {
      expect(isTerminalStatus(ShipmentStatus.CANCELLED)).toBe(true);
    });

    it('should return true for RETURNED', () => {
      expect(isTerminalStatus(ShipmentStatus.RETURNED)).toBe(true);
    });

    it('should return false for LABEL_CREATED', () => {
      expect(isTerminalStatus(ShipmentStatus.LABEL_CREATED)).toBe(false);
    });

    it('should return false for IN_TRANSIT', () => {
      expect(isTerminalStatus(ShipmentStatus.IN_TRANSIT)).toBe(false);
    });

    it('should return false for OUT_FOR_DELIVERY', () => {
      expect(isTerminalStatus(ShipmentStatus.OUT_FOR_DELIVERY)).toBe(false);
    });

    it('should return false for EXCEPTION', () => {
      expect(isTerminalStatus(ShipmentStatus.EXCEPTION)).toBe(false);
    });

    it('should return false for PENDING', () => {
      expect(isTerminalStatus(ShipmentStatus.PENDING)).toBe(false);
    });
  });

  describe('isCarrierStatusTerminal', () => {
    describe('FedEx terminal statuses', () => {
      it('should return true for DL (Delivered)', () => {
        expect(isCarrierStatusTerminal('FEDEX', 'DL')).toBe(true);
      });

      it('should return true for CA (Cancelled)', () => {
        expect(isCarrierStatusTerminal('FEDEX', 'CA')).toBe(true);
      });

      it('should return true for RS (Returned)', () => {
        expect(isCarrierStatusTerminal('FEDEX', 'RS')).toBe(true);
      });

      it('should return false for IT (In transit)', () => {
        expect(isCarrierStatusTerminal('FEDEX', 'IT')).toBe(false);
      });

      it('should return false for OD (Out for delivery)', () => {
        expect(isCarrierStatusTerminal('FEDEX', 'OD')).toBe(false);
      });

      it('should return false for DE (Exception)', () => {
        expect(isCarrierStatusTerminal('FEDEX', 'DE')).toBe(false);
      });
    });

    describe('DHL terminal statuses', () => {
      it('should return true for delivered', () => {
        expect(isCarrierStatusTerminal('DHL', 'delivered')).toBe(true);
      });

      it('should return true for cancelled', () => {
        expect(isCarrierStatusTerminal('DHL', 'cancelled')).toBe(true);
      });

      it('should return true for returned', () => {
        expect(isCarrierStatusTerminal('DHL', 'returned')).toBe(true);
      });

      it('should return false for transit', () => {
        expect(isCarrierStatusTerminal('DHL', 'transit')).toBe(false);
      });

      it('should return false for out-for-delivery', () => {
        expect(isCarrierStatusTerminal('DHL', 'out-for-delivery')).toBe(false);
      });

      it('should return false for failure', () => {
        expect(isCarrierStatusTerminal('DHL', 'failure')).toBe(false);
      });
    });

    describe('Unknown carrier', () => {
      it('should return false for unknown carrier', () => {
        expect(isCarrierStatusTerminal('UNKNOWN' as ShippingCarrier, 'any-status')).toBe(false);
      });
    });
  });
});
