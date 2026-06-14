import { hrefsIn, textContent } from './operations-handoff-section-test-utils';
import { OperationsHandoffFinanceCloseoutSection } from './operations-handoff-finance-closeout-section';

describe('OperationsHandoffFinanceCloseoutSection', () => {
  it('renders finance rows and closeout links', () => {
    const section = OperationsHandoffFinanceCloseoutSection({
      rows: [
        {
          bookingId: 'booking-1234567890',
          createdAt: '2026-06-14T00:00:00.000Z',
          currency: 'VND',
          grossAmount: 200000,
          id: 'earning-1',
          netAmount: -50000,
          partnerName: 'Partner Linh',
          platformFee: 40000,
          providerId: 'partner-1',
          status: 'PENDING',
          statusClass: 'pill pill-danger',
          withholdingAmount: 10000,
        },
      ],
    });

    const rendered = textContent(section);

    expect(section.type).toBe('section');
    expect(rendered).toContain('Finance and chat closeout');
    expect(rendered).toContain('Partner Linh');
    expect(rendered).toContain('200.000 VND');
    expect(rendered).toContain('-50.000 VND');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining([
        '/cash-settlements',
        '/payouts',
        '/partners/partner-1',
        '/bookings/booking-1234567890',
      ]),
    );
  });

  it('renders the empty state when there are no finance rows', () => {
    const rendered = textContent(OperationsHandoffFinanceCloseoutSection({ rows: [] }));

    expect(rendered).toContain('No finance rows need handoff.');
  });
});
