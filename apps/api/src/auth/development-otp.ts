import { ConfigService } from '@nestjs/config';

const DEVELOPMENT_ENVIRONMENTS = new Set(['development', 'test']);

export function developmentOtpFromConfig(config: ConfigService) {
  const environment = config.get<string>('NODE_ENV')?.trim().toLowerCase();
  const enabled = config.get<string>('MOBILE_AUTH_ALLOW_DEV_OTP')?.trim().toLowerCase() === 'true';
  if (!enabled || !environment || !DEVELOPMENT_ENVIRONMENTS.has(environment)) {
    return null;
  }

  const otp = config.get<string>('DEV_OTP')?.trim();
  return otp && /^\d{6}$/.test(otp) ? otp : null;
}
