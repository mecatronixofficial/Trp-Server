import { IsBoolean, IsDateString, IsMongoId, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateWorkerDto {
  @IsString()
  name: string;

  @IsOptional() @IsString()
  phoneNumber?: string;

  @IsOptional() @IsString()
  role?: string;

  @IsOptional() @IsBoolean()
  isActive?: boolean;

  @IsOptional() @IsString()
  notes?: string;
}

export class UpdateWorkerDto extends CreateWorkerDto {}

export class CreateWorkerBuyingDto {
  @IsMongoId()
  worker: string;

  @IsDateString()
  date: string;

  @IsNumber() @Min(0)
  buyingAmount: number;

  @IsOptional() @IsString()
  notes?: string;
}

export class UpdateWorkerBuyingDto extends CreateWorkerBuyingDto {}
