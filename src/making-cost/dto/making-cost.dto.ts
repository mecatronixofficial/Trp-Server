import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { CostType } from '../../common/enums';

export class CreateMakingCostDto {
  @IsDateString()
  date: string;

  @IsEnum(CostType)
  costType: CostType;

  @IsNumber() @Min(0)
  amount: number;

  @IsOptional() @IsString()
  notes?: string;
}

export class UpdateMakingCostDto extends CreateMakingCostDto {}
