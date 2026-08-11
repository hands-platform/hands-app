import type { AdminBooking } from '../../lib/admin-api';
import { buildBookingMonitorListRow } from './booking-monitor-list-row-model';

const nowMs = new Date('2026-06-12T09:45:00.000Z').getTime();

describe('buildBookingMonitorListRow', () => {
  it('builds a monitor list row from booking facts', () => {
    const booking = {
      createdAt: '2026-06-12T09:40:00.000Z',
      id: 'booking-1',
      participants: [],
      status: 'OPEN_MATCHING',
    } as unknown as AdminBooking;

    const row = buildBookingMonitorListRow(booking, nowMs, nowMs);

    expect(row.booking).toBe(booking);
    expect(row.stage.key).toBe('first-pick');
    expect(row.nextActionLabel).toBe('Monitor matching');
    expect(row.nextActionHelper).toBe('Customer may keep waiting or switch to Marketplace.');
    expect(row.selection.label).toBe('No first-pick Partner');
    expect(row.serviceOptionLabel).toBe('Service pending');
  });

  it('builds queue-specific finance issues from bounded list facts', () => {
    const booking = {
      closedAt: '2026-06-12T08:45:00.000Z',
      createdAt: '2026-06-12T07:00:00.000Z',
      earning: {
        platformFeeLogs: [],
        taxLogs: [],
        walletLedgerEntries: [],
      },
      id: 'booking-closeout-1',
      participants: [],
      payment: { method: 'CARD', providerRef: null, status: 'AUTHORIZED' },
      status: 'COMPLETED',
    } as unknown as AdminBooking;

    expect(buildBookingMonitorListRow(booking, nowMs, nowMs, 'payment').issueChips).toEqual([
      { label: 'Gateway ref missing', tone: 'pill-danger' },
    ]);
    const closeoutRow = buildBookingMonitorListRow(booking, nowMs, nowMs, 'closeout');
    expect(closeoutRow.issueChips).toEqual([
      { label: 'Platform fee missing', tone: 'pill-warn' },
      { label: 'Tax missing', tone: 'pill-warn' },
      { label: 'Wallet entry missing', tone: 'pill-warn' },
    ]);
    expect(closeoutRow.terminalWaitingLabel).toBe('waiting 1h');
  });

  it('uses retained finance facts for cash commission and neutral expiry rows', () => {
    const cashBooking = {
      closedAt: '2026-06-12T08:45:00.000Z',
      createdAt: '2026-06-12T07:00:00.000Z',
      earning: { currency: 'VND', netAmount: -80_000, status: 'PENDING' },
      id: 'booking-cash-1',
      participants: [],
      payment: { currency: 'VND', method: 'CASH', status: 'CAPTURED' },
      status: 'COMPLETED',
    } as unknown as AdminBooking;
    const cashRow = buildBookingMonitorListRow(cashBooking, nowMs, nowMs, 'payment');

    expect(cashRow.issueChips).toEqual([{ label: 'Cash commission due', tone: 'pill-danger' }]);
    expect(cashRow.nextActionLabel).toBe('Settle cash commission');
    expect(cashRow.cashDebtAmountLabel).toBe('80.000 VND');

    const expiredRow = buildBookingMonitorListRow(
      {
        closedAt: '2026-06-12T08:45:00.000Z',
        id: 'booking-expired-1',
        participants: [],
        payment: { method: 'CARD', status: 'RELEASED' },
        status: 'EXPIRED',
      } as unknown as AdminBooking,
      nowMs,
      nowMs,
      'expired',
    );
    expect(expiredRow.issueChips).toEqual([{ label: 'Expired record', tone: 'pill-neutral' }]);
    expect(expiredRow.nextActionLabel).toBe('Open expired record');
  });

  it('bounds multiple payment reasons in deterministic order without a cash gateway issue', () => {
    const row = buildBookingMonitorListRow(
      {
        earning: { netAmount: -80_000, status: 'PENDING' },
        id: 'booking-cash-multi-1',
        participants: [],
        payment: {
          method: 'CASH',
          refunds: [{ status: 'PENDING' }],
          status: 'PENDING',
        },
        status: 'COMPLETED',
      } as unknown as AdminBooking,
      nowMs,
      nowMs,
      'payment',
    );

    expect(row.issueChips).toEqual([
      { label: 'Cash status pending', tone: 'pill-warn' },
      { label: 'Refund mismatch', tone: 'pill-danger' },
      { label: 'Cash commission due', tone: 'pill-danger' },
    ]);
    expect(row.issueChips).toHaveLength(3);
    expect(row.issueChips?.some((issue) => issue.label === 'Gateway ref missing')).toBe(false);
  });
});
