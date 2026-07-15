import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OtpDeliveryService } from './otp-delivery.service';

const originalFetch = global.fetch;

function config(values: Record<string, string> = {}) {
  return {
    get: vi.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

function service(values: Record<string, string> = {}) {
  return new OtpDeliveryService(config(values));
}

function mockFetch(response: Partial<Response> = { ok: true }) {
  const fetchMock = vi.fn().mockResolvedValue(response) as ReturnType<typeof vi.fn> & typeof fetch;
  global.fetch = fetchMock;
  return fetchMock;
}

describe('OtpDeliveryService', () => {
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('keeps local OTP delivery on the dev provider without calling SMS HTTP', async () => {
    const fetchMock = mockFetch();
    const logSpy = vi.spyOn(Logger.prototype, 'log').mockImplementation();

    await expect(service({ SMS_PROVIDER: 'dev' }).deliverOtp('+84900000001', '123456')).resolves.toEqual({
      provider: 'dev',
      status: 'DELIVERED_DEV',
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith('Dev OTP delivery prepared for phone ending 0001.');
    expect(logSpy.mock.calls.flat().join(' ')).not.toContain('+84900000001');
  });

  it('uses the generic HTTP SMS adapter for configured custom provider aliases', async () => {
    const fetchMock = mockFetch({ ok: true });

    await expect(
      service({
        SMS_PROVIDER: 'custom',
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

  it('uses Vonage key and secret with the form-encoded SMS API contract', async () => {
    const fetchMock = mockFetch({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(JSON.stringify({ messages: [{ status: '0' }] })),
    });

    await expect(
      service({
        SMS_PROVIDER: 'vonage',
        SMS_API_URL: 'https://rest.nexmo.com/sms/json',
        SMS_API_KEY: '51830fa7',
        SMS_API_SECRET: 'test-vonage-secret',
        SMS_SENDER_ID: 'HANDS',
      }).deliverOtp('+84900000001', '654321'),
    ).resolves.toEqual({
      provider: 'vonage',
      status: 'DELIVERED',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://rest.nexmo.com/sms/json',
      expect.objectContaining({
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
        },
        method: 'POST',
      }),
    );
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = new URLSearchParams(String(request.body));
    expect(body.get('api_key')).toBe('51830fa7');
    expect(body.get('api_secret')).toBe('test-vonage-secret');
    expect(body.get('from')).toBe('HANDS');
    expect(body.get('to')).toBe('+84900000001');
    expect(body.get('text')).toBe('Your HANDS verification code is 654321. It expires in 5 minutes.');
  });

  it.each([
    ['plain HTTP', 'http://api.example.test/sms'],
    ['an invalid URL', 'not-a-url'],
    ['URL credentials', 'https://user:password@api.example.test/sms'],
  ])('rejects %s for generic SMS before making a network request', async (_label, url) => {
    const fetchMock = mockFetch();

    await expect(
      service({
        SMS_PROVIDER: 'custom',
        SMS_API_URL: url,
        SMS_API_KEY: 'test-sms-api-key',
      }).deliverOtp('+84900000001', '123456'),
    ).rejects.toThrow('SMS service is not configured');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an unsafe Vonage URL before sending credentials', async () => {
    const fetchMock = mockFetch();

    await expect(
      service({
        SMS_PROVIDER: 'vonage',
        SMS_API_URL: 'http://rest.nexmo.com/sms/json',
        SMS_API_KEY: '51830fa7',
        SMS_API_SECRET: 'test-vonage-secret',
      }).deliverOtp('+84900000001', '123456'),
    ).rejects.toThrow('SMS service is not configured');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails safely when Vonage accepts the HTTP request but rejects the message', async () => {
    const warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation();
    mockFetch({
      ok: true,
      status: 200,
      text: vi
        .fn()
        .mockResolvedValue(
          JSON.stringify({ messages: [{ status: '4', 'error-text': 'rejected +84900000001 otp 654321' }] }),
        ),
    });

    await expect(
      service({
        SMS_PROVIDER: 'vonage',
        SMS_API_URL: 'https://rest.nexmo.com/sms/json',
        SMS_API_KEY: '51830fa7',
        SMS_API_SECRET: 'test-vonage-secret',
        SMS_SENDER_ID: 'HANDS',
      }).deliverOtp('+84900000001', '654321'),
    ).rejects.toThrow('SMS service failed to send OTP');
    const logged = warnSpy.mock.calls.flat().join(' ');
    expect(logged).toContain('Vonage SMS failed with 200.');
    expect(logged).not.toContain('+84900000001');
    expect(logged).not.toContain('654321');
  });

  it('fails generic HTTP SMS without logging provider response contents', async () => {
    const warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation();
    mockFetch({
      ok: false,
      status: 503,
      text: vi.fn().mockResolvedValue('provider rejected +84900000001 otp 654321 secret details'),
    });

    await expect(
      service({
        SMS_PROVIDER: 'custom',
        SMS_API_URL: 'https://api.example.test/sms',
        SMS_API_KEY: 'test-sms-api-key',
        SMS_SENDER_ID: 'HANDS',
      }).deliverOtp('+84900000001', '654321'),
    ).rejects.toThrow('SMS service failed to send OTP');

    const logged = warnSpy.mock.calls.flat().join(' ');
    expect(logged).toContain('SMS service failed with 503.');
    expect(logged).not.toContain('+84900000001');
    expect(logged).not.toContain('654321');
    expect(logged).not.toContain('secret details');
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
