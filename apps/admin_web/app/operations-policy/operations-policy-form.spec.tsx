import { readFileSync } from 'node:fs';

import { renderToStaticMarkup } from 'react-dom/server';

import type { AdminOperationalPolicySetting } from '../../lib/admin-api';
import { OperationsPolicyForm, validatePolicyChange } from './operations-policy-form';

const source = readFileSync(new URL('./operations-policy-form.tsx', import.meta.url), 'utf8');

describe('OperationsPolicyForm', () => {
  it('renders visible confirmation copy, bounded reason guidance, and no native validation contract', () => {
    const markup = renderToStaticMarkup(<OperationsPolicyForm setting={policySetting()} />);

    expect(markup).toContain('<form');
    expect(markup).toContain('noValidate=""');
    expect(markup).toContain('I reviewed the before and after values');
    expect(markup).toContain('admin-form-checkbox-label');
    expect(markup).not.toContain('operations-policy-confirmation-error');
    expect(markup).toContain('aria-invalid="false"');
    expect(markup).toContain('admin-form-field-help');
    expect(markup).toContain('12–500 characters');
    expect(markup).toContain('maxLength="500"');
    expect(markup).not.toContain('Additional approval');
    expect(markup).not.toContain('Not required');
  });

  it('keeps save disabled until value, reason, and confirmation are valid', () => {
    const setting = policySetting();

    expect(validatePolicyChange(setting, '10', 'Long enough reason', true).value).toContain('current value');
    expect(validatePolicyChange(setting, '12', 'short', true).reason).toContain('12 characters');
    expect(validatePolicyChange(setting, '12', 'Long enough reason', false).confirmed).toContain('Confirm');
    expect(validatePolicyChange(setting, '2', 'Long enough reason', true).value).toContain('at least 3');
    expect(validatePolicyChange(setting, '31', 'Long enough reason', true).value).toContain('no greater than 30');
    expect(validatePolicyChange(setting, '12', 'Long enough reason', true)).toEqual({});
  });

  it('includes pending, error focus, success audit link, and double-submit guards', () => {
    expect(source).toContain('useActionState');
    expect(source).toContain('disabled={!canSubmit}');
    expect(source).toContain("actionState.status === 'error'");
    expect(source).toContain('errorSummaryRef.current?.focus()');
    expect(source).toContain('Open audit record');
    expect(source).toContain('Revert to Before');
    expect(source).toContain("name=\"intent\"");
    expect(source).toContain('hasUnsavedChanges');
    expect(source).toContain('if (isPending)');
    expect(source).toContain("isPending ? 'Saving policy…'");
    expect(source).toContain("window.confirm('Discard unsaved policy change?')");
    expect(source).toContain('destination.origin !== window.location.origin');
    expect(source).not.toContain("destination.pathname !== '/operations-policy'");
    expect(source).toContain('confirmedNavigationRef.current = true');
    expect(source).toContain('if (confirmedNavigationRef.current)');
    expect(source).toContain('window.sessionStorage.setItem(draftStorageKey');
    expect(source).toContain('window.sessionStorage.removeItem(draftStorageKey)');
    expect(source).toContain('window.history.forward()');
    expect(source).toContain("event.returnValue = ''");
  });
});

function policySetting(): AdminOperationalPolicySetting {
  return {
    category: 'Matching',
    description: 'Controls the first-pick response window.',
    enforced: true,
    lifecycle: 'live',
    risk: 'low',
    blastRadius: 'Matching queue timing',
    consumerContract: {
      applicationScope: 'Matching',
      consumerIds: ['matching.service#getPolicy'],
      fallbackBehavior: 'Use default.',
      integrationTestIds: ['matching.policy.spec.ts'],
    },
    key: 'matching.provider_response_window_minutes',
    label: 'First-pick response window',
    max: 30,
    min: 3,
    recommendedValue: 10,
    unit: 'minutes',
    value: 10,
  };
}
