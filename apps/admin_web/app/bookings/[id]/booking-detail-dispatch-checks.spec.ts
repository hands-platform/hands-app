import type { AdminBookingDetail } from '../../../lib/admin-api';
import {
  bookingDetailAttentionFlags,
  bookingDetailDispatchChecklist,
} from './booking-detail-dispatch-checks';

function booking(input: Partial<AdminBookingDetail>): AdminBookingDetail {
  return {
    createdAt: '2026-06-14T01:00:00.000Z',
    id: 'booking-detail-dispatch-checks',
    participants: [],
    status: 'CREATED',
    ...input,
  } as AdminBookingDetail;
}

describe('booking detail dispatch checks', () => {
  it('maps unresolved cancelled payment into attention flags', () => {
    const flags = bookingDetailAttentionFlags(
      booking({
        payment: {
          id: 'payment-1',
          method: 'CARD',
          status: 'AUTHORIZED',
        } as AdminBookingDetail['payment'],
        status: 'CANCELLED',
      }),
    );

    expect(flags.map((flag) => flag.title)).toEqual(
      expect.arrayContaining(['Cancelled payment unresolved', 'Payment reference missing']),
    );
    expect(flags.find((flag) => flag.title === 'Cancelled payment unresolved')).toMatchObject({
      severity: 'high',
      action: 'Release the authorization or refund before closing the ticket.',
    });
  });

  it('builds active dispatch steps from selected Partner, chat, payment, and location state', () => {
    const steps = bookingDetailDispatchChecklist(
      booking({
        chatRoom: {
          id: 'chat-room-1',
          messages: [],
        } as AdminBookingDetail['chatRoom'],
        payment: {
          id: 'payment-active',
          method: 'CARD',
          providerRef: 'auth-1',
          status: 'AUTHORIZED',
        } as AdminBookingDetail['payment'],
        selectedProvider: {
          id: 'partner-selected',
          displayName: 'Linh Partner',
          locationSnapshots: [],
          user: { phone: '+84123456789' },
        } as AdminBookingDetail['selectedProvider'],
        status: 'PROVIDER_ON_THE_WAY',
      }),
    );

    const byTitle = Object.fromEntries(steps.map((step) => [step.title, step]));

    expect(byTitle['Request Partner location']).toMatchObject({
      actionHref: 'tel:+84123456789',
      priority: 'Now',
    });
    expect(byTitle['Partner handoff locked']).toMatchObject({
      actionHref: 'tel:+84123456789',
      priority: 'Done',
    });
    expect(byTitle['Chat room ready']).toMatchObject({
      detail: 'Room chat-room-1 has 0 message(s).',
      priority: 'Done',
    });
    expect(byTitle['Payment state']).toMatchObject({
      detail: 'Hold is active; capture after service completion.',
      priority: 'Monitor',
    });
  });

  it('keeps the preferred Partner first-pick step visible while matching is open', () => {
    const steps = bookingDetailDispatchChecklist(
      booking({
        matchingEvidence: {
          finalSelection: 'FIRST_PICK_PENDING',
        } as AdminBookingDetail['matchingEvidence'],
        preferredProvider: {
          id: 'partner-preferred',
          displayName: 'Preferred Partner',
          user: { phone: '+84987654321' },
        } as AdminBookingDetail['preferredProvider'],
        status: 'OPEN_MATCHING',
      }),
    );

    expect(steps.find((step) => step.title === 'Preferred Partner response')).toMatchObject({
      actionHref: 'tel:+84987654321',
      priority: 'Now',
    });
    expect(steps.find((step) => step.title === 'Supply monitor')).toMatchObject({
      actionHref: '/partners',
      priority: 'Monitor',
    });
  });
});
