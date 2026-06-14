import { OperationsPolicyMatchingPlaybookSection } from './operations-policy-matching-playbook-section';
import { normalizedTextContent } from './operations-policy-section-test-utils';

describe('OperationsPolicyMatchingPlaybookSection', () => {
  it('renders the matching playbook timeline with Partner-facing copy', () => {
    const section = OperationsPolicyMatchingPlaybookSection({
      playbook: [
        {
          className: 'timeline-done',
          detail: 'The customer chooses a Partner profile and service option first.',
          step: '1',
          tags: [{ label: 'Direct request', tone: 'pill-success' }],
          title: 'Customer picks one first-pick Partner',
        },
      ],
    });

    const rendered = normalizedTextContent(section);

    expect(section.type).toBe('section');
    expect(rendered).toContain('Booking matching playbook');
    expect(rendered).toContain('Policy driven');
    expect(rendered).toContain('customer, Partner, finance');
    expect(rendered).toContain('Customer picks one first-pick Partner');
    expect(rendered).toContain('Direct request');
  });
});
