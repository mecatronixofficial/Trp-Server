import { IsBoolean, IsDateString, IsEnum, IsMongoId, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { WorkerAttendanceStatus } from '../schemas/worker-attendance.schema';

export class CreateWorkerDto {
  @IsString()
  name: string;

  @IsOptional() @IsString()
  phoneNumber?: string;

  @IsOptional() @IsString()
  role?: string;

  @IsNumber() @Min(0)
  monthlySalary: number;

  @IsOptional() @IsBoolean()
  isActive?: boolean;

  @IsOptional() @IsString()
  notes?: string;
}

export class UpdateWorkerDto extends CreateWorkerDto {}

export class CreateWorkerAttendanceDto {
  @IsMongoId()
  worker: string;

  @IsDateString()
  date: string;

  @IsEnum(WorkerAttendanceStatus)
  status: WorkerAttendanceStatus;

  @IsNumber() @Min(0)
  buyingAmount: number;

  @IsOptional() @IsString()
  notes?: string;
}

export class UpdateWorkerAttendanceDto extends CreateWorkerAttendanceDto {}

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
