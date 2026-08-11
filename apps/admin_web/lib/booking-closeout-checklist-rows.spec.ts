import { bookingCloseoutChecklistRows } from './booking-closeout-checklist-rows';

const baseInput = {
  bookingId: 'booking_123',
  bookingStatus: 'MATCHED',
  addressReady: true,
  addressLabel: 'District 1, Ho Chi Minh City',
  finalPartnerId: 'partner_123',
  finalPartnerLabel: 'Linh Wellness',
  customerChoiceCandidates: 1,
  chatNeeded: true,
  chatReady: true,
  chatRoomShortId: 'room_123',
  chatMessageCount: 3,
  latestMessageAtLabel: '07 Jun 2026 10:30',
  latestMessageAtValue: '2026-06-07T03:30:00.000Z',
  cashDebt: false,
  paymentStatus: 'AUTHORIZED',
  paymentMethod: 'MOMO',
  customerPriceLabel: '450.000 VND',
  partnerPayoutLabel: '380.000 VND',
  walletLedgerLabel: 'No wallet movement',
  terminal: false,
  refundLedgerCount: 0,
  refundEvidence: 'No refund row',
  alertCount: 2,
  failedAlertCount: 0,
  closeoutStatus: 'Review',
  closeoutTone: 'pill-warn',
  closeoutHelper: 'Ready after payment capture.',
  closeoutOpenItemLabels: ['capture payment'],
  taxRows: 1,
  operatorTrailCount: 4,
  latestLocationLabel: 'District 1, Ho Chi Minh City',
  latestLocationAtLabel: '07 Jun 2026 10:31',
  latestLocationAtValue: '2026-06-07T03:31:00.000Z',
  notificationCount: 2,
};

describe('bookingCloseoutChecklistRows', () => {
  it('builds the closeout lane order used by the operations page', () => {
    const rows = bookingCloseoutChecklistRows(baseInput);

    expect(rows.map((row) => row.title)).toEqual([
      'Confirmed service address',
      'Customer final Partner choice',
      'Chat record',
      'Money and wallet gate',
      'Manual outcome evidence',
      'Finance closeout',
      'Location and alert trail',
    ]);
  });

  it('blocks closeout when the confirmed service address or required chat record is missing', () => {
    const rows = bookingCloseoutChecklistRows({
      ...baseInput,
      addressReady: false,
      finalPartnerId: null,
      finalPartnerLabel: null,
      customerChoiceCandidates: 0,
      chatReady: false,
      chatRoomShortId: null,
      chatMessageCount: 0,
      latestMessageAtLabel: null,
    });

    expect(rows[0]).toMatchObject({
      title: 'Confirmed service address',
      status: 'Repair needed',
      className: 'ops-task-blocked',
      pillClass: 'pill-danger',
    });
    expect(rows[1]).toMatchObject({
      title: 'Customer final Partner choice',
      status: 'Waiting',
      className: 'ops-task-blocked',
    });
    expect(rows[2]).toMatchObject({
      title: 'Chat record',
      status: 'Repair needed',
      href: '/bookings?view=chat-repair',
    });
  });

  it('holds final acceptance, service start, and payout release when cash debt remains', () => {
    const rows = bookingCloseoutChecklistRows({
      ...baseInput,
      cashDebt: true,
      walletLedgerLabel: 'Wallet balance -120.000 VND',
    });

    expect(rows[3]).toMatchObject({
      title: 'Money and wallet gate',
      status: 'Settlement needed',
      href: '/cash-settlements',
      className: 'ops-task-blocked',
      pillClass: 'pill-danger',
    });
    expect(rows[3].detail).toContain('Partner can view marketplace requests');
    expect(rows[3].detail).toContain('final acceptance and service start are held');
    expect(rows[3].operatorRule).toContain(
      'Cash fee debt must be resolved before final acceptance, service start, or payout batch release.',
    );
  });

  it('keeps closeout timestamps as shared Atom-ready values instead of embedding them in detail copy', () => {
    const rows = bookingCloseoutChecklistRows(baseInput);

    expect(rows[2]).toMatchObject({
      title: 'Chat record',
      detail: 'Room room_123 keeps 3 message(s); latest',
      detailDateTimeFallback: '07 Jun 2026 10:30',
      detailDateTimeSuffix: '.',
      detailDateTimeValue: '2026-06-07T03:30:00.000Z',
    });
    expect(rows[6]).toMatchObject({
      title: 'Location and alert trail',
      detail: 'District 1, Ho Chi Minh City',
      detailDateTimeFallback: '07 Jun 2026 10:31',
      detailDateTimePrefix: ' / ',
      detailDateTimeSuffix: '.',
      detailDateTimeValue: '2026-06-07T03:31:00.000Z',
    });
    expect(`${rows[2].detail} ${rows[6].detail}`).not.toContain('07 Jun 2026');
  });

  it('keeps terminal and batch evidence factual for admin decisions', () => {
    const rows = bookingCloseoutChecklistRows({
      ...baseInput,
      bookingStatus: 'CANCELLED',
      terminal: true,
      refundLedgerCount: 1,
      refundEvidence: 'Refund pending',
      closeoutTone: 'pill-success',
      closeoutOpenItemLabels: [],
      latestLocationLabel: null,
      notificationCount: 0,
      failedAlertCount: 1,
    });

    expect(rows[4]).toMatchObject({
      title: 'Manual outcome evidence',
      status: 'Terminal review',
      className: 'ops-task-warning',
      pillClass: 'pill-warn',
    });
    expect(rows[5]).toMatchObject({
      title: 'Finance closeout',
      className: 'ops-task-done',
      pillClass: 'pill-success',
    });
    expect(rows[6]).toMatchObject({
      title: 'Location and alert trail',
      status: 'Sparse',
      className: 'ops-task-warning',
    });
  });
});
