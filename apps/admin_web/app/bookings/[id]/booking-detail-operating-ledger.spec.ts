import type { AdminBookingDetail, AdminLocationSnapshot } from '../../../lib/admin-api';
import { bookingFinalPartnerSummary } from './booking-final-partner-summary';
import { bookingDetailOperatingLedger } from './booking-detail-operating-ledger';

function booking(input: Partial<AdminBookingDetail>): AdminBookingDetail {
  return {
    createdAt: '2026-06-14T01:00:00.000Z',
    id: 'booking-detail-operating-ledger',
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
    recordedAt: '2026-06-14T02:00:00.000Z',
    ...input,
  } as AdminLocationSnapshot;
}

function baseInput(input: AdminBookingDetail) {
  return {
    booking: input,
    finalPartnerSummary: bookingFinalPartnerSummary(input),
    participantCounts: {
      marketplace: 3,
      total: 4,
    },
    messageCount: 3,
    paymentEvidence: {
      paymentStatus: 'AUTHORIZED',
      readablePaymentMethodAmountLabel: 'CARD / 500.000 VND',
      refundRecordStatus: 'No refund record',
      refundEvidence: 'No refund record',
    },
    financeTrace: {
      customerPrice: '500.000 VND',
      platformFee: '120.000 VND',
      providerPayout: '380.000 VND',
      payoutRuleStatus: 'Rule active',
      serviceOption: 'Swedish 60m',
      walletLedger: 'No entry',
      withholding: '30.000 VND',
    },
    financeFlagCount: 0,
    latestLocation: location(),
    addressPin: '10.7627, 106.6603',
    notificationTrace: {
      rows: [{ isPartnerAlert: true }, { isPartnerAlert: false }],
      backupBatches: [{ id: 'marketplace-batch-1' }],
    },
    activityRecordCount: 9,
    operatorNoteLines: ['Customer confirmed service location.'],
    closureSummary: {
      detail: 'Closeout requirements are clear.',
      status: 'Ready',
    },
  };
}

describe('bookingDetailOperatingLedger', () => {
  it('builds operating ledger rows for linked booking evidence', () => {
    const input = booking({
      chatRoom: { id: 'chat-room-1234567890' } as AdminBookingDetail['chatRoom'],
      customerProfile: {
        id: 'customer-profile-1',
        user: {
          fullName: 'Mai Customer',
          phone: '+84000000001',
        },
      } as AdminBookingDetail['customerProfile'],
      payment: { method: 'CARD', status: 'AUTHORIZED' } as AdminBookingDetail['payment'],
      selectedProvider: {
        id: 'partner-selected',
        displayName: 'Linh Partner',
      } as AdminBookingDetail['selectedProvider'],
      taxLogs: [{}] as AdminBookingDetail['taxLogs'],
    });

    const rows = bookingDetailOperatingLedger(baseInput(input));

    expect(rows.map((row) => row.area)).toEqual([
      'Customer',
      'Partner',
      'Chat',
      'Service/Pricing',
      'Payment',
      'Refund',
      'Finance',
      'Tax',
      'Wallet',
      'Cash settlement',
      'Location',
      'Alerts',
      'Audit',
      'Operator notes',
      'Closure',
    ]);
    expect(rows.find((row) => row.area === 'Partner')).toMatchObject({
      evidence: 'Linh Partner',
      status: 'Linked',
    });
    expect(rows.find((row) => row.area === 'Chat')).toMatchObject({
      evidence: 'Room chat-roo / 3 message(s)',
      status: 'Archived',
    });
    expect(rows.find((row) => row.area === 'Tax')).toMatchObject({
      status: 'Logged',
    });
    expect(rows.find((row) => row.area === 'Refund')).toMatchObject({
      evidence: 'No refund ledger row.',
      status: 'No refund record',
    });
    expect(rows.find((row) => row.area === 'Location')).toMatchObject({
      evidence: 'Location recorded without readable address / 14 Jun 2026, 09:00',
      status: 'Partner location saved',
    });
    expect(JSON.stringify(rows)).not.toMatch(/\d{1,3}\.\d{4},\s*\d{1,3}\.\d{4}/);
  });

  it('keeps missing records and cash settlement blocks visible', () => {
    const input = booking({
      earning: {
        netAmount: -120000,
        status: 'PENDING',
      } as AdminBookingDetail['earning'],
      payment: { method: 'CASH', status: 'CAPTURED' } as AdminBookingDetail['payment'],
    });

    const rows = bookingDetailOperatingLedger({
      ...baseInput(input),
      financeTrace: {
        ...baseInput(input).financeTrace,
        walletLedger: '-120.000 VND / 1 entry',
      },
      latestLocation: null,
      operatorNoteLines: [],
    });

    expect(rows.find((row) => row.area === 'Customer')).toMatchObject({
      evidence: 'Customer / No phone',
      status: 'Missing profile',
    });
    expect(rows.find((row) => row.area === 'Partner')).toMatchObject({
      evidence: '3 marketplace / 4 total participant row(s)',
      status: 'Not selected',
    });
    expect(rows.find((row) => row.area === 'Wallet')).toMatchObject({
      evidence: '-120.000 VND / 1 entry',
      status: 'Settlement needed',
    });
    expect(rows.find((row) => row.area === 'Cash settlement')).toMatchObject({
      evidence: '120.000 VND HANDS fee / 30.000 VND withholding',
      status: 'Partner blocked until settled',
    });
    expect(rows.find((row) => row.area === 'Location')).toMatchObject({
      evidence: 'Service address record saved',
      status: 'No Partner location',
    });
    expect(JSON.stringify(rows)).not.toMatch(/\d{1,3}\.\d{4},\s*\d{1,3}\.\d{4}/);
  });
});
