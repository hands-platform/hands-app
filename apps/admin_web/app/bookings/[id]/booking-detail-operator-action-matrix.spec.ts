import type { AdminBookingDetail } from '../../../lib/admin-api';
import { bookingDetailOperatorActionMatrix } from './booking-detail-operator-action-matrix';

function booking(input: Partial<AdminBookingDetail>): AdminBookingDetail {
  return {
    createdAt: '2026-06-14T01:00:00.000Z',
    id: 'booking-detail-operator-action-matrix',
    participants: [],
    status: 'OPEN_MATCHING',
    ...input,
  } as AdminBookingDetail;
}

function actionRowsByName(bookingInput: Partial<AdminBookingDetail>) {
  const rows = bookingDetailOperatorActionMatrix(booking(bookingInput));

  return Object.fromEntries(rows.map((row) => [row.action, row]));
}

describe('bookingDetailOperatorActionMatrix', () => {
  it('maps authorized gateway payment into sync and capture actions', () => {
    const rows = actionRowsByName({
      payment: {
        amount: 450000,
        currency: 'VND',
        id: 'payment-1',
        method: 'CARD',
        providerRef: 'gateway-123',
        status: 'AUTHORIZED',
      } as AdminBookingDetail['payment'],
      status: 'COMPLETED',
    });

    expect(rows['Payment sync']).toMatchObject({
      available: true,
      evidence: 'AUTHORIZED / gateway ref gateway-123',
      tone: 'pill-info',
    });
    expect(rows['Capture payment']).toMatchObject({
      available: true,
      evidence: 'COMPLETED / 450.000 VND authorized',
      tone: 'pill-warn',
    });
    expect(rows['Release or refund']).toMatchObject({
      available: true,
      evidence: 'COMPLETED / payment AUTHORIZED.',
    });
  });

  it('maps cash fee debt into the settlement action', () => {
    const rows = actionRowsByName({
      earning: {
        currency: 'VND',
        netAmount: -120000,
        status: 'PENDING',
      } as AdminBookingDetail['earning'],
      payment: {
        amount: 600000,
        currency: 'VND',
        id: 'payment-cash',
        method: 'CASH',
        status: 'CAPTURED',
      } as AdminBookingDetail['payment'],
    });

    expect(rows['Settle cash fee debt']).toMatchObject({
      available: true,
      evidence: '120.000 VND keeps final acceptance, service start, and payout release blocked.',
      tone: 'pill-danger',
    });
  });

  it('keeps completed closeout available until finance evidence is reconciled', () => {
    const rows = actionRowsByName({
      earning: {
        platformFeeLogs: [],
        taxLogs: [],
        walletLedgerEntries: [],
      } as unknown as AdminBookingDetail['earning'],
      payment: {
        id: 'payment-captured',
        method: 'CARD',
        status: 'CAPTURED',
      } as AdminBookingDetail['payment'],
      status: 'COMPLETED',
    });

    expect(rows['Reconcile completed booking']).toMatchObject({
      available: true,
      evidence: 'Completed closeout needs reconciliation',
      href: '#completed-closeout',
      tone: 'pill-warn',
    });
  });

  it('maps refund rows, expiry, no-show, and retained note lines', () => {
    const rows = actionRowsByName({
      expiresAt: '2026-06-14T01:30:00.000Z',
      notes: 'Called customer\n\nPartner waiting',
      payment: {
        id: 'payment-refund',
        method: 'CARD',
        refunds: [{ id: 'refund-1' }, { id: 'refund-2' }],
        status: 'AUTHORIZED',
      } as AdminBookingDetail['payment'],
      status: 'OPEN_MATCHING',
    });

    expect(rows['Release or refund']).toMatchObject({
      available: true,
      evidence: '2 refund row(s) already recorded.',
    });
    expect(rows['Expire matching']).toMatchObject({
      available: true,
      href: '#matching-expiry',
    });
    expect(rows['Mark no-show']).toMatchObject({
      available: true,
      href: '#no-show-handling',
    });
    expect(rows['Add operator note']).toMatchObject({
      available: true,
      evidence: '2 note line(s) currently retained.',
    });
  });
});
