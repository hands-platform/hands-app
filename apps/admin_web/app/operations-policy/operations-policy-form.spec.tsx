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

  it('uses shared admin form atoms for editable controls', () => {
    const setting = {
      category: 'Matching',
      description: 'Controls the first-pick response window.',
      enforced: true,
      key: 'matching.first_pick_response_window_min',
      label: 'First-pick response window',
      max: 30,
      min: 1,
      recommendedValue: 10,
      unit: 'minutes',
      value: 10,
    } as AdminOperationalPolicySetting;

    const section = OperationsPolicyForm({ setting, bookings: [] as AdminBooking[] });
    const classNames = classNamesIn(section);

    expect(classNames).toContain('admin-form-input');
    expect(classNames).toContain('admin-form-textarea');
    expect(classNames).toContain('card admin-card insight-card');
    expect(classNames).toContain('admin-form-control-button button button-primary admin-mt-12');
    expect(classNames).not.toContain('field');
  });
});

function classNamesIn(value: unknown): string[] {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(classNamesIn);
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  const className = typeof props?.className === 'string' ? [props.className] : [];
  return [...className, ...classNamesIn(props?.children)];
}

function resolveElement(value: unknown): unknown {
  const record = readRecord(value);
  const props = readRecord(record?.props);
  return typeof record?.type === 'function' ? resolveElement(record.type(props)) : value;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}
