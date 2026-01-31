import { IsNotEmpty, IsString, IsEnum, IsObject, IsOptional, IsArray, ValidateNested, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ShippingProvider {
  DHL = 'DHL',
  FEDEX = 'FEDEX',
}


export class ShipmentItemDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  skuId: string;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  quantity: number;
}

export class CreateShipmentDto {
  @ApiProperty({ example: 'order-uuid' })
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({ enum: ShippingProvider })
  @IsEnum(ShippingProvider)
  @IsNotEmpty()
  provider: ShippingProvider;

  @ApiProperty({ type: [ShipmentItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShipmentItemDto)
  items?: ShipmentItemDto[];

  @ApiPropertyOptional({
    example: {
      serviceType: 'EXPRESS',
      packageType: 'ENVELOPE',
      weight: 0.5,
      dimensions: { length: 20, width: 15, height: 5 },
    },
  })
  @IsOptional()
  @IsObject()
  shipmentOptions?: any;
}
