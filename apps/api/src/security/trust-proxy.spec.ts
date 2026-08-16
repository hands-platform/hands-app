import { trustProxyFromConfig } from './trust-proxy';

describe('trustProxyFromConfig', () => {
  it('does not trust forwarded client IP headers by default', () => {
    expect(trustProxyFromConfig({ get: vi.fn() })).toBe(false);
  });

  it('accepts only an explicitly bounded proxy hop count', () => {
    expect(trustProxyFromConfig({ get: vi.fn().mockReturnValue('1') })).toBe(1);
    expect(trustProxyFromConfig({ get: vi.fn().mockReturnValue('0') })).toBe(false);
    expect(() => trustProxyFromConfig({ get: vi.fn().mockReturnValue('all') })).toThrow(
      'TRUST_PROXY_HOPS must be an integer between 0 and 3',
    );
    expect(() => trustProxyFromConfig({ get: vi.fn().mockReturnValue('4') })).toThrow(
      'TRUST_PROXY_HOPS must be an integer between 0 and 3',
    );
  });
});
