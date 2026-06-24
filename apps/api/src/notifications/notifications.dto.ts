import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

const devicePlatforms = ['ios', 'android'] as const;

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}

function lowercaseString(value: unknown) {
  const trimmed = trimString(value);
  return typeof trimmed === 'string' ? trimmed.toLowerCase() : trimmed;
}

export class RegisterDeviceTokenDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  token!: string;

  @Transform(({ value }) => lowercaseString(value))
  @IsIn(devicePlatforms)
  platform!: (typeof devicePlatforms)[number];
}

export class DeleteDeviceTokenDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  token!: string;
}
