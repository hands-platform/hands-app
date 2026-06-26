import { requestIdMiddleware } from './request-id.middleware';

describe('requestIdMiddleware', () => {
  const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);

  afterEach(() => {
    consoleLog.mockClear();
  });

  afterAll(() => {
    consoleLog.mockRestore();
  });

  it('rejects unsafe incoming request ids before writing headers or logs', () => {
    const finishCallbacks: Array<() => void> = [];
    const setHeader = vi.fn();
    const response = {
      statusCode: 200,
      setHeader,
      on: vi.fn((event: 'finish', callback: () => void) => {
        finishCallbacks.push(callback);
      }),
    };
    const request: {
      headers: Record<string, string>;
      method: string;
      originalUrl: string;
      requestId?: string;
    } = {
      method: 'GET',
      originalUrl: '/api/notifications?token=secret',
      headers: {
        'x-request-id': 'unsafe\r\nx-leaked: yes',
        'user-agent': 'jest',
      },
    };

    requestIdMiddleware(request, response, vi.fn());
    finishCallbacks[0]?.();

    const requestId = setHeader.mock.calls[0]?.[1];
    expect(requestId).toEqual(expect.any(String));
    expect(requestId).not.toContain('unsafe');
    expect(requestId).not.toContain('\r');
    expect(requestId).not.toContain('\n');
    expect(request.requestId).toBe(requestId);
    expect(consoleLog.mock.calls[0][0]).not.toContain('token=secret');
    expect(consoleLog.mock.calls[0][0]).not.toContain('x-leaked');
  });
});
