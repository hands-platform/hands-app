import type { AdminBookingDetail, AdminLocationSnapshot } from '../../../lib/admin-api';
import type { AttentionLevel } from '../../../lib/admin-attention-flags';
import { bookingDetailMetricCards } from './booking-detail-metric-cards';

function booking(input: Partial<AdminBookingDetail>): AdminBookingDetail {
  return {
    createdAt: '2026-06-14T01:00:00.000Z',
    id: 'booking-detail-metric-cards',
    participants: [],
    status: 'MATCHED',
    ...input,
  } as AdminBookingDetail;
}

function location(input: Partial<AdminLocationSnapshot> = {}): AdminLocationSnapshot {
  return {
    id: 'location-1',
    lat: 10.7627,
    lng: 106.6603,
    providerProfileId: 'partner-1',
    recordedAt: '2999-01-01T00:00:00.000Z',
    ...input,
  } as AdminLocationSnapshot;
}

const attentionSummary: AttentionLevel = {
  helper: '1 check(s) to monitor',
  label: 'Monitor',
  tone: 'pill-warn',
};

describe('bookingDetailMetricCards', () => {
  it('builds the booking detail metric card set', () => {
    const cards = bookingDetailMetricCards({
      attentionSummary,
      booking: booking({
        chatRoom: { id: 'chat-room-1' } as AdminBookingDetail['chatRoom'],
        participants: [{ id: 'participant-1' }] as AdminBookingDetail['participants'],
        payment: {
          method: 'CARD',
          status: 'AUTHORIZED',
        } as AdminBookingDetail['payment'],
        selectedProvider: {
          id: 'partner-selected',
          displayName: 'Linh Partner',
          locationSnapshots: [location()],
        } as AdminBookingDetail['selectedProvider'],
      }),
      closureSummary: {
        detail: 'Closeout waits for service completion.',
        status: 'Not ready',
      },
      messageCount: 2,
    });

    expect(cards.map((card) => card.label)).toEqual([
      'Status',
      'Closure',
      'Payment',
      'Partners',
      'Chat',
      'Location',
      'Attention checks',
    ]);
    expect(cards.find((card) => card.label === 'Payment')).toMatchObject({
      helper: 'Hold is active; capture after service completion.',
      value: 'AUTHORIZED',
    });
    expect(cards.find((card) => card.label === 'Partners')).toMatchObject({
      helper: 'Final Partner: Linh Partner.',
      value: '1 participant row(s)',
    });
    expect(cards.find((card) => card.label === 'Location')).toMatchObject({
      helper: 'Updated just now',
      value: 'Recent',
    });
    expect(cards.find((card) => card.label === 'Attention checks')).toMatchObject({
      helper: '1 check(s) to monitor',
      value: 'Monitor',
    });
  });

  it('keeps missing payment, chat, Partner, and location copy visible', () => {
    const cards = bookingDetailMetricCards({
      attentionSummary: {
        helper: 'No active attention checks',
        label: 'Clear',
        tone: 'pill-success',
      },
      booking: booking({ status: 'OPEN_MATCHING' }),
      closureSummary: {
        detail: 'Booking is still open.',
        status: 'Open',
      },
      messageCount: 0,
    });

    expect(cards.find((card) => card.label === 'Payment')).toMatchObject({
      helper: 'No payment record created.',
      value: 'NONE',
    });
    expect(cards.find((card) => card.label === 'Partners')).toMatchObject({
      helper: 'No Partner response yet.',
      value: '0 participant row(s)',
    });
    expect(cards.find((card) => card.label === 'Chat')).toMatchObject({
      helper: '0 message(s)',
      value: 'Not ready',
    });
    expect(cards.find((card) => card.label === 'Location')).toMatchObject({
      helper: 'No Partner location shared yet',
      value: 'Missing',
    });
  });
});
