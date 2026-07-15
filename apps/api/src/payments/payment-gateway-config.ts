import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export function requiredGatewayConfig(config: ConfigService, key: string) {
  const value = config.get<string>(key)?.trim();
  if (!value) throw new ServiceUnavailableException(`${key} is not configured`);
  return value;
}

export function requiredHttpsGatewayConfig(config: ConfigService, key: string) {
  const value = requiredGatewayConfig(config, key);
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) {
      throw new Error('unsafe gateway URL');
    }
  } catch {
    throw new ServiceUnavailableException(`${key} must be a valid credential-free HTTPS URL`);
  }
  return value;
}
