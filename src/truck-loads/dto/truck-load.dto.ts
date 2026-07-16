import { IsDateString, IsEnum, IsMongoId, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { IceBarSize } from '../../common/enums';

export class CreateTruckLoadDto {
  @IsOptional() @IsMongoId() truck?: string;
  @IsDateString() date: string;
  @IsOptional() @IsEnum(IceBarSize) size?: IceBarSize;
  @IsNumber() @Min(0.01) quantity: number;
  @IsOptional() @IsString() notes?: string;
}
