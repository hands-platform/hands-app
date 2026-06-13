import type { AdminBooking } from '../../lib/admin-api';
import {
  bookingMonitorAddressNeedsOps,
  bookingMonitorChatEvidenceNeedsOps,
  bookingMonitorDecisionEvidenceMissing,
  bookingMonitorPaymentNeedsOps,
} from './booking-monitor-ops-state-model';

const nowMs = new Date('2026-06-07T10:00:00.000Z').getTime();

describe('booking monitor ops state model', () => {
  it('detects missing address snapshots', () => {
    expect(bookingMonitorAddressNeedsOps({ id: 'booking-1' } as AdminBooking)).toBe(true);
    expect(
      bookingMonitorAddressNeedsOps({
        addressSnapshot: { id: 'address-1' },
        id: 'booking-2',
      } as unknown as AdminBooking),
    ).toBe(false);
  });

  it('detects active bookings that need payment follow-up', () => {
    expect(
      bookingMonitorPaymentNeedsOps({
        id: 'open-matching',
        status: 'OPEN_MATCHING',
      } as AdminBooking),
    ).toBe(true);
  });

  it('detects missing decision evidence for manual decision bookings', () => {
    expect(
      bookingMonitorDecisionEvidenceMissing(
        {
          id: 'no-show',
          payment: { status: 'AUTHORIZED' },
          status: 'NO_SHOW',
        } as unknown as AdminBooking,
        nowMs,
      ),
    ).toBe(true);
  });

  it('treats quiet active chat as chat evidence work', () => {
    expect(
      bookingMonitorChatEvidenceNeedsOps(
        {
          chatRoom: { id: 'chat-1', messages: [] },
          id: 'matched',
          status: 'MATCHED',
        } as unknown as AdminBooking,
        nowMs,
      ),
    ).toBe(true);
  });
});
