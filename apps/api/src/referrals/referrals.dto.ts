import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

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
