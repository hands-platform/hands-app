import { Allow, IsDefined, IsEnum, IsISO8601, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';
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

  @IsDefined()
  @Allow()
  address!: Prisma.InputJsonValue;

  @IsNumber()
  lat!: number;

  @IsNumber()
  lng!: number;

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
