import { hrefsIn, textContent } from './operations-handoff-section-test-utils';
import { OperationsHandoffCustomerPartnerSection } from './operations-handoff-customer-partner-section';

describe('OperationsHandoffCustomerPartnerSection', () => {
  it('renders Customer and Partner handoff cards with links', () => {
    const section = OperationsHandoffCustomerPartnerSection({
      customers: [
        {
          completedCount: 2,
          detail: '3 booking(s), 150.000 VND payment total, 1 saved location(s).',
          id: 'customer-1',
          lastWorkLabel: 'Last booking booking-1 / 2h ago',
          name: 'Customer Mai',
          sortTime: 1,
        },
      ],
      partners: [
        {
          action: 'Open cash settlement before marketplace alerts, participation, or payout release.',
          attention: true,
          className: 'pill pill-danger',
          detail: '2 completed booking(s), ACTIVE, location 10m ago.',
          id: 'partner-1',
          name: 'Partner Linh',
          sortPriority: 5,
          status: 'Cash settlement',
        },
      ],
    });

    const rendered = textContent(section);

    expect(section.type).toBe('section');
    expect(rendered).toContain('Customer handoff');
    expect(rendered).toContain('Customer Mai');
    expect(rendered).toContain('Partner handoff');
    expect(rendered).toContain('Partner Linh');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining(['/customers', '/customers/customer-1', '/partners', '/partners/partner-1']),
    );
  });
});
