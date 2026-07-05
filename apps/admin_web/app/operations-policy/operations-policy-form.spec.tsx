import { readFileSync } from 'node:fs';

import type { AdminBooking, AdminOperationalPolicySetting } from '../../lib/admin-api';
import { hrefsIn, normalizedTextContent } from './operations-policy-section-test-utils';
import { OperationsPolicyForm } from './operations-policy-form';

const sectionSource = readFileSync(new URL('./operations-policy-form.tsx', import.meta.url), 'utf8');

describe('OperationsPolicyForm', () => {
  it('uses shared Vuexy badge atoms for policy form status labels', () => {
    expect(sectionSource).toContain('AdminNotePanel');
    expect(sectionSource).toContain('AdminSectionHeader');
    expect(sectionSource).toContain('StatusBadge');
    expect(sectionSource).toContain('statusBadgeToneFromPillClass');
    expect(sectionSource).not.toContain('PillClassBadge');
    expect(sectionSource).not.toContain('<div className="ops-task-note admin-mt-12">');
    expect(sectionSource).not.toContain('<div className="ops-section-header">');
    expect(sectionSource).not.toContain("<span className={`pill ${setting.enforced ? 'pill-success' : 'pill-warn'}`}>");
    expect(sectionSource).not.toContain('<span className={`pill ${pill.className}`} key={`${row.id}-${pill.label}`}>');
  });

  it('uses the shared AdminFormControlLink atom for related booking actions', () => {
    expect(sectionSource).toContain('AdminFormControlLink');
    expect(sectionSource).not.toContain('<Link className="button button-secondary"');
  });

  it('uses the shared DateTimeText atom for policy update timestamps', () => {
    expect(sectionSource).toContain('DateTimeText');
    expect(sectionSource).not.toContain("import { formatDateTime } from '../../lib/admin-format';");
    expect(sectionSource).not.toContain('return formatDateTime(value);');
  });

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
    const resolvedSection = resolveElement(section);

    expect(readRecord(resolvedSection)?.type).toBe('form');
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

    expect(sectionSource).toContain('AdminFormCard');
    expect(sectionSource).not.toContain('className="card admin-m-0"');
    expect(classNames).toContain('card admin-card admin-m-0');
    expect(classNames).toContain('admin-form-input admin-form-control-labeled admin-form-control-fluid admin-mt-12');
    expect(classNames).toContain('admin-form-textarea admin-form-control-labeled admin-form-control-fluid admin-mt-12');
    expect(classNames).toContain('card admin-card insight-card');
    expect(classNames).toContain('admin-form-control-button button button-primary admin-mt-12');
    expect(classNames).not.toContain('field');
    expect(classNames).not.toContain('operations-policy-form-field');
    expect(classNames).not.toContain('calendar-field');
    expect(sectionSource).toContain('AdminCard');
    expect(sectionSource).toContain('AdminEmptyState');
    expect(sectionSource).toContain('AdminLinkCard');
    expect(sectionSource).not.toContain('<div className="calendar-field">');
    expect(sectionSource).not.toContain('operations-policy-form-field');
    expect(sectionSource).not.toContain('<strong>No sampled record</strong>');
    expect(sectionSource).not.toContain('className="card admin-card insight-card"');
    expect(sectionSource).not.toContain('className="card admin-card insight-card" href=');
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
