import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type SmsProvider = 'dev' | 'http';

const supportedHttpSmsProviders = new Set(['http', 'vonage', 'viettel', 'fpt', 'custom']);

@Injectable()
export class OtpDeliveryService {
  private readonly logger = new Logger(OtpDeliveryService.name);

  constructor(private readonly config: ConfigService) {}

  async deliverOtp(phone: string, otp: string) {
    const provider = this.provider();
    if (provider === 'dev') {
      this.logger.log(`Dev OTP delivery prepared for ${phone}.`);
      return { provider, status: 'DELIVERED_DEV' };
    }

    return this.deliverViaHttp(phone, otp);
  }

  private async deliverViaHttp(phone: string, otp: string) {
    const url = this.config.get<string>('SMS_API_URL');
    const apiKey = this.config.get<string>('SMS_API_KEY');
    const senderId = this.config.get<string>('SMS_SENDER_ID') ?? 'MassageVN';

    if (!url || !apiKey) {
      throw new ServiceUnavailableException('SMS service is not configured');
    }

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
      const body = await response.text().catch(() => '');
      this.logger.warn(`SMS service failed with ${response.status}: ${body.slice(0, 200)}`);
      throw new ServiceUnavailableException('SMS service failed to send OTP');
    }

    return { provider: 'http', status: 'DELIVERED' };
  }

  private provider(): SmsProvider {
    const configured = this.config.get<string>('SMS_PROVIDER')?.toLowerCase();
    if (!configured || configured === 'dev') {
      return 'dev';
    }
    if (supportedHttpSmsProviders.has(configured)) {
      return 'http';
    }
    throw new ServiceUnavailableException('Unsupported SMS provider');
  }
}
