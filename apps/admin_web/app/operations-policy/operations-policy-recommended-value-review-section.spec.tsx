import { readFileSync } from 'node:fs';

import { OperationsPolicyRecommendedValueReviewSection } from './operations-policy-recommended-value-review-section';
import { classNamesIn, normalizedTextContent } from './operations-policy-section-test-utils';

describe('OperationsPolicyRecommendedValueReviewSection', () => {
  it('uses shared Vuexy badge atoms for aligned fallback labels', () => {
    const source = readFileSync(
      'app/operations-policy/operations-policy-recommended-value-review-section.tsx',
      'utf8',
    );

    expect(source).toContain('StatusBadgeFromPillClass');
    expect(source).toContain('AdminTraceSummary');
    expect(source).not.toContain('statusBadgeToneFromPillClass');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('<div className="service-trace-summary admin-mt-12">');
    expect(source).not.toContain('<span className="pill pill-success">Aligned</span>');
  });

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
          {
            className: 'ops-task-done',
            detail: 'Current value matches the recommended baseline.',
            key: 'matching.marketplace_radius_meters',
            label: 'Marketplace radius',
            operatorAction: 'Keep monitoring city density.',
            pillClass: 'pill-success',
            status: 'Recommended',
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

    expect(section.type.name).toBe('AdminSection');
    expect(section.props).toMatchObject({
      className: 'admin-mb-16',
      title: 'Recommended value review',
    });
    expect(rendered).toContain('Recommended value review');
    expect(rendered).toContain('1 owner choice(s)');
    expect(rendered).toContain('Compared policies');
    expect(rendered).toContain('Provider response window');
    expect(rendered).not.toContain('Marketplace radius');
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
    expect(rendered).toContain('Recommended values are aligned');
  });

  it('does not duplicate the base pill class for owner choice cards', () => {
    const section = OperationsPolicyRecommendedValueReviewSection({
      review: {
        cards: [
          {
            className: 'ops-task-warning',
            detail: 'Current value differs from recommended baseline.',
            key: 'matching.provider_response_window_minutes',
            label: 'Provider response window',
            operatorAction: 'Monitor open matching bookings before changing this value.',
            pillClass: 'pill pill-warn',
            status: 'Owner choice',
          },
        ],
        summary: [],
        warningCount: 1,
      },
    });

    expect(classNamesIn(section)).toContain('pill pill-warn');
    expect(classNamesIn(section)).not.toContain('pill pill pill-warn');
  });
});
