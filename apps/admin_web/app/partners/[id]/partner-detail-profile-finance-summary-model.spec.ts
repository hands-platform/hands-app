import {
  buildPartnerAgreementBadges,
  buildPartnerBasicProfileRows,
  buildPartnerLocationSnapshotBadges,
  buildPartnerRecentPayoutRecordLines,
} from './partner-detail-profile-finance-summary-model';

describe('partner detail profile finance summary model', () => {
  it('maps profile identity and account fields into display rows', () => {
    const rows = buildPartnerBasicProfileRows({
      activityNickname: 'Moon',
      city: 'Da Nang',
      dateOfBirth: '1995-04-03T00:00:00.000Z',
      displayName: 'Linh Tran',
      experienceYears: 4,
      facebookId: 'linh.fb',
      gender: 'FEMALE',
      id: 'provider-1',
      languages: ['vi', 'en'],
      legalName: 'Tran Linh',
      nextAvailableAt: '2026-06-13T03:15:00.000Z',
      residentialAddress: 'Hai Chau',
      reviewCount: 7,
      serviceArea: ['Da Nang'],
      serviceStyle: 'calm',
      specialties: ['Aroma'],
      status: 'APPROVED',
      trustedAt: '2026-06-12T01:00:00.000Z',
      user: {
        fullName: 'Tran Linh',
        phone: '+84000000001',
        supabaseUserId: 'supabase-user-1',
      },
    });

    expect(rows).toEqual(
      expect.arrayContaining([
        { label: 'Display name', value: 'Linh Tran' },
        { label: 'Experience', value: '4 year(s)' },
        { label: 'Phone', value: '+84000000001' },
        { label: 'Feedback records', value: '7 record(s) saved' },
        { dateValue: '2026-06-13T03:15:00.000Z', label: 'Next available' },
      ]),
    );
    expect(rows.find((row) => row.label === 'Next available')?.value).toBeUndefined();
  });

  it('maps accepted agreements and recent payout records', () => {
    const provider = {
      agreements: [
        { acceptedAt: '2026-06-10T00:00:00.000Z', id: 'agreement-1', type: 'PAYOUT', version: '1' },
      ],
      displayName: 'Linh Tran',
      earnings: [
        {
          grossAmount: 400000,
          id: 'earning-1',
          netAmount: 320000,
          platformFee: 60000,
          status: 'AVAILABLE',
          withholdingAmount: 20000,
        },
      ],
      id: 'provider-1',
      status: 'APPROVED',
    };

    expect(buildPartnerAgreementBadges(provider)).toEqual([
      { id: 'agreement-1', label: 'PAYOUT v1' },
    ]);
    expect(buildPartnerRecentPayoutRecordLines(provider)[0]).toMatchObject({
      id: 'earning-1',
      label: expect.stringContaining('AVAILABLE'),
    });
  });

  it('limits location snapshot badges to the latest five records', () => {
    const snapshots = Array.from({ length: 6 }, (_, index) => ({
      id: `snapshot-${index}`,
      lat: 16,
      lng: 108,
      recordedAt: `2026-06-${10 + index}T00:00:00.000Z`,
    }));

    expect(
      buildPartnerLocationSnapshotBadges({
        displayName: 'Linh Tran',
        id: 'provider-1',
        locationSnapshots: snapshots,
        status: 'APPROVED',
      }),
    ).toHaveLength(5);
    expect(
      buildPartnerLocationSnapshotBadges({
        displayName: 'Linh Tran',
        id: 'provider-1',
        locationSnapshots: snapshots,
        status: 'APPROVED',
      })[0],
    ).toMatchObject({
      id: 'snapshot-0',
      recordedAt: '2026-06-10T00:00:00.000Z',
    });
  });
});
