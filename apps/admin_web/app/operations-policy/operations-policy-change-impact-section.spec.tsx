import { readFileSync } from 'node:fs';

import { OperationsPolicyChangeImpactSection } from './operations-policy-change-impact-section';
import { normalizedTextContent } from './operations-policy-section-test-utils';

describe('OperationsPolicyChangeImpactSection', () => {
  it('uses shared Vuexy badge atoms for snapshot summary labels', () => {
    const source = readFileSync('app/operations-policy/operations-policy-change-impact-section.tsx', 'utf8');

    expect(source).toContain('AdminMetricGrid');
    expect(source).toContain('StatusBadge');
    expect(source).toContain('statusBadgeToneFromPillClass');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('<div className="grid admin-mt-12">');
    expect(source).not.toContain('<span className="pill pill-info">{item.scope}</span>');
  });

  it('renders policy change metrics, snapshots, rows, and cards', () => {
    const section = OperationsPolicyChangeImpactSection({
      dashboard: {
        cards: [
          {
            className: 'ops-task-done',
            detail: 'Existing bookings keep their saved expiresAt value.',
            operatorAction: 'Do not expect open countdowns to recalculate.',
            pillClass: 'pill-success',
            scope: 'New bookings',
            title: 'Response timer changes are forward-only',
          },
        ],
        metrics: [
          {
            helper: 'Existing open bookings keep their saved policy snapshot.',
            label: 'Open matching now',
            value: '2',
          },
        ],
        snapshotRows: [
          {
            liveValue: '10 min',
            operatorMeaning: 'Saved at booking open.',
            policy: 'First-pick response timer',
            savedValue: '10 min',
            scope: 'Timer / expiry',
          },
        ],
        snapshotSummary: [
          {
            helper: 'HANDS copies active matching policy into booking metadata.',
            label: 'Live policy applies to new bookings',
            scope: 'Forward-only',
            value: 'Create time snapshot',
          },
        ],
      },
      sampledBookingCount: 5,
    });

    const rendered = normalizedTextContent(section);

    expect(classNamesIn(section)).toContain('card admin-section admin-mb-16');
    expect(rendered).toContain('Policy change impact');
    expect(rendered).toContain('5 booking(s) sampled');
    expect(rendered).toContain('First-pick response timer');
    expect(rendered).toContain('Response timer changes are forward-only');
  });

  it('does not duplicate the base pill class for change impact card badges', () => {
    const section = OperationsPolicyChangeImpactSection({
      dashboard: {
        cards: [
          {
            className: 'ops-task-done',
            detail: 'Existing bookings keep their saved expiresAt value.',
            operatorAction: 'Do not expect open countdowns to recalculate.',
            pillClass: 'pill pill-success',
            scope: 'New bookings',
            title: 'Response timer changes are forward-only',
          },
        ],
        metrics: [],
        snapshotRows: [],
        snapshotSummary: [],
      },
      sampledBookingCount: 1,
    });

    expect(classNamesIn(section)).toContain('pill pill-success');
    expect(classNamesIn(section)).not.toContain('pill pill pill-success');
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
