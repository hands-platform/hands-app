import { readFileSync } from 'node:fs';

import { OPERATIONAL_POLICY_KEYS } from '../../lib/operations-policy';
import { OperationsPolicyBookingCreateGateSection } from './operations-policy-booking-create-gate-section';
import { hrefsIn, normalizedTextContent } from './operations-policy-section-test-utils';

const sectionSource = readFileSync(
  new URL('./operations-policy-booking-create-gate-section.tsx', import.meta.url),
  'utf8',
);

describe('OperationsPolicyBookingCreateGateSection', () => {
  it('uses the shared AdminFormControlLink atom for evidence actions', () => {
    expect(sectionSource).toContain('AdminTableSection');
    expect(sectionSource).toContain('AdminSectionHeader');
    expect(sectionSource).toContain('AdminTraceSummary');
    expect(sectionSource).toContain('AdminFormControlLink');
    expect(sectionSource).toContain('DateTimeText');
    expect(sectionSource).toContain('StatusBadgeFromPillClass');
    expect(sectionSource).not.toContain('statusBadgeToneFromPillClass');
    expect(sectionSource).not.toContain('PillClassBadge');
    expect(sectionSource).not.toContain('<div className="service-trace-summary admin-mt-12">');
    expect(sectionSource).not.toContain('className="admin-mb-16 vuexy-booking-table-card vuexy-booking-table-group"');
    expect(sectionSource).not.toContain('<div className="ops-section-header admin-mt-18">');
    expect(sectionSource).not.toContain('<Link className="button button-secondary"');
    expect(sectionSource).not.toContain('Recorded {formatDateTime(attempt.createdAt)}');
  });

  it('renders booking gate rows and recent blocked attempts', () => {
    const section = OperationsPolicyBookingCreateGateSection({
      review: {
        currentPolicyLabel: 'Distance gates active',
        recentAttempts: [
          {
            createdAt: '2026-06-14T10:00:00.000Z',
            detail: 'Booking address was outside the enabled service area.',
            href: '/audit-log?query=BOOKING_ADDRESS_OUTSIDE_SERVICE_AREA',
            id: 'audit-booking-create-rejected-1',
            pillClass: 'pill-danger',
            reason: 'Service area',
          },
        ],
        rows: [
          {
            current: 'Required',
            defaultValue: 'Required',
            evidence: '1 reject(s)',
            gate: 'Service area',
            href: '/audit-log?query=BOOKING_ADDRESS_OUTSIDE_SERVICE_AREA',
            key: OPERATIONAL_POLICY_KEYS.bookingServiceAreaRequired,
            operatorMeaning: 'Booking address must be inside an enabled Vietnam service area.',
            pillClass: 'pill-success',
          },
        ],
        summary: [
          {
            helper: 'Recent booking create requests stopped before payment and matching.',
            label: 'Blocked attempts',
            value: '1',
          },
        ],
      },
    });

    const rendered = normalizedTextContent(section);

    expect(classNamesIn(section)).toContain(
      'card admin-section vuexy-booking-table-card vuexy-booking-table-group admin-mb-16',
    );
    expect(rendered).toContain('Booking create gate controls');
    expect(rendered).toContain('Distance gates active');
    expect(rendered).toContain('Service area');
    expect(rendered).toContain('Blocked booking create attempt');
    expect(elementTypesIn(section)).not.toContain('article');
    expect(classNamesIn(section)).toContain('operations-policy-blocked-attempt-section');
    expect(classNamesIn(section)).not.toContain('ops-task-card');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining([
        '/bookings?view=blocked-create',
        '/audit-log?query=BOOKING_ADDRESS_OUTSIDE_SERVICE_AREA',
      ]),
    );
  });

  it('renders the empty blocked-create state', () => {
    const rendered = normalizedTextContent(
      OperationsPolicyBookingCreateGateSection({
        review: {
          currentPolicyLabel: 'Distance gates active',
          recentAttempts: [],
          rows: [],
          summary: [],
        },
      }),
    );

    expect(rendered).toContain('No booking create gate rejections are currently recorded.');
    expect(sectionSource).toContain('AdminEmptyState');
    expect(sectionSource).not.toContain('<div className="empty-state');
  });

  it('does not duplicate the base pill class for gate and blocked attempt badges', () => {
    const section = OperationsPolicyBookingCreateGateSection({
      review: {
        currentPolicyLabel: 'Distance gates active',
        recentAttempts: [
          {
            createdAt: '2026-06-14T10:00:00.000Z',
            detail: 'Booking address was outside the enabled service area.',
            href: '/audit-log?query=BOOKING_ADDRESS_OUTSIDE_SERVICE_AREA',
            id: 'audit-booking-create-rejected-1',
            pillClass: 'pill pill-danger',
            reason: 'Service area',
          },
        ],
        rows: [
          {
            current: 'Required',
            defaultValue: 'Required',
            evidence: '1 reject(s)',
            gate: 'Service area',
            href: '/audit-log?query=BOOKING_ADDRESS_OUTSIDE_SERVICE_AREA',
            key: OPERATIONAL_POLICY_KEYS.bookingServiceAreaRequired,
            operatorMeaning: 'Booking address must be inside an enabled Vietnam service area.',
            pillClass: 'pill pill-success',
          },
        ],
        summary: [],
      },
    });

    const classNames = classNamesIn(section);

    expect(classNames).toContain('pill pill-success');
    expect(classNames).toContain('pill pill-danger');
    expect(classNames).not.toContain('pill pill pill-success');
    expect(classNames).not.toContain('pill pill pill-danger');
  });
});

function elementTypesIn(value: unknown): string[] {
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(elementTypesIn);
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  const type = typeof record?.type === 'string' ? [record.type] : [];
  return [...type, ...elementTypesIn(props?.children)];
}

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
