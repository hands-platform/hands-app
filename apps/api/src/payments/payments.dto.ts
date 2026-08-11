import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}

export class RequestRefundPaymentDto {
  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(160)
  idempotencyKey?: string;

  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class AdminPaymentActionDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(160)
  idempotencyKey!: string;

  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class RejectRefundPaymentDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MinLength(12)
  @MaxLength(500)
  reason!: string;
}
