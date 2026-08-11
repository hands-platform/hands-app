import { readFileSync } from 'node:fs';

import { renderToStaticMarkup } from 'react-dom/server';

import type { AdminOperationalPolicySetting } from '../../lib/admin-api';
import { OperationsPolicyForm } from './operations-policy-form';

const source = readFileSync(new URL('./operations-policy-form.tsx', import.meta.url), 'utf8');

describe('OperationsPolicyForm', () => {
  it('renders one bounded policy change review with before, after and effective time', () => {
    const markup = renderToStaticMarkup(<OperationsPolicyForm setting={policySetting()} />);

    expect(markup).toContain('<form');
    expect(markup).toContain('Change First-pick response window');
    expect(markup).toContain('Before');
    expect(markup).toContain('After');
    expect(markup).toContain('Operating impact');
    expect(markup).toContain('Effective');
    expect(markup).toContain('Immediately after save');
    expect(markup).toContain('Additional approval');
    expect(markup).toContain('Not required');
    expect(markup).toContain('Change reason');
    expect(markup).toContain('Save policy change');
    expect(markup).toContain('href="/operations-policy"');
  });

  it('requires the current value and an explicit operator confirmation', () => {
    const markup = renderToStaticMarkup(<OperationsPolicyForm setting={policySetting()} />);

    expect(markup).toContain('name="expectedValue" value="10"');
    expect(markup).toContain('required="" type="checkbox" name="confirmed" value="yes"');
    expect(markup).toContain('I reviewed the before and after values');
    expect(source).toContain('Only an operator with System Policy write access');
  });

  it('does not render booking samples or repeated inline diagnostics in the change form', () => {
    expect(source).not.toContain('AdminInsightCard');
    expect(source).not.toContain('AdminInsightLinkCard');
    expect(source).not.toContain('Related booking records');
    expect(source).not.toContain('Before saving this policy');
    expect(source).not.toContain('policyRelatedBookingRecords');
  });
});

function policySetting(): AdminOperationalPolicySetting {
  return {
    category: 'Matching',
    description: 'Controls the first-pick response window.',
    enforced: true,
    key: 'matching.provider_response_window_minutes',
    label: 'First-pick response window',
    max: 30,
    min: 3,
    recommendedValue: 10,
    unit: 'minutes',
    value: 10,
  };
}
