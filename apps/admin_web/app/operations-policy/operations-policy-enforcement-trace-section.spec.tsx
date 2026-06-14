import { OperationsPolicyEnforcementTraceSection } from './operations-policy-enforcement-trace-section';
import { normalizedTextContent } from './operations-policy-section-test-utils';

describe('OperationsPolicyEnforcementTraceSection', () => {
  it('renders enforced lanes with API and server ownership', () => {
    const section = OperationsPolicyEnforcementTraceSection({
      trace: [
        {
          api: 'Partner open-request list endpoint',
          detail: 'Marketplace Partners are prioritized by booking-address distance.',
          scope: 'Marketplace participation',
          server: 'Marketplace eligibility pipeline',
          title: '10 km marketplace alert policy',
          verify: 'Verify from Operations Policy simulator.',
        },
      ],
    });

    const rendered = normalizedTextContent(section);

    expect(section.type).toBe('section');
    expect(rendered).toContain('Policy enforcement trace');
    expect(rendered).toContain('1 enforced lane(s)');
    expect(rendered).toContain('Marketplace participation');
    expect(rendered).toContain('API touchpoint: Partner open-request list endpoint');
    expect(rendered).toContain('Server owner: Marketplace eligibility pipeline');
  });
});
