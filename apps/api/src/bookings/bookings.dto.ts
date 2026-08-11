import {
  Allow,
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDefined,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { PaymentMethod, Prisma } from '@prisma/client';
import {
  providerCancellationReasonCodes,
  type ProviderCancellationReasonCode,
} from './provider-cancellation-reason';

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}

function numberFromFormValue(value: unknown) {
  if (typeof value === 'string' && value.trim()) {
    return Number(value);
  }
  return value;
}

export const providerBookingDetailViewEventTypes = ['heartbeat', 'closed'] as const;
export type ProviderBookingDetailViewEventType = (typeof providerBookingDetailViewEventTypes)[number];
export const preferredProviderRejectionReasonCodes = [
  'SCHEDULE_CONFLICT',
  'TOO_FAR',
  'SERVICE_UNSUPPORTED',
  'LOCATION_ACCESS_ISSUE',
  'SAFETY_OR_PERSONAL_REASON',
  'OTHER',
] as const;
export type PreferredProviderRejectionReasonCode =
  (typeof preferredProviderRejectionReasonCodes)[number];

export class CreateCustomerBookingDto {
  @IsString()
  serviceId!: string;

  @IsOptional()
  @IsString()
  providerId?: string;

  @IsOptional()
  @IsString()
  couponCode?: string;

  @ValidateIf((body: CreateCustomerBookingDto) => !body.selectedLocationId || body.address !== undefined)
  @IsDefined()
  @Allow()
  address?: Prisma.InputJsonValue;

  @ValidateIf((body: CreateCustomerBookingDto) => !body.selectedLocationId || body.lat !== undefined)
  @IsNumber()
  lat?: number;

  @ValidateIf((body: CreateCustomerBookingDto) => !body.selectedLocationId || body.lng !== undefined)
  @IsNumber()
  lng?: number;

  @IsOptional()
  @IsString()
  selectedLocationId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @IsOptional()
  @IsNumber()
  currentLat?: number;

  @IsOptional()
  @IsNumber()
  currentLng?: number;

  @IsOptional()
  @IsISO8601()
  currentLocationUpdatedAt?: string;
}

export class SelectBookingProviderDto {
  @IsString()
  providerId!: string;
}

export class RejectPreferredProviderBookingDto {
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsIn(preferredProviderRejectionReasonCodes)
  reasonCode?: PreferredProviderRejectionReasonCode;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reasonDetail?: string;
}

class ProviderBookingActionLocationDto {
  @IsNumber()
  lat!: number;

  @IsNumber()
  lng!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  addressText?: string;
}

export class CompleteProviderBookingDto extends ProviderBookingActionLocationDto {}

export class CancelProviderBookingDto extends ProviderBookingActionLocationDto {
  @Transform(({ value }) => trimString(value))
  @IsIn(providerCancellationReasonCodes)
  reasonCode!: ProviderCancellationReasonCode;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  note!: string;
}

export class CreateProviderCustomerReviewDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  comment!: string;
}

export class RecordProviderBookingDetailViewDto {
  @Transform(({ value }) => trimString(value))
  @IsIn(providerBookingDetailViewEventTypes)
  eventType!: ProviderBookingDetailViewEventType;

  @IsOptional()
  @Transform(({ value }) => numberFromFormValue(value))
  @IsInt()
  @Min(0)
  @Max(7200)
  durationSeconds?: number;
}

export class UpdateProviderBookingAlertPreferencesDto {
  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @Transform(({ value }) => numberFromFormValue(value))
  @IsNumber()
  @Min(1)
  @Max(100)
  maxDistanceKm?: number | null;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(40)
  customerGender?: string | null;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(80)
  customerNationality?: string | null;

  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  serviceIds!: string[];
}
