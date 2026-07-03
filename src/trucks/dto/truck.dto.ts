import { IsBoolean, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateTruckDto {
  @IsString() @IsNotEmpty()
  truckName: string;

  @IsString() @IsNotEmpty()
  truckNumber: string;

  @IsString() @IsNotEmpty()
  driverName: string;

  @IsString() @IsNotEmpty()
  phoneNumber: string;

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

  @IsOptional() @IsBoolean()
  status?: boolean;
}

export class ResetTruckPasswordDto {
  @IsString() @MinLength(4)
  newPassword: string;
}
