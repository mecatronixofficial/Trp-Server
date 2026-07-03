import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { SaleType } from '../../common/enums';

export class CreateCustomerDto {
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
}

export class UpdateCustomerDto {
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
}
