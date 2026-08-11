import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AllExceptionsFilter } from './all-exceptions.filter';

describe('AllExceptionsFilter', () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

  afterEach(() => {
    consoleError.mockClear();
  });

  afterAll(() => {
    consoleError.mockRestore();
  });

  it('does not expose query strings in error response paths or logs', () => {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const response = { status };
    const request = {
      method: 'GET',
      originalUrl: '/api/auth/verify-otp?phone=%2B84900000000&otp=123456',
      requestId: 'request-1',
    };
    const host = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    };

    new AllExceptionsFilter().catch(new BadRequestException('Invalid OTP'), host as never);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/api/auth/verify-otp',
        requestId: 'request-1',
      }),
    );
    expect(JSON.parse(consoleError.mock.calls[0][0] as string)).toMatchObject({
      event: 'http_exception',
      path: '/api/auth/verify-otp',
      requestId: 'request-1',
    });
    expect(consoleError.mock.calls[0][0]).not.toContain('otp=123456');
    expect(consoleError.mock.calls[0][0]).not.toContain('phone=');
  });

  it('does not expose unexpected internal error messages in responses or logs', () => {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const response = { status };
    const request = {
      method: 'POST',
      originalUrl: '/api/payments/callback',
      requestId: 'request-2',
    };
    const host = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    };

    new AllExceptionsFilter().catch(new Error('database password=super-secret leaked'), host as never);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Internal server error',
        path: '/api/payments/callback',
        requestId: 'request-2',
      }),
    );
    expect(consoleError.mock.calls[0][0]).not.toContain('super-secret');
    expect(consoleError.mock.calls[0][0]).not.toContain('password=');
  });

  it('maps Prisma missing-record errors to a safe 404 response', () => {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'POST',
          originalUrl: '/api/partner/bookings/stale-booking/detail-view',
          requestId: 'request-3',
        }),
        getResponse: () => ({ status }),
      }),
    };
    const error = new Prisma.PrismaClientKnownRequestError('Sensitive database detail', {
      code: 'P2025',
      clientVersion: 'test',
    });

    new AllExceptionsFilter().catch(error, host as never);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Not found',
        path: '/api/partner/bookings/stale-booking/detail-view',
        requestId: 'request-3',
        statusCode: 404,
      }),
    );
    expect(consoleError.mock.calls[0][0]).not.toContain('Sensitive database detail');
  });
});
