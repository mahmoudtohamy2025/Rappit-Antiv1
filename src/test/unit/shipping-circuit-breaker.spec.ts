import { Test, TestingModule } from '@nestjs/testing';
import { ShippingService, CarrierServiceUnavailableException } from '../../src/modules/shipping/shipping.service';
import { PrismaService } from '../../src/common/database/prisma.service';
import { BadRequestException } from '@nestjs/common';

// Mock date to control time flow
const mockDate = (milliseconds: number) => {
    jest.spyOn(Date, 'now').mockReturnValue(milliseconds);
};

describe('Shipping Circuit Breaker (SHIP-01)', () => {
    let service: ShippingService;
    let prisma: PrismaService;

    // Test Data
    const orgId = 'org-123';
    const orderId = 'order-abc';
    const fedexDto = {
        orderId,
        provider: 'FEDEX',
        shipmentOptions: {}
    };
    const dhlDto = {
        orderId,
        provider: 'DHL',
        shipmentOptions: {}
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ShippingService,
                {
                    provide: PrismaService,
                    useValue: {
                        order: {
                            findFirst: jest.fn().mockResolvedValue({
                                id: orderId,
                                organizationId: orgId,
                                status: 'READY_TO_SHIP',
                                shipment: null,
                                shipments: [],
                                items: [
                                    { id: 'item-1', skuId: 'SKU-001', quantity: 5 }
                                ],
                            }),
                            update: jest.fn(),
                        },
                        shipment: {
                            create: jest.fn().mockResolvedValue({
                                id: 'shipment-123',
                                trackingNumber: 'TRACK-123'
                            }),
                        },
                    },
                },
            ],
        }).compile();

        service = module.get<ShippingService>(ShippingService);
        prisma = module.get<PrismaService>(PrismaService);

        // Reset time to T=0
        mockDate(0);

        // Reset fail counters (simulated private state reset)
        // Accessing private property for testing reset if needed, 
        // or assuming service is fresh per test
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Circuit State: CLOSED (Normal Operation)', () => {
        it('should allow requests when circuit is CLOSED', async () => {
            // Mock successful carrier execution (simulate external call)
            // Implementation detail: service.createShipment should wrap external call

            const result = await service.createShipment(orgId, fedexDto as any);
            expect(result).toBeDefined();
            expect(prisma.shipment.create).toHaveBeenCalled();
        });

        it('should track failures but stay CLOSED if threshold not met', async () => {
            // Mock failures < 5
            // We simulate internal carrier call throwing
            jest.spyOn(service as any, 'callCarrierApi').mockRejectedValue(new Error('API Error'));

            await expect(service.createShipment(orgId, fedexDto as any)).rejects.toThrow();
            await expect(service.createShipment(orgId, fedexDto as any)).rejects.toThrow();
            await expect(service.createShipment(orgId, fedexDto as any)).rejects.toThrow();
            await expect(service.createShipment(orgId, fedexDto as any)).rejects.toThrow();

            // 4 failures -> Circuit should still be CLOSED (next one allowed to try)
            // Check if next call attempts execution (by seeing if it throws the API Error again, not CircuitUnavailable)
            await expect(service.createShipment(orgId, fedexDto as any)).rejects.toThrow('API Error');
        });
    });

    describe('Circuit State: OPEN (Failing)', () => {
        it('should OPEN circuit after 5 failures in 30 seconds', async () => {
            jest.spyOn(service as any, 'callCarrierApi').mockRejectedValue(new Error('Connection Timeout'));

            // 5 failures
            for (let i = 0; i < 5; i++) {
                try {
                    await service.createShipment(orgId, fedexDto as any);
                } catch (e) { }
            }

            // 6th attempt should fail FAST
            await expect(service.createShipment(orgId, fedexDto as any))
                .rejects
                .toThrow(CarrierServiceUnavailableException);

            // Should verify API was NOT called on 6th attempt
            expect(service['callCarrierApi']).toHaveBeenCalledTimes(5);
        });

        it('should reset failure count window after 30 seconds', async () => {
            jest.spyOn(service as any, 'callCarrierApi').mockRejectedValue(new Error('Timeout'));

            // 4 failures at T=0
            for (let i = 0; i < 4; i++) {
                try { await service.createShipment(orgId, fedexDto as any); } catch (e) { }
            }

            // Advance time past 30s window (T=35000)
            mockDate(35000);

            // 5th failure (should be treated as 1st in new window)
            try { await service.createShipment(orgId, fedexDto as any); } catch (e) { }

            // 6th attempt should still try (Circuit CLOSED)
            await expect(service.createShipment(orgId, fedexDto as any)).rejects.toThrow('Timeout');
        });
    });

    describe('Circuit State: HALF-OPEN (Recovery)', () => {
        it('should move to HALF-OPEN after cool-down (60s)', async () => {
            jest.spyOn(service as any, 'callCarrierApi').mockRejectedValue(new Error('Timeout'));

            // Trip circuit
            for (let i = 0; i < 5; i++) {
                try { await service.createShipment(orgId, fedexDto as any); } catch (e) { }
            }

            // Advance time to 61s
            mockDate(61000);

            // Request should be allowed (HALF-OPEN probe)
            // Mock success this time
            jest.spyOn(service as any, 'callCarrierApi').mockResolvedValue('TRACK-SUCCESS');

            await expect(service.createShipment(orgId, fedexDto as any)).resolves.toBeDefined();
        });

        it('should re-OPEN if HALF-OPEN probe fails', async () => {
            jest.spyOn(service as any, 'callCarrierApi').mockRejectedValue(new Error('Timeout'));

            // Trip circuit
            for (let i = 0; i < 5; i++) {
                try { await service.createShipment(orgId, fedexDto as any); } catch (e) { }
            }

            // T=61s (Half-Open)
            mockDate(61000);

            // Probe fails
            try { await service.createShipment(orgId, fedexDto as any); } catch (e) { }

            // Immediate next request should be locked out (OPEN) without waiting for 5 failures
            await expect(service.createShipment(orgId, fedexDto as any))
                .rejects
                .toThrow(CarrierServiceUnavailableException);
        });
    });

    describe('Isolation & Edge Cases', () => {
        it('should isolate failures by Carrier', async () => {
            jest.spyOn(service as any, 'callCarrierApi').mockRejectedValue(new Error('FedEx Down'));

            // Trip FedEx Circuit
            for (let i = 0; i < 5; i++) {
                try { await service.createShipment(orgId, fedexDto as any); } catch (e) { }
            }

            // FedEx should be OPEN
            await expect(service.createShipment(orgId, fedexDto as any))
                .rejects
                .toThrow(CarrierServiceUnavailableException);

            // DHL should be CLOSED (Normal)
            jest.spyOn(service as any, 'callCarrierApi').mockResolvedValue('DHL-TRACK-1');
            await expect(service.createShipment(orgId, dhlDto as any)).resolves.toBeDefined();
        });

        it('should handle concurrency safely', async () => {
            jest.spyOn(service as any, 'callCarrierApi').mockRejectedValue(new Error('Timeout'));

            // Simulate 10 parallel requests
            const promises = Array(10).fill(0).map(() =>
                service.createShipment(orgId, fedexDto as any).catch(e => e)
            );

            await Promise.all(promises);

            // Circuit should be OPEN now
            await expect(service.createShipment(orgId, fedexDto as any))
                .rejects
                .toThrow(CarrierServiceUnavailableException);
        });
    });
});
