import { OperationsPolicyMatchingStageImpactSection } from './operations-policy-matching-stage-impact-section';
import { normalizedTextContent } from './operations-policy-section-test-utils';

describe('OperationsPolicyMatchingStageImpactSection', () => {
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

    expect(section.type).toBe('section');
    expect(section.props.id).toBe('matching-stage-impact');
    expect(rendered).toContain('Matching stage impact preview');
    expect(rendered).toContain('10m / 10 km / 30m fresh');
    expect(rendered).toContain('Stage 2 marketplace');
    expect(rendered).toContain('Response window');
    expect(rendered).toContain('How to use this preview');
  });
});
