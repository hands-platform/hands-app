import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { developmentOtpFromConfig } from './development-otp';

type SmsProvider = 'dev' | 'http' | 'vonage';

const supportedHttpSmsProviders = new Set(['http', 'viettel', 'fpt', 'custom']);

@Injectable()
export class OtpDeliveryService {
  private readonly logger = new Logger(OtpDeliveryService.name);

  constructor(private readonly config: ConfigService) {}

  async deliverOtp(phone: string, otp: string) {
    const provider = this.provider();
    if (provider === 'dev') {
      this.logger.log(`Dev OTP delivery prepared for phone ending ${phoneLogSuffix(phone)}.`);
      return { provider, status: 'DELIVERED_DEV' };
    }
    if (provider === 'vonage') {
      return this.deliverViaVonage(phone, otp);
    }

    return this.deliverViaHttp(phone, otp);
  }

  private async deliverViaHttp(phone: string, otp: string) {
    const configuredUrl = this.config.get<string>('SMS_API_URL');
    const apiKey = this.config.get<string>('SMS_API_KEY');
    const senderId = this.config.get<string>('SMS_SENDER_ID') ?? 'HANDS';

    if (!configuredUrl || !apiKey) {
      throw new ServiceUnavailableException('SMS service is not configured');
    }
    const url = requiredHttpsSmsUrl(configuredUrl);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        to: phone,
        senderId,
        message: `Your HANDS verification code is ${otp}. It expires in 5 minutes.`,
      }),
    });

    if (!response.ok) {
      this.logger.warn(`SMS service failed with ${response.status}.`);
      throw new ServiceUnavailableException('SMS service failed to send OTP');
    }

    return { provider: 'http', status: 'DELIVERED' };
  }

  private async deliverViaVonage(phone: string, otp: string) {
    const configuredUrl = this.config.get<string>('SMS_API_URL');
    const apiKey = this.config.get<string>('SMS_API_KEY');
    const apiSecret = this.config.get<string>('SMS_API_SECRET');
    const senderId = this.config.get<string>('SMS_SENDER_ID') ?? 'HANDS';

    if (!configuredUrl || !apiKey || !apiSecret) {
      throw new ServiceUnavailableException('SMS service is not configured');
    }
    const url = requiredHttpsSmsUrl(configuredUrl);

    const body = new URLSearchParams({
      api_key: apiKey,
      api_secret: apiSecret,
      from: senderId,
      text: `Your HANDS verification code is ${otp}. It expires in 5 minutes.`,
      to: phone,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const responseBody = await response.text().catch(() => '');
    if (!response.ok || !vonageSmsAccepted(responseBody)) {
      this.logger.warn(`Vonage SMS failed with ${response.status}.`);
      throw new ServiceUnavailableException('SMS service failed to send OTP');
    }

    return { provider: 'vonage', status: 'DELIVERED' };
  }

  private provider(): SmsProvider {
    const configured = this.config.get<string>('SMS_PROVIDER')?.trim().toLowerCase();
    if (!configured || configured === 'dev') {
      if (!developmentOtpFromConfig(this.config)) {
        throw new ServiceUnavailableException('SMS service is not configured');
      }
      return 'dev';
    }
    if (configured === 'vonage') {
      return 'vonage';
    }
    if (supportedHttpSmsProviders.has(configured)) {
      return 'http';
    }
    throw new ServiceUnavailableException('Unsupported SMS provider');
  }
}

function requiredHttpsSmsUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) {
      throw new Error('Unsafe SMS API URL');
    }
    return value;
  } catch {
    throw new ServiceUnavailableException('SMS service is not configured');
  }
}

function phoneLogSuffix(phone: string) {
  const digits = phone.replace(/\D/g, '');
  return digits.slice(-4) || 'unknown';
}

function vonageSmsAccepted(body: string) {
  if (!body) {
    return true;
  }

  try {
    const parsed = JSON.parse(body) as { messages?: Array<{ status?: string | number }> };
    const messages = parsed.messages ?? [];
    return messages.length === 0 || messages.every((message) => String(message.status) === '0');
  } catch {
    return true;
  }
}
