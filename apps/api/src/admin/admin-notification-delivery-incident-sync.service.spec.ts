import { describe, expect, it } from 'vitest';

import {
  notificationDeliveryIncidentSyncEnabled,
  notificationDeliveryIncidentSyncGroupLimit,
  notificationDeliveryIncidentSyncIntervalMs,
} from './admin-notification-delivery-incident-sync.service';

describe('notification delivery incident automatic sync configuration', () => {
  it('enables a five-minute, ten-group bounded sync by default', () => {
    expect(notificationDeliveryIncidentSyncEnabled()).toBe(true);
    expect(notificationDeliveryIncidentSyncGroupLimit()).toBe(10);
    expect(notificationDeliveryIncidentSyncIntervalMs()).toBe(300_000);
  });

  it('allows explicit disable and rejects unsafe bounds', () => {
    expect(notificationDeliveryIncidentSyncEnabled('false')).toBe(false);
    expect(notificationDeliveryIncidentSyncGroupLimit('50')).toBe(50);
    expect(notificationDeliveryIncidentSyncIntervalMs('60000')).toBe(60_000);
    expect(() => notificationDeliveryIncidentSyncEnabled('sometimes')).toThrow(/true or false/);
    expect(() => notificationDeliveryIncidentSyncGroupLimit('51')).toThrow(/between 1 and 50/);
    expect(() => notificationDeliveryIncidentSyncIntervalMs('59999')).toThrow(/between 60000/);
  });
});
