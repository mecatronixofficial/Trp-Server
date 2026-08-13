import { IsDateString, IsMongoId, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpsertTruckAssignmentDto {
  @IsMongoId() truck: string;
  @IsDateString() date: string;
  @IsNumber() @Min(0) quantity: number;
  @IsOptional() @IsString() notes?: string;
}

export class RejectTruckAssignmentDto {
  @IsString()
  reason: string;
}
