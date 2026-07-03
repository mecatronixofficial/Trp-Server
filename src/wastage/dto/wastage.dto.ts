import { IsDateString, IsEnum, IsMongoId, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { IceBarSize, WastageReason } from '../../common/enums';

export class CreateWastageDto {
  @IsDateString()
  date: string;

  @IsOptional() @IsMongoId()
  truck?: string;

  @IsEnum(IceBarSize)
  size: IceBarSize;

  @IsNumber() @Min(1)
  quantity: number;

  @IsEnum(WastageReason)
  reason: WastageReason;

  @IsOptional() @IsString()
  notes?: string;
}

export class UpdateWastageDto extends CreateWastageDto {}
