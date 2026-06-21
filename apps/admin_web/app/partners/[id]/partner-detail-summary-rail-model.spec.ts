import {
  buildPartnerOperationsQuickRail,
  buildPartnerOperatorFirstRead,
} from './partner-detail-summary-rail-model';

describe('partner detail summary rail model', () => {
  it('builds partner operator first-read rows', () => {
    const rows = buildPartnerOperatorFirstRead({
      backupRadiusMeters: 10000,
      bookingRecordCount: 3,
      cashDebtLabel: '50.000 VND',
      chatMessageCount: 8,
      chatRetentionRowCount: 2,
      displayLabel: 'Linh Partner',
      hasCashFeeDebt: true,
      joinedAtLabel: '10 Jun 2026, 15:00',
      latestStaffNoteDetail: '10 Jun 2026, 16:00 / Manual note',
      locationRecordedAtLabel: '10 Jun 2026, 15:30',
      nextActionDetail: 'Clear cash fee debt.',
      nextActionStatus: 'WALLET',
      noteCount: 1,
      payoutBlockerDetail: 'Bank missing',
      payoutStatus: 'Payout blocked',
      responseWindowMinutes: 10,
      userPhone: '+84900000000',
    });

    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        detail: '+84900000000 / joined 10 Jun 2026, 15:00',
        href: '#partner-master-facts',
        label: 'Identity',
        value: 'Linh Partner',
      }),
      expect.objectContaining({
        detail: '10m first-pick / 10km marketplace radius.',
        href: '#partner-booking-journey',
        label: 'Booking flow',
        value: '3 records',
      }),
      expect.objectContaining({
        detail: '50.000 VND company fee must be settled before joining.',
        href: '#cash-debt-origin',
        label: 'Marketplace access',
        value: 'Blocked by unpaid fee',
      }),
      expect.objectContaining({
        href: '#partner-ops-command-center',
        label: 'Next action',
        value: 'WALLET',
      }),
      expect.objectContaining({
        detail: '10 Jun 2026, 15:30',
        href: '#location',
        label: 'Location',
        value: 'Recorded',
      }),
    ]));
    expect(rows).toHaveLength(8);
  });

  it('builds partner operator first-read fallback rows', () => {
    const rows = buildPartnerOperatorFirstRead({
      backupRadiusMeters: 8000,
      bookingRecordCount: 0,
      cashDebtLabel: '0 VND',
      chatMessageCount: 0,
      chatRetentionRowCount: 0,
      displayLabel: 'Partner',
      hasCashFeeDebt: false,
      joinedAtLabel: 'Invalid date',
      nextActionDetail: 'Monitor.',
      nextActionStatus: 'CLEAR',
      noteCount: 0,
      payoutStatus: 'Deferred',
      responseWindowMinutes: 15,
      userPhone: null,
    });

    expect(rows.find((row) => row.label === 'Marketplace access')).toMatchObject({
      detail: 'No unpaid cash fee debt loaded.',
      value: 'Open',
    });
    expect(rows.find((row) => row.label === 'Latest staff note')).toMatchObject({
      detail: 'No manual partner note saved.',
      value: '0 note(s)',
    });
    expect(rows.find((row) => row.label === 'Location')).toMatchObject({
      detail: 'No latest partner location loaded.',
      value: 'No pin',
    });
  });

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
      expect.objectContaining({
        detail: 'Identity, wallet, booking, location, payout, legacy finance, and app reachability.',
        href: '#partner-operations-digest',
        label: 'Digest',
        value: '10 lanes',
      }),
      expect.objectContaining({
        detail: 'Booking, chat, KYC, required documents, location, wallet, payout, and notes.',
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
    expect(rows.find((row) => row.label === 'Linked records')?.detail).not.toContain('bank, tax');
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
