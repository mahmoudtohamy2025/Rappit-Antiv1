import { IsNotEmpty, IsString, IsArray, ValidateNested, IsNumber, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export enum ReturnCondition {
    SELLABLE = 'SELLABLE',
    DAMAGED = 'DAMAGED',
}

export class ReturnItemDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    skuId: string;

    @ApiProperty()
    @IsNumber()
    @IsNotEmpty()
    quantity: number;

    @ApiProperty({ enum: ReturnCondition })
    @IsEnum(ReturnCondition)
    @IsNotEmpty()
    condition: ReturnCondition;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    warehouseId: string;
}

export class ProcessReturnDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    orderId: string;

    @ApiProperty({ type: [ReturnItemDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ReturnItemDto)
    items: ReturnItemDto[];
}
