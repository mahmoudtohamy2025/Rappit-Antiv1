/**
 * Warehouse Module
 * GAP-01: Warehouse CRUD Implementation
 */

import { Module } from '@nestjs/common';
import { WarehouseService } from './warehouse.service';
import { WarehouseController } from './warehouse.controller';
import { DatabaseModule } from '../../common/database/database.module';

@Module({
    imports: [DatabaseModule],
    controllers: [WarehouseController],
    providers: [WarehouseService],
    exports: [WarehouseService],
})
export class WarehouseModule { }
