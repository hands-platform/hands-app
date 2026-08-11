import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { FileVisibility } from '@prisma/client';

const filePurposes = [
  'provider-verification',
  'provider-gallery',
  'chat-attachment',
  'profile-image',
  'finance-evidence',
] as const;

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}

function numberString(value: unknown) {
  if (typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  return trimmed === '' ? value : Number(trimmed);
}

export class CreatePresignedUploadDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  contentType!: string;

  @IsEnum(FileVisibility)
  visibility!: FileVisibility;

  @IsIn(filePurposes)
  purpose!: (typeof filePurposes)[number];

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(255)
  fileName?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(128)
  providerVerificationId?: string;
}

export class CompleteUploadDto {
  @IsOptional()
  @Transform(({ value }) => numberString(value))
  @IsInt()
  @Min(0)
  sizeBytes?: number;
}
