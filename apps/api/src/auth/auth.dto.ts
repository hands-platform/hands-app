import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Role } from '@prisma/client';

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}

export class RequestOtpDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  phone!: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}

export class VerifyOtpDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  phone!: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(16)
  otp!: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}

export class RefreshTokenDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class SupabaseExchangeDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  supabaseAccessToken!: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}

export class AdminOperatorLoginDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(320)
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  password!: string;
}
