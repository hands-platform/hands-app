import { readFileSync } from 'node:fs';

import { OperationsPolicyMatchingStageImpactSection } from './operations-policy-matching-stage-impact-section';
import { classNamesIn, normalizedTextContent } from './operations-policy-section-test-utils';

const sectionSource = readFileSync(
  new URL('./operations-policy-matching-stage-impact-section.tsx', import.meta.url),
  'utf8',
);

describe('OperationsPolicyMatchingStageImpactSection', () => {
  it('uses shared Vuexy badge atoms for scenario labels', () => {
    expect(sectionSource).toContain('AdminNotePanel');
    expect(sectionSource).toContain('AdminTraceSummary');
    expect(sectionSource).toContain('StatusBadgeFromPillClass');
    expect(sectionSource).not.toContain('statusBadgeToneFromPillClass');
    expect(sectionSource).not.toContain('PillClassBadge');
    expect(sectionSource).not.toContain('<div className="service-trace-summary admin-mt-12">');
    expect(sectionSource).not.toContain('<div className="ops-task-note admin-mt-14">');
  });

  it('renders matching stage scenarios and usage note', () => {
    const section = OperationsPolicyMatchingStageImpactSection({
      preview: {
        currentPolicyLabel: '10m / 10 km / 30m fresh',
        rows: [
          {
            noSupply: 0,
            operatorRead: 'More bookings can expose marketplace Partner supply.',
            overdue: 1,
            pillClass: 'pill-info',
            repair: 0,
            scenario: 'Response window',
            stage1: 1,
            stage2: 2,
            stage3: 0,
            value: '10 min',
          },
        ],
        summary: [
          {
            helper: 'Bookings currently waiting inside Stage 1, Stage 2, or Stage 3.',
            label: 'Open matching sample',
            value: '3',
          },
        ],
      },
    });

    const rendered = normalizedTextContent(section);

    expect(section.props.id).toBe('matching-stage-impact');
    expect(classNamesIn(section)).toContain('card admin-section admin-mb-16');
    expect(rendered).toContain('Matching stage impact preview');
    expect(rendered).toContain('10m / 10 km / 30m fresh');
    expect(rendered).toContain('Stage 2 marketplace');
    expect(rendered).toContain('Response window');
    expect(rendered).toContain('How to use this preview');
  });

  it('does not duplicate the base pill class for scenario badges', () => {
    const section = OperationsPolicyMatchingStageImpactSection({
      preview: {
        currentPolicyLabel: '10m / 10 km / 30m fresh',
        rows: [
          {
            noSupply: 0,
            operatorRead: 'Radius change needs review.',
            overdue: 0,
            pillClass: 'pill pill-warn',
            repair: 0,
            scenario: 'Radius',
            stage1: 1,
            stage2: 2,
            stage3: 0,
            value: '10 km',
          },
        ],
        summary: [],
      },
    });

    expect(classNamesIn(section)).toContain('pill pill-warn');
    expect(classNamesIn(section)).not.toContain('pill pill pill-warn');
  });
});
