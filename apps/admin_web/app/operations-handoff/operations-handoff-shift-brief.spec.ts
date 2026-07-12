import { buildShiftBriefItems } from './operations-handoff-shift-brief';

describe('operations history period brief model', () => {
  it('builds top-level period summary cards with Partner-facing copy', () => {
    const items = buildShiftBriefItems({
      activeBookings: 4,
      cashDebtPartners: 2,
      customerSignalCount: 3,
      failedNotificationCount: 1,
      matchingBookings: 5,
      partnerIssueCount: 6,
    });

    expect(items).toEqual([
      expect.objectContaining({
        owner: 'Dispatch',
        title: '5 matching wait',
        detail: '4 active booking(s) need status continuity in this period.',
        className: 'signal signal-warn',
      }),
      expect.objectContaining({
        owner: 'Partner Ops',
        title: '6 Partner facts to check',
        className: 'signal signal-warn',
      }),
      expect.objectContaining({
        owner: 'Finance',
        title: '2 cash wallet gate(s)',
        className: 'signal signal-danger',
      }),
      expect.objectContaining({
        owner: 'Support',
        title: '3 recent customer record(s)',
        className: 'signal signal-info',
      }),
      expect.objectContaining({
        owner: 'Alerts',
        title: '1 failed delivery row(s)',
        className: 'signal signal-warn',
      }),
    ]);
  });

  it('marks clear lanes with ok class when no urgent count is present', () => {
    const [dispatch, partnerOps, finance, , alerts] = buildShiftBriefItems({
      activeBookings: 0,
      cashDebtPartners: 0,
      customerSignalCount: 0,
      failedNotificationCount: 0,
      matchingBookings: 0,
      partnerIssueCount: 0,
    });

    expect(dispatch.className).toBe('signal signal-ok');
    expect(partnerOps.className).toBe('signal signal-ok');
    expect(finance.className).toBe('signal signal-ok');
    expect(alerts.className).toBe('signal signal-ok');
  });
});
