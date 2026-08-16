import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

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

export class CreateProviderWalletWithdrawalRequestDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @Matches(/^[A-Za-z0-9:_-]{8,128}$/u, { message: 'idempotencyKey must be a stable request key' })
  idempotencyKey!: string;

  @Transform(({ value }) => numberString(value))
  @IsInt()
  @Min(1)
  amount!: number;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(128)
  bankAccountId?: string | null;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(500)
  requestNote?: string | null;
}
