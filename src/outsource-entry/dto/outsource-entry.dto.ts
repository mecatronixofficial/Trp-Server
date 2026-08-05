import { IsDateString, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateOutsourceEntryDto {
  @IsDateString()
  date: string;

  @IsNumber() @Min(0.25)
  quantity: number;

  @IsOptional() @IsString()
  notes?: string;
}

export class UpdateOutsourceEntryDto extends CreateOutsourceEntryDto {}
