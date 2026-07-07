import { readFileSync } from 'node:fs';

import { OperationsPolicyEnforcementTraceSection } from './operations-policy-enforcement-trace-section';
import { classNamesIn, normalizedTextContent } from './operations-policy-section-test-utils';

describe('OperationsPolicyEnforcementTraceSection', () => {
  it('uses shared Vuexy badge atoms for enforcement scope labels', () => {
    const source = readFileSync('app/operations-policy/operations-policy-enforcement-trace-section.tsx', 'utf8');

    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('<span className="pill pill-success">{item.scope}</span>');
  });

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

    expect(classNamesIn(section)).toContain('card admin-section admin-mb-16');
    expect(rendered).toContain('Policy enforcement evidence');
    expect(rendered).toContain('1 enforced lane(s)');
    expect(rendered).toContain('Marketplace participation');
    expect(rendered).toContain('API touchpoint: Partner open-request list endpoint');
    expect(rendered).toContain('Server owner: Marketplace eligibility pipeline');
  });
});
