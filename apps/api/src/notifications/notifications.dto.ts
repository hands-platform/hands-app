import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

const devicePlatforms = ['ios', 'android', 'web'] as const;

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}

export class RegisterDeviceTokenDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  token!: string;

  @IsIn(devicePlatforms)
  platform!: (typeof devicePlatforms)[number];
}
