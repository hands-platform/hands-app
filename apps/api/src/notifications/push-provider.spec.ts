import { resolvePushProvider } from './push-provider';

describe('push provider helpers', () => {
  it('prefers explicit notification policy overrides', () => {
    expect(resolvePushProvider({ configured: 'in_app_only', override: 'fcm' })).toBe('fcm');
    expect(resolvePushProvider({ configured: 'fcm', override: 'in_app_only' })).toBe('in_app_only');
  });

  it('normalizes configured providers with in-app delivery as the safe default', () => {
    expect(resolvePushProvider({ configured: ' FCM ' })).toBe('fcm');
    expect(resolvePushProvider({ configured: 'onesignal' })).toBe('in_app_only');
    expect(resolvePushProvider({ configured: undefined })).toBe('in_app_only');
  });
});
