import { readFileSync } from 'node:fs';

import { OperationsPolicyActionGateChecklistSection } from './operations-policy-action-gate-checklist-section';
import { hrefsIn, normalizedTextContent } from './operations-policy-section-test-utils';

describe('OperationsPolicyActionGateChecklistSection', () => {
  it('uses shared Vuexy badge atoms for checklist status labels', () => {
    const source = readFileSync(
      'app/operations-policy/operations-policy-action-gate-checklist-section.tsx',
      'utf8',
    );

    expect(source).toContain('StatusBadge');
    expect(source).toContain('StatusBadgeFromPillClass');
    expect(source).toContain('AdminTraceSummary');
    expect(source).not.toContain('statusBadgeToneFromPillClass');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('<div className="service-trace-summary admin-mt-12">');
    expect(source).not.toContain("<span className={`pill ${allRecommended ? 'pill-success' : 'pill-warn'}`}>");
    expect(source).not.toContain('<span className="pill pill-success">Clear</span>');
  });

  it('renders policy checklist summary and action cards', () => {
    const section = OperationsPolicyActionGateChecklistSection({
      checklist: {
        alignedCount: 1,
        totalCount: 2,
        summary: [
          {
            label: 'Recommended posture',
            value: '1/2',
            helper: 'Policies aligned with current MVP operating rules.',
          },
        ],
        cards: [
          {
            className: 'ops-task-warning',
            current: 'Owner selected batch',
            detail: 'Positive partner earnings should move through payout batches.',
            href: '/operations-policy#policy-payout-batch-cycle-policy',
            operatorAction: 'Use payout batches with transfer references.',
            pillClass: 'pill-warn',
            status: 'Owner override',
            title: 'Payout batch cycle',
          },
          {
            className: 'ops-task-done',
            current: 'Admin evidence review',
            detail: 'Booking decisions keep evidence visible.',
            href: '/operations-policy#policy-decision-action-evidence-gate-mode',
            operatorAction: 'No change needed.',
            pillClass: 'pill-success',
            status: 'Recommended',
            title: 'Booking action evidence',
          },
        ],
      },
    });

    const rendered = normalizedTextContent(section);

    expect(section.type.name).toBe('AdminSection');
    expect(section.props).toMatchObject({
      className: 'admin-mb-16',
      id: 'action-gate-policy-checklist',
      title: 'Action gate policy checklist',
    });
    expect(rendered).toContain('Action gate policy checklist');
    expect(rendered).toContain('1 / 2 recommended');
    expect(rendered).toContain('Payout batch cycle');
    expect(rendered).toContain('Current: Owner selected batch');
    expect(rendered).not.toContain('Booking action evidence');
    expect(hrefsIn(section)).toContain('/operations-policy#policy-payout-batch-cycle-policy');
  });

  it('renders one clear card when every policy is recommended', () => {
    const rendered = normalizedTextContent(
      OperationsPolicyActionGateChecklistSection({
        checklist: {
          alignedCount: 1,
          totalCount: 1,
          summary: [],
          cards: [
            {
              className: 'ops-task-done',
              current: 'Admin evidence review',
              detail: 'Booking decisions keep evidence visible.',
              href: '/operations-policy#policy-decision-action-evidence-gate-mode',
              operatorAction: 'No change needed.',
              pillClass: 'pill-success',
              status: 'Recommended',
              title: 'Booking action evidence',
            },
          ],
        },
      }),
    );

    expect(rendered).toContain('1 / 1 recommended');
    expect(rendered).toContain('Action gate policies are aligned');
    expect(rendered).not.toContain('Booking action evidence');
  });

  it('does not duplicate the base pill class for action gate card badges', () => {
    const section = OperationsPolicyActionGateChecklistSection({
      checklist: {
        alignedCount: 0,
        totalCount: 1,
        summary: [],
        cards: [
          {
            className: 'ops-task-warning',
            current: 'Owner selected batch',
            detail: 'Positive partner earnings should move through payout batches.',
            href: '/operations-policy#policy-payout-batch-cycle-policy',
            operatorAction: 'Use payout batches with transfer references.',
            pillClass: 'pill pill-warn',
            status: 'Owner override',
            title: 'Payout batch cycle',
          },
        ],
      },
    });

    expect(classNamesIn(section)).toContain('pill pill-warn');
    expect(classNamesIn(section)).not.toContain('pill pill pill-warn');
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
