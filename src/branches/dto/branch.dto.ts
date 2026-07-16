import { IsBoolean, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateBranchDto {
  @IsString() @IsNotEmpty() name: string;
  @IsString() @IsNotEmpty() code: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() phoneNumber?: string;
  @IsString() @IsNotEmpty() adminName: string;
  @IsString() @IsNotEmpty() adminUsername: string;
  @IsString() @MinLength(6) adminPassword: string;
}

export class UpdateBranchDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() phoneNumber?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class ResetBranchAdminPasswordDto {
  @IsString() @MinLength(6) newPassword: string;
}

export class CreateBranchAdminDto {
  @IsString() @IsNotEmpty() displayName: string;
  @IsString() @IsNotEmpty() username: string;
  @IsString() @MinLength(6) password: string;
}
