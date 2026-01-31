import { Test, TestingModule } from '@nestjs/testing';
import { ShippingService } from '../../src/modules/shipping/shipping.service';
import { PrismaService } from '../../src/common/database/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('SHIP-02 Partial Fulfillment', () => {
    let service: ShippingService;
    let prisma: PrismaService;

    // Test Data
    const orgId = 'org-123';
    const orderId = 'order-abc';
    const sku1 = 'sku-1';
    const sku2 = 'sku-2';

    // Order with 2 items: SKU1 (Qty 2), SKU2 (Qty 1)
    const mockOrder = {
        id: orderId,
        organizationId: orgId,
        status: 'READY_TO_SHIP',
        items: [
            { id: 'item-1', skuId: sku1, quantity: 2 },
            { id: 'item-2', skuId: sku2, quantity: 1 }
        ],
        shipments: [] // No shipments yet
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ShippingService,
                {
                    provide: PrismaService,
                    useValue: {
                        order: {
                            findFirst: jest.fn().mockResolvedValue(mockOrder),
                            update: jest.fn(),
                        },
                        shipment: {
                            create: jest.fn().mockImplementation((args) => Promise.resolve({
                                id: 'ship-new',
                                ...args.data,
                                items: args.data.items.create.map(i => ({
                                    quantity: i.quantity,
                                    orderItemId: i.orderItemId
                                }))
                            })),
                        },
                        $transaction: jest.fn((cb) => cb(prisma)),
                    },
                },
            ],
        }).compile();

        service = module.get<ShippingService>(ShippingService);
        prisma = module.get<PrismaService>(PrismaService);

        // Reset mocks
        jest.clearAllMocks();
    });

    it('should allow partial shipment of one item', async () => {
        // Ship 1 of SKU1 (Total 2)
        const dto = {
            orderId,
            provider: 'FEDEX',
            items: [
                { skuId: sku1, quantity: 1 }
            ]
        };

        // Mock Order Retrieval with NO existing shipments
        (prisma.order.findFirst as jest.Mock).mockResolvedValue({
            ...mockOrder,
            shipments: []
        });

        await service.createShipment(orgId, dto as any);

        // Verify Shipment Created
        expect(prisma.shipment.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                items: {
                    create: expect.arrayContaining([
                        expect.objectContaining({ orderItemId: 'item-1', quantity: 1 })
                    ])
                }
            })
        }));

        // Order Status should remain READY_TO_SHIP (Partial)
        expect(prisma.order.update).not.toHaveBeenCalledWith(expect.objectContaining({
            data: { status: 'LABEL_CREATED' }
        }));
    });

    it('should update order to LABEL_CREATED only when fully shipped', async () => {
        // Prepare: SKU1 already 1 shipped. SKU2 0 shipped.
        // Request: Ship remaining SKU1 (1) AND all SKU2 (1).

        const existingShipments = [{
            status: 'LABEL_CREATED',
            items: [{ orderItemId: 'item-1', quantity: 1 }] // 1 of 2 shipped
        }];

        (prisma.order.findFirst as jest.Mock).mockResolvedValue({
            ...mockOrder,
            shipments: existingShipments
        });

        const dto = {
            orderId,
            provider: 'FEDEX',
            items: [
                { skuId: sku1, quantity: 1 }, // Remaining 1
                { skuId: sku2, quantity: 1 }  // All 1
            ]
        };

        await service.createShipment(orgId, dto as any);

        // Order Status should now depend on logic. 
        // Total Ordered: 3. Total Shipped Previous: 1. Current: 2. Total: 3.
        // Should Update to LABEL_CREATED
        expect(prisma.order.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: orderId },
            data: { status: 'LABEL_CREATED' }
        }));
    });

    it('should throw BadRequest if trying to over-ship', async () => {
        // Try to ship 3 of SKU1 (Only 2 ordered)
        const dto = {
            orderId,
            provider: 'FEDEX',
            items: [
                { skuId: sku1, quantity: 3 }
            ]
        };

        // Mock no existing shipments
        (prisma.order.findFirst as jest.Mock).mockResolvedValue({
            ...mockOrder,
            items: [{ id: 'item-1', skuId: sku1, quantity: 2 }],
            shipments: []
        });

        await expect(service.createShipment(orgId, dto as any))
            .rejects
            .toThrow(BadRequestException);
    });

    it('should throw BadRequest if trying to ship item not in order', async () => {
        const dto = {
            orderId,
            provider: 'FEDEX',
            items: [
                { skuId: 'sku-UNKNOWN', quantity: 1 }
            ]
        };

        await expect(service.createShipment(orgId, dto as any))
            .rejects
            .toThrow(BadRequestException);
    });
});
