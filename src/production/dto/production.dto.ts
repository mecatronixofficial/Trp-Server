import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Shift } from '../../common/enums';

export class CreateProductionDto {
  @IsDateString()
  date: string;

  @IsOptional() @IsEnum(Shift)
  shift?: Shift;

  @IsInt() @Min(1)
  boxOpen: number;

  @IsInt() @Min(1)
  boxClose: number;

  @IsOptional() @IsString()
  notes?: string;
}

export class UpdateProductionDto extends CreateProductionDto {}
