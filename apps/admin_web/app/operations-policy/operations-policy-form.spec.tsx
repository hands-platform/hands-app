import type { AdminBooking, AdminOperationalPolicySetting } from '../../lib/admin-api';
import { hrefsIn, normalizedTextContent } from './operations-policy-section-test-utils';
import { OperationsPolicyForm } from './operations-policy-form';

describe('OperationsPolicyForm', () => {
  it('renders policy status, related booking guidance, and save checks', () => {
    const setting = {
      category: 'Matching',
      description: 'Controls how customer fallback choice is handled.',
      enforced: true,
      key: 'matching.preferred_accept_mode',
      label: 'Preferred accept mode',
      options: [
        {
          label: 'Customer final confirm after accept',
          tradeoff: 'Customer chooses from accepted Partners.',
          value: 'CUSTOMER_FINAL_CONFIRM_AFTER_ACCEPT',
        },
      ],
      recommendedValue: 'CUSTOMER_FINAL_CONFIRM_AFTER_ACCEPT',
      value: 'CUSTOMER_FINAL_CONFIRM_AFTER_ACCEPT',
    } as AdminOperationalPolicySetting;

    const section = OperationsPolicyForm({ setting, bookings: [] as AdminBooking[] });
    const rendered = normalizedTextContent(section);

    expect(section.type).toBe('form');
    expect(rendered).toContain('Preferred accept mode');
    expect(rendered).toContain('Enforced');
    expect(rendered).toContain('Customer fallback-choice records');
    expect(rendered).toContain('No accepted Partner is currently waiting for customer final choice.');
    expect(rendered).toContain('Before saving this policy');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['/bookings?view=customer-choice']));
  });
});
