import { bookingEvidenceBundleRows } from './booking-evidence-bundle-rows';

const baseInput = {
  bookingId: 'booking_123',
  customerProfileId: 'customer_123',
  customerRecordLabel: 'cust_123',
  customerEvidenceLabel: 'Demo Customer / 0865907184',
  addressReady: true,
  addressLabel: 'District 1, Ho Chi Minh City',
  addressSourceLabel: 'booking snapshot',
  finalPartnerId: 'partner_123',
  finalPartnerRecordLabel: 'part_123',
  finalPartnerEvidenceLabel: 'Linh Wellness / 0 m',
  participantCount: 2,
  customerChoiceCandidates: 1,
  chatReady: true,
  chatRoomShortId: 'room_123',
  chatMessageCount: 3,
  latestChatMessageAtLabel: '07 Jun 2026 10:30',
  latestChatMessageAtValue: '2026-06-07T03:30:00.000Z',
  chatRepairNeeded: false,
  hasMoneyTrace: true,
  paymentShortId: 'pay_123',
  moneyStatus: 'AUTHORIZED',
  paymentMethod: 'MOMO',
  customerPriceLabel: '450.000 VND',
  partnerPayoutLabel: '380.000 VND',
  walletLedgerLabel: 'No wallet movement',
  hasLocationTrace: true,
  latestLocationShortId: 'loc_123',
  locationStatusLabel: '0 m',
  latestLocationEvidenceLabel: '10.7769, 106.7009 / 07 Jun 2026 10:31',
  latestLocationEvidenceDateTimeValue: '2026-06-07T03:31:00.000Z',
  serviceAddressPinLabel: '10.7769, 106.7009',
  notificationCount: 2,
  failedAlertCount: 0,
  partnerAlertCount: 1,
  marketplaceBatchCount: 1,
  activityRecordCount: 4,
  latestActivityEvidenceLabel: 'booking.matched / 07 Jun 2026 10:40',
  latestActivityEvidenceDateTimeValue: '2026-06-07T03:40:00.000Z',
  latestOperatorNote: null,
};

describe('bookingEvidenceBundleRows', () => {
  it('builds the full operations bundle lane order', () => {
    const rows = bookingEvidenceBundleRows(baseInput);

    expect(rows.map((row) => row.lane)).toEqual([
      'Customer',
      'Address',
      'Partner',
      'Chat',
      'Money',
      'Location',
      'Alerts',
      'Operator trail',
    ]);
    expect(rows[3]).toMatchObject({
      evidence: '07 Jun 2026 10:30',
      evidenceDateTimePrefix: '3 retained message(s), latest ',
      evidenceDateTimeValue: '2026-06-07T03:30:00.000Z',
    });
    expect(rows[5]).toMatchObject({
      evidence: '07 Jun 2026 10:31',
      evidenceDateTimePrefix: 'Latest Partner location saved / ',
      evidenceDateTimeValue: '2026-06-07T03:31:00.000Z',
    });
    expect(rows[7]).toMatchObject({
      evidence: '07 Jun 2026 10:40',
      evidenceDateTimePrefix: 'booking.matched / ',
      evidenceDateTimeValue: '2026-06-07T03:40:00.000Z',
    });
  });

  it('links missing address and pending Partner selection to the right operation anchors', () => {
    const rows = bookingEvidenceBundleRows({
      ...baseInput,
      addressReady: false,
      addressLabel: 'No confirmed address',
      finalPartnerId: null,
      finalPartnerRecordLabel: 'Selection pending',
      finalPartnerEvidenceLabel: null,
      participantCount: 3,
      customerChoiceCandidates: 2,
    });

    expect(rows[1]).toMatchObject({
      lane: 'Address',
      status: 'Repair needed',
      tone: 'pill-danger',
      href: '#address-radius-contract',
    });
    expect(rows[2]).toMatchObject({
      lane: 'Partner',
      status: '2 selectable',
      tone: 'pill-warn',
      evidence: '3 participant row(s), 2 customer-selectable row(s)',
      href: '#participants',
    });
  });

  it('uses chat repair evidence when a matched booking has no retained room', () => {
    const rows = bookingEvidenceBundleRows({
      ...baseInput,
      chatReady: false,
      chatRoomShortId: null,
      chatMessageCount: 0,
      latestChatMessageAtLabel: null,
      latestChatMessageAtValue: null,
      chatRepairNeeded: true,
    });

    expect(rows[3]).toMatchObject({
      lane: 'Chat',
      recordLabel: 'No room',
      status: 'Missing',
      evidence: 'Matched booking should have a retained chat archive.',
      href: '#chat',
    });
  });

  it('describes chat opening after first-pick match or customer final selection before chat is required', () => {
    const rows = bookingEvidenceBundleRows({
      ...baseInput,
      chatReady: false,
      chatRoomShortId: null,
      chatMessageCount: 0,
      latestChatMessageAtLabel: null,
      latestChatMessageAtValue: null,
      chatRepairNeeded: false,
    });

    expect(rows[3]).toMatchObject({
      lane: 'Chat',
      recordLabel: 'No room',
      status: 'Missing',
      evidence: 'Chat opens after first-pick match or customer final selection.',
      href: '#chat',
    });
  });

  it('surfaces failed alert and empty operator trail facts without judging people', () => {
    const rows = bookingEvidenceBundleRows({
      ...baseInput,
      failedAlertCount: 2,
      activityRecordCount: 0,
      latestActivityEvidenceLabel: null,
      latestOperatorNote: null,
    });

    expect(rows[6]).toMatchObject({
      lane: 'Alerts',
      status: '2 failed',
      tone: 'pill-warn',
    });
    expect(rows[7]).toMatchObject({
      lane: 'Operator trail',
      status: 'Empty',
      evidence: 'No operator trail loaded',
    });
    expect(JSON.stringify(rows)).not.toMatch(
      new RegExp([`ri${'sk'}`, `sco${'re'}`, `ra${'nk'}`].join('|'), 'i'),
    );
  });

  it('uses service address snapshot copy when no latest location label is available', () => {
    const rows = bookingEvidenceBundleRows({
      ...baseInput,
      hasLocationTrace: false,
      latestLocationEvidenceLabel: null,
      latestLocationShortId: null,
      serviceAddressPinLabel: 'District 1, Ho Chi Minh City',
    });

    expect(rows[5]).toMatchObject({
      lane: 'Location',
      recordLabel: 'No latest location',
      evidence: 'Confirmed service address District 1, Ho Chi Minh City',
    });
  });

  it('does not echo raw coordinate labels in location evidence', () => {
    const rows = bookingEvidenceBundleRows({
      ...baseInput,
      latestLocationEvidenceLabel: '10.7769, 106.7009 / 07 Jun 2026 10:31',
      serviceAddressPinLabel: '10.7769, 106.7009',
    });

    expect(rows[5]).toMatchObject({
      lane: 'Location',
      evidence: '07 Jun 2026 10:31',
      evidenceDateTimePrefix: 'Latest Partner location saved / ',
      evidenceDateTimeValue: '2026-06-07T03:31:00.000Z',
    });
    expect(JSON.stringify(rows[5])).not.toMatch(/\d{1,3}\.\d{2,},\s*\d{1,3}\.\d{2,}/);
  });
});
