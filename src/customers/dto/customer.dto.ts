import { IsBoolean, IsEnum, IsIn, IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { SaleType } from '../../common/enums';

export class CreateCustomerDto {
  @IsOptional() @IsIn(['local', 'truck'])
  customerType?: 'local' | 'truck';

  @IsString() @IsNotEmpty()
  name: string;

  @IsOptional() @IsString()
  phoneNumber?: string;

  @IsOptional() @IsString()
  address?: string;

  @IsOptional() @IsEnum(SaleType)
  defaultSaleType?: SaleType;

  @IsOptional() @IsString()
  notes?: string;

  @IsOptional() @IsMongoId()
  truck?: string;
}

export class UpdateCustomerDto {
  @IsOptional() @IsIn(['local', 'truck'])
  customerType?: 'local' | 'truck';

  @IsOptional() @IsString()
  name?: string;

  @IsOptional() @IsString()
  phoneNumber?: string;

  @IsOptional() @IsString()
  address?: string;

  @IsOptional() @IsEnum(SaleType)
  defaultSaleType?: SaleType;

  @IsOptional() @IsBoolean()
  isActive?: boolean;

  @IsOptional() @IsString()
  notes?: string;

  @IsOptional() @IsMongoId()
  truck?: string;
}
