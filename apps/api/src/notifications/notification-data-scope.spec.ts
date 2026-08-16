import { describe, expect, it } from 'vitest';

import {
  notificationDataWithDeliveryContract,
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

  it('stamps the authoritative delivery intent with the runtime scope', () => {
    expect(notificationDataWithDeliveryContract(
      { bookingId: 'booking-1' },
      'PUSH_AND_IN_APP',
      'production',
    )).toEqual({
      bookingId: 'booking-1',
      dataScope: 'production',
      deliveryIntent: 'PUSH_AND_IN_APP',
    });
    expect(notificationDataWithDeliveryContract({}, 'IN_APP_ONLY', 'production')).toEqual({
      dataScope: 'production',
      deliveryIntent: 'IN_APP_ONLY',
    });
  });
});
