import { OperationsPolicyRecommendedValueReviewSection } from './operations-policy-recommended-value-review-section';
import { normalizedTextContent } from './operations-policy-section-test-utils';

describe('OperationsPolicyRecommendedValueReviewSection', () => {
  it('renders owner choice warning cards', () => {
    const section = OperationsPolicyRecommendedValueReviewSection({
      review: {
        cards: [
          {
            className: 'ops-task-warning',
            detail: 'Current value differs from recommended baseline.',
            key: 'matching.provider_response_window_minutes',
            label: 'Provider response window',
            operatorAction: 'Monitor open matching bookings before changing this value.',
            pillClass: 'pill-warn',
            status: 'Owner choice',
          },
        ],
        summary: [
          {
            helper: 'Policies with an explicit recommended baseline.',
            label: 'Compared policies',
            value: '1',
          },
        ],
        warningCount: 1,
      },
    });

    const rendered = normalizedTextContent(section);

    expect(section.type).toBe('section');
    expect(rendered).toContain('Recommended value review');
    expect(rendered).toContain('1 owner choice(s)');
    expect(rendered).toContain('Compared policies');
    expect(rendered).toContain('Provider response window');
  });

  it('renders aligned state when there are no warnings', () => {
    const rendered = normalizedTextContent(
      OperationsPolicyRecommendedValueReviewSection({
        review: {
          cards: [],
          summary: [],
          warningCount: 0,
        },
      }),
    );

    expect(rendered).toContain('Aligned');
  });
});
