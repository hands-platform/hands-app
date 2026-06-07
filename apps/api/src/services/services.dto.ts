import { Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

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

export class CreateServiceDto {
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(80)
  serviceGroupKey?: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(500)
  description?: string;

  @Transform(({ value }) => numberString(value))
  @IsInt()
  @Min(1)
  @Max(1440)
  durationMin!: number;

  @Transform(({ value }) => numberString(value))
  @IsInt()
  @Min(1)
  basePrice!: number;

  @IsOptional()
  @Transform(({ value }) => numberString(value))
  @IsInt()
  @Min(1)
  priceStep?: number;

  @IsOptional()
  @Transform(({ value }) => numberString(value))
  @IsInt()
  displayOrder?: number;
}
