import { readFileSync } from 'node:fs';

import { OperationsPolicyFinalPartnerChoiceSection } from './operations-policy-final-partner-choice-section';
import { hrefsIn, normalizedTextContent } from './operations-policy-section-test-utils';

describe('OperationsPolicyFinalPartnerChoiceSection', () => {
  it('uses the shared AdminFormControlLink atom for the partner queue action', () => {
    const source = readFileSync(
      'app/operations-policy/operations-policy-final-partner-choice-section.tsx',
      'utf8',
    );

    expect(source).toContain('AdminSectionHeader');
    expect(source).toContain('AdminTraceSummary');
    expect(source).toContain('AdminFormControlLink');
    expect(source).toContain('StatusBadgeFromPillClass');
    expect(source).not.toContain('statusBadgeToneFromPillClass');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('<div className="service-trace-summary admin-mt-12">');
    expect(source).not.toContain('<div className="ops-section-header admin-mt-18">');
    expect(source).not.toContain('<Link className="button button-secondary"');
  });

  it('renders partner choice controls and impact link', () => {
    const section = OperationsPolicyFinalPartnerChoiceSection({
      matrix: {
        blockingCount: 2,
        sampledPartnerCount: 5,
        cards: [
          {
            className: 'ops-task-warning',
            detail: 'Direct booking requires current owner review.',
            operatorAction: 'Keep dispatch aligned before changing this value.',
            pillClass: 'pill-warn',
            status: 'Owner choice',
            title: 'Direct booking window',
          },
        ],
        impact: [
          {
            helper: 'Partners blocked by account, identity, bank, or wallet gates.',
            kind: 'risk',
            label: 'Needs follow-up',
            scope: 'Needs action',
            value: '3',
          },
        ],
        summary: [
          {
            helper: 'Choices that can change mobile booking flow.',
            label: 'Control choices',
            value: '2',
          },
        ],
      },
    });

    const rendered = normalizedTextContent(section);

    expect(classNamesIn(section)).toContain('card admin-section admin-mb-16');
    expect(rendered).toContain('Final partner choice control matrix');
    expect(rendered).toContain('2 policy deviations');
    expect(rendered).toContain('Direct booking window');
    expect(rendered).toContain('Current partner acceptance impact');
    expect(rendered).toContain('Open Partner queue');
    expect(hrefsIn(section)).toContain('/partners');
  });

  it('does not duplicate the base pill class for partner choice card badges', () => {
    const section = OperationsPolicyFinalPartnerChoiceSection({
      matrix: {
        blockingCount: 1,
        sampledPartnerCount: 0,
        cards: [
          {
            className: 'ops-task-warning',
            detail: 'Direct booking requires current owner review.',
            operatorAction: 'Keep dispatch aligned before changing this value.',
            pillClass: 'pill pill-warn',
            status: 'Owner choice',
            title: 'Direct booking window',
          },
        ],
        impact: [],
        summary: [],
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
