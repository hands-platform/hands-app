import { ConfigService } from '@nestjs/config';
import { OtpDeliveryService } from './otp-delivery.service';

const originalFetch = global.fetch;

function config(values: Record<string, string> = {}) {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

function service(values: Record<string, string> = {}) {
  return new OtpDeliveryService(config(values));
}

function mockFetch(response: Partial<Response> = { ok: true }) {
  const fetchMock = jest.fn().mockResolvedValue(response) as jest.MockedFunction<typeof fetch>;
  global.fetch = fetchMock;
  return fetchMock;
}

describe('OtpDeliveryService', () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('keeps local OTP delivery on the dev provider without calling SMS HTTP', async () => {
    const fetchMock = mockFetch();

    await expect(service({ SMS_PROVIDER: 'dev' }).deliverOtp('+84900000001', '123456')).resolves.toEqual({
      provider: 'dev',
      status: 'DELIVERED_DEV',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses the HTTP SMS adapter for configured real provider aliases', async () => {
    const fetchMock = mockFetch({ ok: true });

    await expect(
      service({
        SMS_PROVIDER: 'vonage',
        SMS_API_URL: 'https://api.example.test/sms',
        SMS_API_KEY: 'test-sms-api-key',
        SMS_SENDER_ID: 'HANDS',
      }).deliverOtp('+84900000001', '654321'),
    ).resolves.toEqual({
      provider: 'http',
      status: 'DELIVERED',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/sms',
      expect.objectContaining({
        headers: {
          authorization: 'Bearer test-sms-api-key',
          'content-type': 'application/json',
        },
        method: 'POST',
      }),
    );
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toEqual({
      message: 'Your HANDS verification code is 654321. It expires in 5 minutes.',
      senderId: 'HANDS',
      to: '+84900000001',
    });
  });

  it('rejects unsupported SMS provider values instead of silently using dev OTP', async () => {
    const fetchMock = mockFetch();

    await expect(
      service({
        SMS_PROVIDER: 'typo-provider',
        SMS_API_URL: 'https://api.example.test/sms',
        SMS_API_KEY: 'test-sms-api-key',
      }).deliverOtp('+84900000001', '123456'),
    ).rejects.toThrow('Unsupported SMS provider');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
