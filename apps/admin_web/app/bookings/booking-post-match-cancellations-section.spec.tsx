import { renderToStaticMarkup } from 'react-dom/server';
import { normalizedText } from './booking-section-test-utils';
import { BookingPostMatchCancellationBoard } from './booking-post-match-cancellations-section';

describe('BookingPostMatchCancellationBoard', () => {
  it('separates all-date open workload from the selected resolved period', () => {
    const markup = renderToStaticMarkup(
      <BookingPostMatchCancellationBoard
        periodLabel="Last 7 days"
        summary={{
          adminApprovedCount: 3,
          adminHeldCount: 2,
          autoResolvedCount: 4,
          generatedAt: '2026-08-07T04:00:00.000Z',
          needsDecisionCount: 5,
          noShowReviewCount: 1,
          overdueOpenCount: 2,
          resolvedCount: 10,
          unknownLegacyCount: 1,
        }}
      />,
    );
    const rendered = normalizedText(markup);

    expect(rendered).toContain('Open workload · Overall');
    expect(rendered).toContain('Needs decision: 5');
    expect(rendered).toContain('No-show: 1');
    expect(rendered).toContain('Resolved · Last 7 days');
    expect(rendered).toContain('Total: 10');
    expect(rendered).toContain('Admin approved · fee waived: 3');
    expect(rendered.indexOf('Open workload · Overall')).toBeLessThan(rendered.indexOf('Resolved · Last 7 days'));
  });

  it('does not turn an unavailable summary fallback into zero facts', () => {
    const markup = renderToStaticMarkup(
      <BookingPostMatchCancellationBoard
        periodLabel="Last 30 days"
        summary={{
          adminApprovedCount: 0,
          adminHeldCount: 0,
          autoResolvedCount: 0,
          generatedAt: '',
          needsDecisionCount: 0,
          noShowReviewCount: 0,
          overdueOpenCount: 0,
          resolvedCount: 0,
          unknownLegacyCount: 0,
        }}
      />,
    );

    expect(markup).toBe('');
  });
});
