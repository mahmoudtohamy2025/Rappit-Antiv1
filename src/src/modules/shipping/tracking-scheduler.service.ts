import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@common/database/prisma.service';
import { ShippingService } from './shipping.service';

@Injectable()
export class TrackingSchedulerService {
    private readonly logger = new Logger(TrackingSchedulerService.name);

    constructor(
        private prisma: PrismaService,
        private shippingService: ShippingService,
    ) { }

    /**
     * Polls carrier APIs for tracking updates every 30 minutes.
     * Only targets IN_TRANSIT shipments.
     */
    @Cron(CronExpression.EVERY_30_MINUTES)
    async pollTrackingUpdates() {
        this.logger.log('Starting tracking update poll...');

        const shipments = await this.prisma.shipment.findMany({
            where: { status: 'IN_TRANSIT' },
        });

        this.logger.log(`Found ${shipments.length} IN_TRANSIT shipments to check`);

        for (const shipment of shipments) {
            try {
                const carrierStatus = await this.shippingService.getCarrierTrackingStatus(
                    shipment.provider,
                    shipment.trackingNumber,
                );

                if (carrierStatus !== shipment.status) {
                    this.logger.log(
                        `Shipment ${shipment.trackingNumber} status changed: ${shipment.status} -> ${carrierStatus}`,
                    );

                    await this.prisma.shipment.update({
                        where: { id: shipment.id },
                        data: { status: carrierStatus },
                    });

                    // Optionally update Order status as well
                    if (carrierStatus === 'DELIVERED') {
                        await this.prisma.order.update({
                            where: { id: shipment.orderId },
                            data: { status: 'DELIVERED' },
                        });
                    }
                }
            } catch (error) {
                // Log error but continue processing other shipments
                this.logger.error(
                    `Failed to get tracking for ${shipment.trackingNumber}: ${error.message}`,
                );
            }
        }

        this.logger.log('Tracking update poll complete.');
    }
}
