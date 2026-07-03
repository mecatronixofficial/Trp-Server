import { IsEnum, IsMongoId, IsNumber, Min } from 'class-validator';
import { IceBarSize, SaleType } from '../../common/enums';

export class UpsertPriceDto {
  @IsMongoId()
  customer: string;

  @IsEnum(IceBarSize)
  size: IceBarSize;

  @IsEnum(SaleType)
  saleType: SaleType;

  @IsNumber() @Min(0)
  price: number;
}
