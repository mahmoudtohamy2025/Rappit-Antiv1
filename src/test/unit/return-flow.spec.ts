import { Test, TestingModule } from '@nestjs/testing';
import { ShippingService } from '../../src/modules/shipping/shipping.service';
import { PrismaService } from '../../src/common/database/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('SHIP-03 Return-to-Stock Flow', () => {
    let service: ShippingService;
    let prisma: PrismaService;

    const orgId = 'org-123';
    const orderId = 'order-return-1';
    const sku1 = 'sku-1';
    const warehouseId = 'wh-1';

    const mockOrder = {
        id: orderId,
        organizationId: orgId,
        status: 'SHIPPED',
        items: [{ id: 'item-1', skuId: sku1, quantity: 2 }],
        shipments: [
            {
                id: 'ship-1',
                status: 'DELIVERED',
                items: [{
                    orderItemId: 'item-1',
                    quantity: 2,
                    orderItem: { id: 'item-1', skuId: sku1 }
                }]
            }
        ]
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
                        inventoryLevel: {
                            findUnique: jest.fn().mockResolvedValue({
                                id: 'inv-1',
                                available: 10,
                                damaged: 0
                            }),
                            upsert: jest.fn(),
                            update: jest.fn(),
                        },
                        $transaction: jest.fn(cb => cb(prisma)),
                    },
                },
            ],
        }).compile();

        service = module.get<ShippingService>(ShippingService);
        prisma = module.get<PrismaService>(PrismaService);
        jest.clearAllMocks();
    });

    it('should process a return and RESTOCK sellable items', async () => {
        const returnDto = {
            orderId,
            items: [
                { skuId: sku1, quantity: 1, condition: 'SELLABLE', warehouseId }
            ]
        };

        await service.processReturn(orgId, returnDto);

        // Verify Inventory RESTOCK (Upsert)
        expect(prisma.inventoryLevel.upsert).toHaveBeenCalledWith(expect.objectContaining({
            where: { skuId_warehouseId: { skuId: sku1, warehouseId } },
            update: { available: { increment: 1 } },
            create: expect.objectContaining({ available: 1 })
        }));

        // Verify Order Status Update
        expect(prisma.order.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: orderId },
            data: expect.objectContaining({ status: 'RETURNED' }) // Or PARTIALLY_RETURNED if supported
        }));
    });

    it('should process a return and mark DAMAGED items (no restock to available)', async () => {
        const returnDto = {
            orderId,
            items: [
                { skuId: sku1, quantity: 1, condition: 'DAMAGED', warehouseId }
            ]
        };

        await service.processReturn(orgId, returnDto);

        // Verify Inventory DAMAGED Increment via Upsert
        expect(prisma.inventoryLevel.upsert).toHaveBeenCalledWith(expect.objectContaining({
            where: { skuId_warehouseId: { skuId: sku1, warehouseId } },
            update: { damaged: { increment: 1 } },
            create: expect.objectContaining({ damaged: 1 })
        }));
    });

    it('should throw error if return quantity > shipped quantity', async () => {
        // Shipped 2. Try to return 3.
        const returnDto = {
            orderId,
            items: [
                { skuId: sku1, quantity: 3, condition: 'SELLABLE', warehouseId }
            ]
        };

        await expect(service.processReturn(orgId, returnDto))
            .rejects
            .toThrow(BadRequestException);
    });

    it('should throw error if order not found', async () => {
        (prisma.order.findFirst as jest.Mock).mockResolvedValue(null);

        const returnDto = { orderId, items: [] };
        await expect(service.processReturn(orgId, returnDto))
            .rejects.toThrow(NotFoundException);
    });
});
