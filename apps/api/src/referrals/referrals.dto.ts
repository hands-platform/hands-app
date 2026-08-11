import { Transform } from 'class-transformer';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

const referralPlatforms = ['android', 'ios', 'web'] as const;

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}

export class ClaimReferralCodeDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  code!: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsIn(referralPlatforms)
  platform?: (typeof referralPlatforms)[number];

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(80)
  installSource?: string;
}

export class ReferralListQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;
}
