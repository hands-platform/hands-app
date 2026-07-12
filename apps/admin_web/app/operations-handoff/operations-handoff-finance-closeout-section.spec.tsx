import { readFileSync } from 'node:fs';

import { classNamesIn, hrefsIn, textContent } from './operations-handoff-section-test-utils';
import { OperationsHandoffFinanceCloseoutSection } from './operations-handoff-finance-closeout-section';

describe('OperationsHandoffFinanceCloseoutSection', () => {
  it('uses the shared AdminTableScroll atom for finance closeout rows', () => {
    const source = readFileSync('app/operations-handoff/operations-handoff-finance-closeout-section.tsx', 'utf8');

    expect(source).toContain('AdminTableScroll');
    expect(source).toContain('AdminTextLink');
    expect(source).toContain('MoneyText');
    expect(source).toContain('StatusBadgeFromPillClass');
    expect(source).not.toContain('statusBadgeToneFromPillClass(row.statusClass)');
    expect(source).not.toContain('className="text-link"');
    expect(source).not.toContain('<div className="admin-table-scroll">');
    expect(source).not.toContain('formatMoney(');
    expect(source).not.toContain('<span className={row.statusClass}>{row.status}</span>');
  });

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
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-section operations-handoff-finance-closeout-card',
        'table vuexy-data-table vuexy-booking-table admin-data-table',
      ]),
    );
  });

  it('renders the empty state when there are no finance rows', () => {
    const rendered = textContent(OperationsHandoffFinanceCloseoutSection({ rows: [] }));

    expect(rendered).toContain('No finance history rows.');
  });
});
