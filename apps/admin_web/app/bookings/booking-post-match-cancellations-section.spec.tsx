import { renderToStaticMarkup } from 'react-dom/server';
import { normalizedText } from './booking-section-test-utils';
import { BookingPostMatchCancellationsSection } from './booking-post-match-cancellations-section';

describe('BookingPostMatchCancellationsSection', () => {
  it('renders counts and admin handling guidance for post-match cancellations', () => {
    const markup = renderToStaticMarkup(
      <BookingPostMatchCancellationsSection
        board={{
          autoApprovedCount: 2,
          autoApprovalWindowCount: 2,
          feeHeldCount: 3,
          feeRestoredCount: 4,
          monthCount: 5,
          pendingManualReviewCount: 1,
          totalCount: 9,
        }}
      />,
    );
    const rendered = normalizedText(markup);

    expect(rendered).toContain('Post-match Cancellations');
    expect(rendered).toContain('9 total');
    expect(rendered).toContain('5 this month');
    expect(rendered).toContain('Needs admin review');
    expect(rendered).toContain('Auto-approved');
    expect(rendered).toContain('Within 15m window');
    expect(rendered).toContain('Fee still held');
    expect(rendered).toContain('Fee restored');
    expect(rendered).toContain('Open queue');
    expect(rendered).toContain('Open chat, check the Partner cancellation note');
    expect(markup).toContain('aria-label="Post-match cancellation counts"');
    expect(markup).toContain('href="/bookings?view=post-match-cancellations"');
    expect(markup).toContain('booking-post-match-cancellations-card');
    expect(markup).toContain('booking-post-match-header-actions');
    expect(markup).toContain('booking-post-match-metric is-warn');
    expect(markup).toContain('booking-post-match-metric is-danger');
  });
});
