import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

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

export class CustomerNotificationInboxQueryDto {
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    return Number(value);
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  take?: number;

  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsString()
  @MaxLength(128)
  cursor?: string;
}

export class ProviderChatNotificationReadDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  chatRoomId!: string;
}
