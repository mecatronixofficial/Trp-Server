import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional() @IsString() displayName?: string;
  @IsOptional() @IsString() phoneNumber?: string;
  // IsOptional only skips validation for null/undefined, not '' — an
  // emptied-out field must still be allowed through, so only validate the
  // email format once something has actually been typed.
  @ValidateIf((o) => !!o.email) @IsEmail() email?: string;
  @IsOptional()
  @IsString()
  @MaxLength(2_800_000, { message: 'Profile image must be smaller than 2 MB.' })
  @Matches(/^$|^data:image\/(png|jpeg|webp);base64,/i, { message: 'Profile image must be a PNG, JPEG, or WebP image.' })
  profileImage?: string;
}

export class ChangeOwnPasswordDto {
  @IsString() @IsNotEmpty() currentPassword: string;
  @IsString() @MinLength(6) newPassword: string;
}
