import type { AdminBooking } from '../../lib/admin-api';
import { bookingMonitorNextAction } from './booking-monitor-next-action-label';

describe('bookingMonitorNextAction', () => {
  const nowMs = Date.parse('2026-08-05T12:00:00.000Z');

  it('uses an operator action and separate helper for a live matching request', () => {
    expect(
      bookingMonitorNextAction(
        {
          createdAt: '2026-08-05T11:50:00.000Z',
          status: 'OPEN_MATCHING',
        } as unknown as AdminBooking,
        nowMs,
      ),
    ).toEqual({
      helper: 'Customer may keep waiting or switch to Marketplace.',
      label: 'Monitor matching',
    });
  });

  it('escalates matching requests after thirty minutes', () => {
    expect(
      bookingMonitorNextAction(
        {
          createdAt: '2026-08-05T11:29:59.000Z',
          status: 'OPEN_MATCHING',
        } as unknown as AdminBooking,
        nowMs,
      ),
    ).toEqual({
      helper: 'Check Partner participation and contact the customer if needed.',
      label: 'Review stalled matching',
    });
  });

  it('repairs a matched booking without chat', () => {
    expect(
      bookingMonitorNextAction(
        {
          chatRoom: null,
          status: 'MATCHED',
        } as unknown as AdminBooking,
        nowMs,
      ),
    ).toEqual({
      helper: 'Confirm the selected Partner and create or restore the chat room.',
      label: 'Repair chat handoff',
    });
  });

  it('contacts the Partner when service is past the expected end', () => {
    expect(
      bookingMonitorNextAction(
        {
          scheduledEndAt: '2026-08-05T11:59:59.000Z',
          status: 'IN_SERVICE',
        } as unknown as AdminBooking,
        nowMs,
      ),
    ).toEqual({
      helper: 'Confirm completion, then verify payment capture.',
      label: 'Contact Partner',
    });
  });

  it('keeps detailed closeout guidance as helper copy', () => {
    expect(
      bookingMonitorNextAction(
        {
          status: 'COMPLETED',
        } as unknown as AdminBooking,
        nowMs,
      ),
    ).toEqual({
      helper:
        'Completed service needs closeout reconciliation for payment, earning, tax, and wallet records.',
      label: 'Review closeout',
    });
  });

  it('prioritizes the active closeout queue reason', () => {
    const paymentBooking = {
      payment: { method: 'CARD', providerRef: null, status: 'AUTHORIZED' },
      status: 'COMPLETED',
    } as unknown as AdminBooking;
    expect(bookingMonitorNextAction(paymentBooking, nowMs, 'payment')).toEqual({
      helper: 'Open booking finance evidence and attach the missing gateway reference.',
      label: 'Add gateway reference',
    });
    expect(bookingMonitorNextAction({ status: 'COMPLETED' } as AdminBooking, nowMs, 'closeout')).toEqual({
      helper: 'Open booking finance evidence and verify the missing Partner earning.',
      label: 'Review missing earning',
    });
    expect(
      bookingMonitorNextAction(
        {
          services: [
            {
              price: 200_000,
              service: { basePrice: 100_000, payoutRules: [], priceStep: 100_000 },
            },
          ],
          status: 'COMPLETED',
        } as unknown as AdminBooking,
        nowMs,
        'pricing',
      ),
    ).toEqual({
      helper: 'Open booking finance evidence and verify the active payout rule for the booked price.',
      label: 'Review payout rule',
    });
  });

  it('explains retained cash commission and keeps expired history neutral', () => {
    const cashBooking = {
      earning: { netAmount: -80_000, status: 'PENDING' },
      payment: { method: 'CASH', status: 'CAPTURED' },
      status: 'COMPLETED',
    } as unknown as AdminBooking;

    expect(bookingMonitorNextAction(cashBooking, nowMs, 'payment')).toEqual({
      helper: 'Open booking finance evidence and reconcile the commission owed to HANDS.',
      label: 'Settle cash commission',
    });
    expect(
      bookingMonitorNextAction(
        { payment: { method: 'CARD', status: 'RELEASED' }, status: 'EXPIRED' } as AdminBooking,
        nowMs,
        'expired',
      ),
    ).toEqual({
      helper: 'Review retained terminal evidence. Expiry alone does not assign a closeout action.',
      label: 'Open expired record',
    });
  });

  it('uses the exact retained payment exception before the defensive fallback', () => {
    expect(
      bookingMonitorNextAction(
        { payment: { method: 'CASH', status: 'PENDING' }, status: 'COMPLETED' } as AdminBooking,
        nowMs,
        'payment',
      ).label,
    ).toBe('Confirm cash status');
    expect(
      bookingMonitorNextAction(
        {
          payment: { method: 'CARD', providerRef: 'gateway-ref', status: 'AUTHORIZED' },
          status: 'COMPLETED',
        } as AdminBooking,
        nowMs,
        'payment',
      ).label,
    ).toBe('Resolve authorization');
    expect(
      bookingMonitorNextAction(
        {
          payment: { method: 'CARD', refunds: [{ status: 'PENDING' }], status: 'CAPTURED' },
          status: 'COMPLETED',
        } as unknown as AdminBooking,
        nowMs,
        'payment',
      ).label,
    ).toBe('Review refund mismatch');
    expect(
      bookingMonitorNextAction(
        { payment: { method: 'CARD', status: 'PENDING' }, status: 'EXPIRED' } as AdminBooking,
        nowMs,
        'payment',
      ).label,
    ).toBe('Review payment hold');
    expect(
      bookingMonitorNextAction(
        { payment: { method: 'CARD', status: 'CAPTURED' }, status: 'COMPLETED' } as AdminBooking,
        nowMs,
        'payment',
      ).label,
    ).toBe('Review payment exception');
    expect(
      bookingMonitorNextAction(
        { payment: { method: 'MOMO', status: 'CAPTURED' }, status: 'EXPIRED' } as AdminBooking,
        nowMs,
        'refund-review',
      ).label,
    ).toBe('Review refund mismatch');
  });

  it('keeps first-pick detail out of the action label', () => {
    expect(
      bookingMonitorNextAction(
        {
        preferredProvider: { id: 'preferred-1' },
        preferredProviderId: 'preferred-1',
        status: 'OPEN_MATCHING',
        participants: [{ providerProfile: { id: 'preferred-1' }, status: 'REQUESTED' }],
        } as unknown as AdminBooking,
        nowMs,
      ).label,
    ).toBe('Monitor matching');
  });
});
