import {
  ADMIN_WEB_SESSION_DEFAULT_TTL_SECONDS,
  ADMIN_WEB_SESSION_MAX_TTL_SECONDS,
  parseAdminWebSessionTtlSeconds,
} from './admin-session';

describe('Admin Web session TTL', () => {
  it('defaults missing or invalid configuration to two hours', () => {
    expect(parseAdminWebSessionTtlSeconds(undefined)).toBe(ADMIN_WEB_SESSION_DEFAULT_TTL_SECONDS);
    expect(parseAdminWebSessionTtlSeconds('invalid')).toBe(ADMIN_WEB_SESSION_DEFAULT_TTL_SECONDS);
  });

  it('keeps the eight-hour security cap for explicit configuration', () => {
    expect(parseAdminWebSessionTtlSeconds('86400')).toBe(ADMIN_WEB_SESSION_MAX_TTL_SECONDS);
  });
});
