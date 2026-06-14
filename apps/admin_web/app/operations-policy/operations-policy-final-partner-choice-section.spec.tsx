import { OperationsPolicyFinalPartnerChoiceSection } from './operations-policy-final-partner-choice-section';
import { hrefsIn, normalizedTextContent } from './operations-policy-section-test-utils';

describe('OperationsPolicyFinalPartnerChoiceSection', () => {
  it('renders partner choice controls and impact link', () => {
    const section = OperationsPolicyFinalPartnerChoiceSection({
      matrix: {
        blockingCount: 2,
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
            label: 'Needs follow-up',
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

    expect(section.type).toBe('section');
    expect(rendered).toContain('Final Partner choice control matrix');
    expect(rendered).toContain('2 control choice(s)');
    expect(rendered).toContain('Direct booking window');
    expect(rendered).toContain('Current Partner acceptance impact');
    expect(rendered).toContain('Open Partner queue');
    expect(hrefsIn(section)).toContain('/partners');
  });
});
