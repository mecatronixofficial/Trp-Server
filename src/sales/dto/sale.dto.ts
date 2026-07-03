import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsEnum, IsMongoId, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { IceBarSize, PaymentMode, SaleType } from '../../common/enums';

export class SaleItemDto {
  @IsEnum(IceBarSize)
  size: IceBarSize;

  @IsNumber() @Min(1)
  quantity: number;

  @IsNumber() @Min(0)
  pricePerBar: number;
}

export class CreateSaleDto {
  @IsDateString()
  date: string;

  // Admin can create a sale for any truck; truck users are forced to their own truck server-side.
  @IsMongoId()
  truck: string;

  @IsMongoId()
  customer: string;

  @IsEnum(SaleType)
  saleType: SaleType;

  @IsArray() @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  items: SaleItemDto[];

  @IsEnum(PaymentMode)
  paymentMode: PaymentMode;

  @IsNumber() @Min(0)
  paidAmount: number;

  @IsOptional() @IsString()
  notes?: string;
}

export class UpdateSaleDto extends CreateSaleDto {}
