import { IsEnum, IsMongoId, IsNumber, Min } from 'class-validator';
import { SaleType } from '../../common/enums';

export class UpsertPriceDto {
  @IsMongoId()
  customer: string;

  @IsEnum(SaleType)
  saleType: SaleType;

  @IsNumber() @Min(0)
  price: number;
}
