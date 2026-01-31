import { Test, TestingModule } from '@nestjs/testing';
import { TrackingSchedulerService } from '../../src/modules/shipping/tracking-scheduler.service';
import { ShippingService } from '../../src/modules/shipping/shipping.service';
import { PrismaService } from '../../src/common/database/prisma.service';
import { Logger } from '@nestjs/common';

describe('SHIP-05 Tracking Polling Scheduler', () => {
    let scheduler: TrackingSchedulerService;
    let shippingService: ShippingService;
    let prisma: PrismaService;

    const orgId = 'org-123';

    const inTransitShipments = [
        { id: 'ship-1', trackingNumber: 'TRACK-1', status: 'IN_TRANSIT', provider: 'FEDEX', organizationId: orgId },
        { id: 'ship-2', trackingNumber: 'TRACK-2', status: 'IN_TRANSIT', provider: 'DHL', organizationId: orgId },
    ];

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TrackingSchedulerService,
                {
                    provide: ShippingService,
                    useValue: {
                        getCarrierTrackingStatus: jest.fn(),
                    },
                },
                {
                    provide: PrismaService,
                    useValue: {
                        shipment: {
                            findMany: jest.fn().mockResolvedValue(inTransitShipments),
                            update: jest.fn(),
                        },
                        order: {
                            update: jest.fn(),
                        },
                    },
                },
            ],
        }).compile();

        scheduler = module.get<TrackingSchedulerService>(TrackingSchedulerService);
        shippingService = module.get<ShippingService>(ShippingService);
        prisma = module.get<PrismaService>(PrismaService);
        jest.clearAllMocks();
    });

    it('should query only IN_TRANSIT shipments', async () => {
        (shippingService.getCarrierTrackingStatus as jest.Mock).mockResolvedValue('IN_TRANSIT'); // No change

        await scheduler.pollTrackingUpdates();

        expect(prisma.shipment.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { status: 'IN_TRANSIT' }
        }));
    });

    it('should update shipment status when carrier returns changed status', async () => {
        // Mock: TRACK-1 is now DELIVERED
        (shippingService.getCarrierTrackingStatus as jest.Mock)
            .mockResolvedValueOnce('DELIVERED') // ship-1
            .mockResolvedValueOnce('IN_TRANSIT'); // ship-2 no change

        await scheduler.pollTrackingUpdates();

        expect(prisma.shipment.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 'ship-1' },
            data: { status: 'DELIVERED' }
        }));
        expect(prisma.shipment.update).toHaveBeenCalledTimes(1); // Only 1 changed
    });

    it('should NOT update if carrier status is the same', async () => {
        // Mock: Both return same status
        (shippingService.getCarrierTrackingStatus as jest.Mock).mockResolvedValue('IN_TRANSIT');

        await scheduler.pollTrackingUpdates();

        expect(prisma.shipment.update).not.toHaveBeenCalled();
    });

    it('should handle carrier API errors gracefully without crashing', async () => {
        // Mock: First shipment throws, second is fine
        (shippingService.getCarrierTrackingStatus as jest.Mock)
            .mockRejectedValueOnce(new Error('Carrier API Timeout'))
            .mockResolvedValueOnce('DELIVERED');

        // Should NOT throw
        await expect(scheduler.pollTrackingUpdates()).resolves.not.toThrow();

        // Second shipment should still be updated
        expect(prisma.shipment.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 'ship-2' },
            data: { status: 'DELIVERED' }
        }));
    });
});
