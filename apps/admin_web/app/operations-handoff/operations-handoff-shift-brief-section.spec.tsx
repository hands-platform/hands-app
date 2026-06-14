import { hrefsIn, textContent } from './operations-handoff-section-test-utils';
import { OperationsHandoffShiftBriefSection } from './operations-handoff-shift-brief-section';

describe('OperationsHandoffShiftBriefSection', () => {
  it('renders shift brief cards from count props', () => {
    const section = OperationsHandoffShiftBriefSection({
      activeBookingCount: 4,
      cashDebtPartnerCount: 2,
      customerSignalCount: 3,
      failedNotificationCount: 1,
      matchingBookingCount: 5,
      partnerIssueCount: 6,
    });

    const rendered = textContent(section);

    expect(rendered).toContain('Shift brief');
    expect(rendered).toContain('Factual queue');
    expect(rendered).toContain('5 matching wait');
    expect(rendered).toContain('6 Partner facts to check');
    expect(rendered).toContain('2 cash wallet gate(s)');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining([
        '/bookings?view=matching',
        '/partners',
        '/cash-settlements',
        '/customers',
        '/notifications?review=failed',
      ]),
    );
  });
});
