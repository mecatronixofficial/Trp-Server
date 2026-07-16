import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateTruckDto {
  @IsOptional() @IsString()
  branch?: string;

  @IsString() @IsNotEmpty()
  truckName: string;

  @IsString() @IsNotEmpty()
  truckNumber: string;

  @IsString() @IsNotEmpty()
  driverName: string;

  @IsString() @IsNotEmpty()
  phoneNumber: string;

  @IsOptional() @IsNumber() @Min(0)
  monthlySalary?: number;

  @IsString() @IsNotEmpty()
  loginId: string;

  @IsString() @MinLength(4)
  password: string;
}

export class UpdateTruckDto {
  @IsOptional() @IsString()
  truckName?: string;

  @IsOptional() @IsString()
  truckNumber?: string;

  @IsOptional() @IsString()
  driverName?: string;

  @IsOptional() @IsString()
  phoneNumber?: string;

  @IsOptional() @IsNumber() @Min(0)
  monthlySalary?: number;

  @IsOptional() @IsBoolean()
  status?: boolean;
}

export class ResetTruckPasswordDto {
  @IsString() @MinLength(4)
  newPassword: string;
}
