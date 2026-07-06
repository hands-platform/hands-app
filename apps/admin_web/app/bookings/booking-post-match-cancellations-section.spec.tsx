import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { normalizedText } from './booking-section-test-utils';
import { BookingPostMatchCancellationsSection } from './booking-post-match-cancellations-section';

describe('BookingPostMatchCancellationsSection', () => {
  it('uses shared Vuexy badge atoms instead of raw post-match cancellation pill spans', () => {
    const source = readFileSync('app/bookings/booking-post-match-cancellations-section.tsx', 'utf8');

    expect(source).toContain('StatusBadgeFromPillClass');
    expect(source).not.toContain('statusBadgeToneFromPillClass');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('<span className="pill pill-info">{board.totalCount} total</span>');
    expect(source).not.toContain('<span className="pill pill-neutral">{board.monthCount} this month</span>');
    expect(source).not.toContain('<span className={`pill ${metric.tone}`}>{metric.label}</span>');
  });

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
    expect(rendered).toContain('Fee held');
    expect(rendered).toContain('Fee restored');
    expect(rendered).toContain('1. Review evidence');
    expect(rendered).toContain('Chat and notes');
    expect(rendered).toContain('2. Decide fee outcome');
    expect(rendered).toContain('Approve or hold');
    expect(rendered).toContain('Approve restores eligible Partner fee impact');
    expect(rendered).toContain('3. Keep audit trail');
    expect(rendered).toContain('Resolved record');
    expect(rendered).toContain('Open queue');
    expect(rendered).toContain('Partner-side cancellations and no-show reviews after matching');
    expect(rendered).toContain('Open chat, check the Partner cancellation or no-show evidence');
    expect(markup).toContain('aria-label="Post-match cancellation counts"');
    expect(markup).toContain('aria-label="Post-match decision flow"');
    expect(markup).toContain('href="/bookings/post-match-cancellations"');
    expect(markup).toContain('class="card admin-section booking-post-match-cancellations-card admin-mt-16"');
    expect(markup).toContain('class="ops-section-header admin-section-header"');
    expect(markup).toContain('admin-form-control-link button button-secondary booking-action-button is-secondary');
    expect(markup).toContain('booking-post-match-cancellations-card');
    expect(markup).toContain('booking-post-match-header-actions');
    expect(markup).toContain('booking-post-match-decision-flow');
    expect(markup).toContain('booking-post-match-decision-step');
    expect(markup).toContain('vuexy-booking-table');
    expect(markup).toContain('pill-warn');
    expect(markup).toContain('pill-danger');
  });
});
