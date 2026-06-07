import { Transform, Type } from 'class-transformer';
import {
  Allow,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  Validate,
  ValidateNested,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { BookingOpsTaskStatus, BookingOpsTaskType, PayoutBatchStatus } from '@prisma/client';

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

@ValidatorConstraint({ name: 'providerPayoutDoesNotExceedCustomerPrice', async: false })
class ProviderPayoutDoesNotExceedCustomerPriceConstraint implements ValidatorConstraintInterface {
  validate(providerPayoutAmount: unknown, args: ValidationArguments) {
    const body = args.object as { customerPrice?: unknown };
    if (providerPayoutAmount === undefined || body.customerPrice === undefined) {
      return true;
    }
    return (
      typeof providerPayoutAmount === 'number' &&
      typeof body.customerPrice === 'number' &&
      providerPayoutAmount <= body.customerPrice
    );
  }

  defaultMessage() {
    return 'Partner payout amount cannot exceed customer price';
  }
}

class AdminServiceSharedPayloadDto {
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @Transform(({ value }) => numberString(value))
  @IsInt()
  @Min(1)
  @Max(1440)
  durationMin?: number;

  @IsOptional()
  @Transform(({ value }) => numberString(value))
  @IsInt()
  @Min(1)
  basePrice?: number;

  @IsOptional()
  @Transform(({ value }) => numberString(value))
  @IsInt()
  @Min(1)
  priceStep?: number;

  @IsOptional()
  @Transform(({ value }) => numberString(value))
  @IsInt()
  displayOrder?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreateAdminServiceDto extends AdminServiceSharedPayloadDto {
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(80)
  serviceGroupKey?: string;
}

export class UpdateAdminServiceDto extends AdminServiceSharedPayloadDto {
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(80)
  serviceGroupKey?: string | null;
}

class ServicePayoutRulePayloadDto {
  @IsOptional()
  @Transform(({ value }) => numberString(value))
  @IsInt()
  @Min(1)
  customerPrice?: number;

  @IsOptional()
  @Transform(({ value }) => numberString(value))
  @IsInt()
  @Min(0)
  @Validate(ProviderPayoutDoesNotExceedCustomerPriceConstraint)
  providerPayoutAmount?: number;

  @IsOptional()
  @Transform(({ value }) => numberString(value))
  @IsInt()
  @Min(0)
  @Max(10000)
  vatBps?: number;

  @IsOptional()
  @Transform(({ value }) => numberString(value))
  @IsInt()
  @Min(0)
  otherCostAmount?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class UpsertServicePayoutRuleDto extends ServicePayoutRulePayloadDto {}

export class UpdateServicePayoutRuleDto extends ServicePayoutRulePayloadDto {}

export class BulkUpsertServicePayoutRulesDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertServicePayoutRuleDto)
  rules?: UpsertServicePayoutRuleDto[];
}

export class BookingOpsNoteDto {
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(1000)
  note?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(120)
  preset?: string;
}

export class BookingOpsReasonDto {
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class BookingCloseoutDto {
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class BookingOpsTaskDto {
  @IsEnum(BookingOpsTaskType)
  type!: BookingOpsTaskType;

  @IsEnum(BookingOpsTaskStatus)
  status!: BookingOpsTaskStatus;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class UpdateOperationalPolicyDto {
  @IsOptional()
  @Allow()
  value?: unknown;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class MarkEarningPaidDto {
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(120)
  settlementRef?: string | null;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(500)
  settlementNotes?: string | null;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(80)
  settlementMethod?: string | null;
}

export class CreatePayoutBatchDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  providerProfileId!: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(120)
  transferRef?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdatePayoutBatchDto {
  @IsOptional()
  @IsEnum(PayoutBatchStatus)
  status?: PayoutBatchStatus;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(120)
  transferRef?: string | null;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}
