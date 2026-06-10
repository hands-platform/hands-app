import { buildPartnerOperationsQuickRail } from './partner-detail-summary-rail-model';

describe('partner detail summary rail model', () => {
  it('builds partner operations quick rail shortcuts', () => {
    const rows = buildPartnerOperationsQuickRail({
      activityRecordCount: 12,
      activityTypeLabel: 'All activity',
      backupRadiusMeters: 10000,
      bookingJourneyRowCount: 4,
      cashDebtLabel: '50.000 VND',
      chatRetentionRowCount: 2,
      connectedRecordLinkCount: 9,
      dateFilterLabel: 'Last 7 days',
      missingKycDocumentCount: 1,
      openCashDebtEarningCount: 1,
      operationsDigestCount: 10,
      payoutStatus: 'Payout blocked',
      responseWindowMinutes: 10,
      unpaidNetDetail: '120.000 VND',
    });

    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ href: '#partner-operations-digest', label: 'Digest', value: '10 lanes' }),
      expect.objectContaining({
        href: '#partner-connected-operations-records',
        label: 'Linked records',
        value: '9 links',
      }),
      expect.objectContaining({
        detail: '10m first-pick / 10km marketplace policy.',
        href: '#partner-booking-journey',
        label: 'Booking journey',
        value: '4',
      }),
      expect.objectContaining({
        href: '#cash-debt-origin',
        label: 'Cash debt',
        value: '50.000 VND',
      }),
      expect.objectContaining({
        detail: '120.000 VND',
        href: '#payout',
        label: 'Payout',
        value: 'Payout blocked',
      }),
      expect.objectContaining({
        detail: 'Last 7 days, All activity.',
        href: '#app-activity',
        label: 'Activity',
        value: '12',
      }),
    ]));
    expect(rows).toHaveLength(8);
  });

  it('falls back when unpaid net detail is missing', () => {
    const rows = buildPartnerOperationsQuickRail({
      activityRecordCount: 0,
      activityTypeLabel: 'Ops',
      backupRadiusMeters: 8000,
      bookingJourneyRowCount: 0,
      cashDebtLabel: '0 VND',
      chatRetentionRowCount: 0,
      connectedRecordLinkCount: 0,
      dateFilterLabel: 'Today',
      missingKycDocumentCount: 3,
      openCashDebtEarningCount: 0,
      operationsDigestCount: 0,
      payoutStatus: 'Deferred',
      responseWindowMinutes: 15,
    });

    expect(rows.find((row) => row.label === 'Payout')).toMatchObject({
      detail: 'No unpaid net.',
      value: 'Deferred',
    });
    expect(rows.find((row) => row.label === 'Booking journey')).toMatchObject({
      detail: '15m first-pick / 8km marketplace policy.',
    });
  });
});
