import { IsDateString, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateExpenseDto {
  @IsDateString()
  date: string;

  @IsString()
  costType: string;

  @IsNumber() @Min(0.01)
  amount: number;

  @IsOptional() @IsString()
  notes?: string;

  @IsOptional() @IsString()
  worker?: string;

  @IsOptional() @IsString()
  workerName?: string;

  @IsOptional() @IsString()
  truck?: string;

  @IsOptional() @IsString()
  truckName?: string;

  @IsOptional() @IsNumber() @Min(0)
  fuelQuantity?: number;

  @IsOptional() @IsString()
  description?: string;
}

export class UpdateExpenseDto extends CreateExpenseDto {}
