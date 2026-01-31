import { Test, TestingModule } from '@nestjs/testing';
import { ShippingService } from '../../src/modules/shipping/shipping.service';
import { ShippingController } from '../../src/modules/shipping/shipping.controller';
import { NotFoundException } from '@nestjs/common';
import { JwtAuthGuard } from '../../src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../../src/common/guards/roles.guard';

describe('SHIP-04 Label Reprint Endpoint', () => {
    let controller: ShippingController;
    let service: ShippingService;

    const orgId = 'org-123';
    const shipmentId = 'ship-abc';
    const trackingNumber = 'TRACK-XYZ';
    const labelUrl = 'https://example.com/label.pdf';

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [ShippingController],
            providers: [
                {
                    provide: ShippingService,
                    useValue: {
                        getLabel: jest.fn(),
                    },
                },
            ],
        })
            .overrideGuard(JwtAuthGuard)
            .useValue({ canActivate: () => true })
            .overrideGuard(RolesGuard)
            .useValue({ canActivate: () => true })
            .compile();

        controller = module.get<ShippingController>(ShippingController);
        service = module.get<ShippingService>(ShippingService);
    });

    it('should return label details when found', async () => {
        jest.spyOn(service, 'getLabel').mockResolvedValue({
            trackingNumber,
            labelUrl,
        });

        const result = await controller.getLabel(orgId, shipmentId);

        expect(result).toEqual({ trackingNumber, labelUrl });
        expect(service.getLabel).toHaveBeenCalledWith(orgId, shipmentId);
    });

    it('should throw 404 when service throws NotFound', async () => {
        jest.spyOn(service, 'getLabel').mockRejectedValue(new NotFoundException('Shipment not found'));

        await expect(controller.getLabel(orgId, shipmentId))
            .rejects
            .toThrow(NotFoundException);
    });

    it('should correctly extract organizationId from request', async () => {
        jest.spyOn(service, 'getLabel').mockResolvedValue({ trackingNumber, labelUrl });

        await controller.getLabel('another-org', shipmentId);

        expect(service.getLabel).toHaveBeenCalledWith('another-org', shipmentId);
    });
});
