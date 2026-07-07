import {
  type PartnerActivityRecord,
  buildPartnerActivitySummary,
  buildPartnerDailyActivityDigest,
  partnerActivityRecordHref,
} from './partner-detail-activity-model';

describe('partner detail activity model', () => {
  it('summarizes partner activity records by operations domain', () => {
    const summary = buildPartnerActivitySummary([
      activity({ at: '2026-06-10T09:00:00.000Z', id: 'booking', type: 'BOOKING' }),
      activity({ at: '2026-06-10T09:10:00.000Z', id: 'chat', type: 'CHAT' }),
      activity({ at: '2026-06-10T09:20:00.000Z', id: 'device', type: 'DEVICE' }),
      activity({ at: '2026-06-10T09:30:00.000Z', id: 'earning', type: 'EARNING' }),
      activity({ at: '2026-06-10T09:40:00.000Z', id: 'kyc', type: 'VERIFY' }),
    ]);
    expect(summary.find((item) => item.label === 'Location')?.helper).toBe('Last known location records.');

    expect(summary.map((item) => [item.label, item.value])).toEqual([
      ['Range', '10 Jun 2026, 16:40'],
      ['Bookings', '1'],
      ['Chat', '1'],
      ['App and device', '1'],
      ['Location', '0'],
      ['Finance', '1'],
      ['Verification and operations', '1'],
    ]);
    const verificationSummary = summary.find((item) => item.label === 'Verification and operations');
    expect(verificationSummary?.helper).toContain('withdrawal details');
    expect(verificationSummary?.helper).toContain('optional finance records');
    expect(verificationSummary?.helper).not.toContain('bank, tax');
    expect(summary[0]).toMatchObject({
      detailDateTimePrefix: 'Oldest loaded: ',
      detailDateTimeValue: '2026-06-10T09:00:00.000Z',
      valueDateTimeValue: '2026-06-10T09:40:00.000Z',
    });
  });

  it('builds date-grouped daily digests and stable record hrefs', () => {
    const records = [
      activity({ at: '2026-06-09T09:00:00.000Z', id: 'old-booking', title: 'Old booking', type: 'BOOKING' }),
      activity({ at: '2026-06-10T09:00:00.000Z', id: 'chat', title: 'Chat', type: 'CHAT' }),
      activity({ at: '2026-06-10T10:00:00.000Z', id: 'earning', title: 'Earning', type: 'EARNING' }),
      activity({ at: '2026-06-10T11:00:00.000Z', id: 'device', title: 'Device', type: 'DEVICE' }),
    ];

    const digest = buildPartnerDailyActivityDigest(records, 'newest');
    const oldestDigest = buildPartnerDailyActivityDigest(records, 'oldest');

    expect(digest[0]).toMatchObject({
      key: '2026-06-10',
      total: 3,
      typeCounts: [
        { count: 1, type: 'CHAT' },
        { count: 1, type: 'DEVICE' },
        { count: 1, type: 'EARNING' },
      ],
    });
    expect(digest[0]?.highlights.map((record) => record.id)).toEqual(['device', 'earning', 'chat']);
    expect(oldestDigest.map((day) => day.key)).toEqual(['2026-06-09', '2026-06-10']);
    expect(oldestDigest[1]?.highlights.map((record) => record.id)).toEqual(['chat', 'earning', 'device']);
    expect(partnerActivityRecordHref(records[0])).toBe('#booking-chat-records');
    expect(partnerActivityRecordHref(records[2])).toBe('#payout');
    expect(partnerActivityRecordHref(records[3])).toBe('#app-activity');
    expect(partnerActivityRecordHref(activity({ type: 'VERIFY' }))).toBe('#documents');
  });
});

function activity(input: Partial<PartnerActivityRecord>): PartnerActivityRecord {
  return {
    at: '2026-06-10T09:00:00.000Z',
    detail: 'Activity detail',
    id: 'activity-1',
    title: 'Activity',
    type: 'BOOKING',
    ...input,
  };
}
