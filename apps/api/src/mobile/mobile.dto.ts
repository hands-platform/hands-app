import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export const mobileAppTypes = ['CUSTOMER', 'PARTNER'] as const;
export const mobilePlatforms = ['ANDROID', 'IOS', 'WEB'] as const;
export const mobilePushProviders = ['FCM'] as const;

export type MobileAppType = (typeof mobileAppTypes)[number];
export type MobilePlatform = (typeof mobilePlatforms)[number];
export type MobilePushProvider = (typeof mobilePushProviders)[number];

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}

function uppercaseString(value: unknown) {
  const trimmed = trimString(value);
  return typeof trimmed === 'string' ? trimmed.toUpperCase() : trimmed;
}

export class RegisterMobileDeviceDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  token!: string;

  @Transform(({ value }) => uppercaseString(value))
  @IsIn(mobilePlatforms)
  platform!: MobilePlatform;

  @IsOptional()
  @Transform(({ value }) => uppercaseString(value))
  @IsIn(mobilePushProviders)
  pushProvider?: MobilePushProvider;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(64)
  appVersion?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(64)
  osVersion?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(120)
  deviceModel?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(32)
  locale?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(80)
  timezone?: string;
}

export class UnregisterMobileDeviceDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  token!: string;
}

export class GetMobileAppVersionDto {
  @Transform(({ value }) => uppercaseString(value))
  @IsIn(mobileAppTypes)
  appType!: MobileAppType;

  @Transform(({ value }) => uppercaseString(value))
  @IsIn(mobilePlatforms)
  platform!: MobilePlatform;
}
