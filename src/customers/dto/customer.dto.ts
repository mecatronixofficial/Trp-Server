import { IsBoolean, IsEnum, IsIn, IsMongoId, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
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

  @IsOptional() @IsNumber() @Min(0)
  retailPrice?: number;

  @IsOptional() @IsNumber() @Min(0)
  wholesalePrice?: number;

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

  @IsOptional() @IsNumber() @Min(0)
  retailPrice?: number;

  @IsOptional() @IsNumber() @Min(0)
  wholesalePrice?: number;

  @IsOptional() @IsBoolean()
  isActive?: boolean;

  @IsOptional() @IsString()
  notes?: string;

  @IsOptional() @IsMongoId()
  truck?: string;
}
