import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional() @IsString() displayName?: string;
  @IsOptional() @IsString() phoneNumber?: string;
  // IsOptional only skips validation for null/undefined, not '' — an
  // emptied-out field must still be allowed through, so only validate the
  // email format once something has actually been typed.
  @ValidateIf((o) => !!o.email) @IsEmail() email?: string;
}

export class ChangeOwnPasswordDto {
  @IsString() @IsNotEmpty() currentPassword: string;
  @IsString() @MinLength(6) newPassword: string;
}
