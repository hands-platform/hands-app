import { describe, expect, it } from 'vitest';

import {
  notificationDataWithRuntimeScope,
  notificationRuntimeDataScope,
} from './notification-data-scope';

describe('notification data scope', () => {
  it('marks production runtime writes explicitly', () => {
    expect(notificationDataWithRuntimeScope({ bookingId: 'booking-1' }, 'production')).toEqual({
      bookingId: 'booking-1',
      dataScope: 'production',
    });
  });

  it('keeps fixture records synthetic in every runtime', () => {
    expect(notificationDataWithRuntimeScope({ smokeFixture: true }, 'production')).toEqual({
      smokeFixture: true,
      dataScope: 'synthetic',
    });
  });

  it('does not guess production for local development writes', () => {
    expect(notificationRuntimeDataScope('development')).toBe('unknown');
  });
});
