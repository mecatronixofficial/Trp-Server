import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { IceBarSize, Shift } from '../../common/enums';

export class SizeQuantityDto {
  @IsEnum(IceBarSize)
  size: IceBarSize;

  @IsNumber() @Min(0)
  quantity: number;
}

export class CreateProductionDto {
  @IsDateString()
  date: string;

  @IsOptional() @IsEnum(Shift)
  shift?: Shift;

  @IsArray() @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SizeQuantityDto)
  sizeWise: SizeQuantityDto[];

  @IsOptional() @IsString()
  notes?: string;
}

export class UpdateProductionDto extends CreateProductionDto {}
