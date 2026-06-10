import {
  Allow,
  IsDefined,
  IsEnum,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { PaymentMethod, Prisma } from '@prisma/client';

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
