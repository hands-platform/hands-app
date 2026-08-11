import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

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

function booleanValue(value: unknown) {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value !== 'string') {
    return value;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return value;
}

export class PreviewCouponDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  code!: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  serviceId!: string;

  @Transform(({ value }) => numberString(value))
  @IsInt()
  @Min(0)
  subtotal!: number;
}

export class CreateCustomerReviewDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  bookingId!: string;

  @Transform(({ value }) => numberString(value))
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(1000)
  comment?: string;
}

export class SetCustomerFavoriteProviderDto {
  @IsOptional()
  @Transform(({ value }) => booleanValue(value))
  @IsBoolean()
  favorite?: boolean;
}

export class RecordProviderProfileViewDto {
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(160)
  clientEventId?: string;
}
