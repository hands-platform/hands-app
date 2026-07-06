import { readFileSync } from 'node:fs';

import { OperationsPolicyOutcomeEffectSection } from './operations-policy-outcome-effect-section';
import { classNamesIn, normalizedTextContent } from './operations-policy-section-test-utils';

const sectionSource = readFileSync(
  new URL('./operations-policy-outcome-effect-section.tsx', import.meta.url),
  'utf8',
);

describe('OperationsPolicyOutcomeEffectSection', () => {
  it('uses shared Vuexy badge atoms for outcome labels', () => {
    expect(sectionSource).toContain('AdminTraceSummary');
    expect(sectionSource).toContain('StatusBadgeFromPillClass');
    expect(sectionSource).not.toContain('statusBadgeToneFromPillClass');
    expect(sectionSource).not.toContain('PillClassBadge');
    expect(sectionSource).not.toContain('<div className="service-trace-summary admin-mt-12">');
  });

  it('renders policy outcome rows and cards', () => {
    const section = OperationsPolicyOutcomeEffectSection({
      analysis: {
        cards: [
          {
            className: 'ops-task-done',
            detail: 'Snapshots are ready for comparison.',
            operatorAction: 'Use these cohorts before changing policy.',
            pillClass: 'pill-success',
            scope: 'Evidence',
            title: 'Policy snapshots are measurable',
          },
        ],
        metrics: [
          {
            helper: '2/3 sampled booking(s) reached a selected or active Partner.',
            label: 'Matched rate',
            value: '67%',
          },
        ],
        rows: [
          {
            avgBackupInvites: '2 partner(s)',
            avgParticipants: '3 partner(s)',
            completedRate: '33%',
            key: 'Marketplace policy:10 km',
            matchedRate: '67%',
            outcomeDetail: '0 closed outcome(s) to review / live value now 10 km.',
            outcomeLabel: 'On track',
            outcomePill: 'pill-success',
            operatorRead: 'This cohort is currently performing at or above average.',
            policy: 'Marketplace policy',
            sample: '3 booking(s)',
            sampleRaw: 3,
            value: '10 km',
          },
        ],
        sampleCount: 3,
      },
    });

    const rendered = normalizedTextContent(section);

    expect(classNamesIn(section)).toContain('card admin-section admin-mb-16');
    expect(rendered).toContain('Policy outcome effect');
    expect(rendered).toContain('3 booking(s) with saved policy');
    expect(rendered).toContain('Matched rate');
    expect(rendered).toContain('Marketplace policy');
    expect(rendered).toContain('Policy snapshots are measurable');
  });

  it('renders the empty state when no cohorts exist', () => {
    const rendered = normalizedTextContent(
      OperationsPolicyOutcomeEffectSection({
        analysis: {
          cards: [],
          metrics: [],
          rows: [],
          sampleCount: 0,
        },
      }),
    );

    expect(rendered).toContain('0 booking(s) with saved policy');
    expect(rendered).toContain('No policy snapshots are available yet');
    expect(rendered).toContain('Partners accept, reject, or complete');
  });

  it('does not duplicate the base pill class for outcome row and card badges', () => {
    const section = OperationsPolicyOutcomeEffectSection({
      analysis: {
        cards: [
          {
            className: 'ops-task-warning',
            detail: 'Review snapshots before policy change.',
            operatorAction: 'Keep the current policy until enough samples exist.',
            pillClass: 'pill pill-warn',
            scope: 'Review',
            title: 'Policy change needs evidence',
          },
        ],
        metrics: [],
        rows: [
          {
            avgBackupInvites: '2 partner(s)',
            avgParticipants: '3 partner(s)',
            completedRate: '33%',
            key: 'Marketplace policy:10 km',
            matchedRate: '67%',
            outcomeDetail: 'Review before changing live value.',
            outcomeLabel: 'Needs review',
            outcomePill: 'pill pill-info',
            operatorRead: 'This cohort needs more evidence.',
            policy: 'Marketplace policy',
            sample: '3 booking(s)',
            sampleRaw: 3,
            value: '10 km',
          },
        ],
        sampleCount: 3,
      },
    });

    const classNames = classNamesIn(section);

    expect(classNames).toContain('pill pill-info');
    expect(classNames).toContain('pill pill-warn');
    expect(classNames).not.toContain('pill pill pill-info');
    expect(classNames).not.toContain('pill pill pill-warn');
  });
});
