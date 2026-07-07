import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { normalizedText } from '../booking-section-test-utils';
import { BookingDetailPostMatchDecisionSection } from './booking-detail-post-match-decision-section';
import type { BookingOutcomeReviewPanel } from './booking-outcome-review-panel';

describe('BookingDetailPostMatchDecisionSection', () => {
  it('uses shared Vuexy admin card surfaces for evidence and decision panels', () => {
    const source = readFileSync('app/bookings/[id]/booking-detail-post-match-decision-section.tsx', 'utf8');

    expect(source).toContain('AdminCard');
    expect(source).toContain('AdminSummaryCardGrid');
    expect(source).not.toContain('AdminLinkCard');
    expect(source).toContain('ariaLabel="Post-match cancellation evidence checklist"');
    expect(source).not.toContain('aria-label="Post-match cancellation evidence checklist"');
    expect(source).not.toContain('className="card admin-card booking-post-match-detail-evidence-card"');
    expect(source).not.toContain('className="card admin-card booking-outcome-decision-panel"');
  });

  it('scopes post-match evidence card typography to direct summary-card slots', () => {
    const css = readFileSync('app/globals.css', 'utf8');

    expect(css).toContain('.booking-post-match-detail-evidence-card > strong');
    expect(css).toContain('.booking-post-match-detail-evidence-card > small');
    expect(css).not.toContain('.booking-post-match-detail-evidence-card strong');
    expect(css).not.toContain('.booking-post-match-detail-evidence-card small');
  });

  it('uses shared Vuexy badge atoms instead of raw post-match decision pill spans', () => {
    const source = readFileSync('app/bookings/[id]/booking-detail-post-match-decision-section.tsx', 'utf8');

    expect(source).toContain('StatusBadgeFromPillClass');
    expect(source).not.toContain('statusBadgeToneFromPillClass');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('<span className={`pill ${outcomeReview.tone}`}>{outcomeReview.status}</span>');
    expect(source).not.toContain('<span className={`pill ${row.tone}`}>{row.label}</span>');
    expect(source).not.toContain('<span className={`pill ${decision.resolutionTone}`}>{decision.resolutionLabel}</span>');
    expect(source).not.toContain('<span className={`pill ${decision.feeTone}`}>{decision.feeLabel}</span>');
    expect(source).not.toContain('<span className={`pill ${decision.timingTone}`}>{decision.timingLabel}</span>');
  });

  it('uses the shared DateTimeText atom for visible outcome timestamps', () => {
    const source = readFileSync('app/bookings/[id]/booking-detail-post-match-decision-section.tsx', 'utf8');

    expect(source).toContain("import { DateTimeText } from '../../../components/date-time-text';");
    expect(source).toContain('<DateTimeText fallback={row.value} value={row.dateTimeValue} />');
    expect(source).not.toContain('<strong>{row.value}</strong>');
  });

  it('renders evidence checklist and clear fee decision actions', () => {
    const markup = renderToStaticMarkup(
      <BookingDetailPostMatchDecisionSection bookingId="booking-1" outcomeReview={outcomeReview()} />,
    );
    const rendered = normalizedText(markup);

    expect(rendered).toContain('Post-match cancellation processing');
    expect(rendered).toContain('Review retained chat, closeout evidence, and operator notes');
    expect(rendered).toContain('Post-match cancellation evidence checklist');
    expect(rendered).toContain('Chat evidence');
    expect(rendered).toContain('3 messages');
    expect(rendered).toContain('Operator notes');
    expect(rendered).toContain('1 note');
    expect(rendered).toContain('Closeout status');
    expect(rendered).toContain('Ready');
    expect(rendered).toContain('Approve restores the eligible Partner fee impact.');
    expect(rendered).toContain('Hold keeps the existing Partner fee deduction');
    expect(rendered).toContain('Approve cancellation');
    expect(rendered).toContain('Restore eligible fee impact');
    expect(rendered).toContain('Hold fee deduction');
    expect(rendered).toContain('Keep existing deduction');
    expect(markup).toContain('href="#chat"');
    expect(markup).toContain('href="#operator-notes"');
    expect(markup).toContain('name="bookingId" value="booking-1"');
    expect(markup).toContain('card admin-section admin-mb-16 booking-post-match-cancellation-decision-card');
    expect(markup).toContain('booking-post-match-detail-evidence-grid');
    expect(markup).toContain('card admin-card admin-summary-card booking-post-match-detail-evidence-card');
    expect(markup).toContain('card admin-card booking-outcome-decision-panel');
    expect(markup).toContain('booking-outcome-decision-main');
  });

  it('renders outcome timestamps through the shared date atom', () => {
    const markup = renderToStaticMarkup(
      <BookingDetailPostMatchDecisionSection
        bookingId="booking-1"
        outcomeReview={outcomeReview({
          rows: [
            {
              dateTimeValue: '2026-06-13T03:15:00.000Z',
              helper: 'Completed at',
              href: '#operating-timeline',
              label: 'Outcome time',
              tone: 'pill-info',
              value: 'Not set',
            },
          ],
        })}
      />,
    );

    expect(markup).toContain('class="date-time-text"');
    expect(markup).toContain('dateTime="2026-06-13T03:15:00.000Z"');
    expect(markup).toContain('Outcome time');
  });

  it('locks decision actions when the post-match cancellation is already resolved', () => {
    const markup = renderToStaticMarkup(
      <BookingDetailPostMatchDecisionSection
        bookingId="booking-1"
        outcomeReview={outcomeReview({
          postMatchDecision: {
            ...outcomeReview().postMatchDecision,
            canResolve: false,
            feeLabel: 'Fee restored',
            feeTone: 'pill-success',
            resolutionLabel: 'Approved',
            resolutionTone: 'pill-success',
            timingLabel: 'Review locked',
            timingTone: 'pill-neutral',
          },
        })}
      />,
    );
    const rendered = normalizedText(markup);

    expect(rendered).toContain('Approved');
    expect(rendered).toContain('Fee restored');
    expect(rendered).toContain('This cancellation decision is already closed.');
    expect(rendered).not.toContain('Approve cancellation');
    expect(rendered).not.toContain('Hold fee deduction');
  });

  it('renders nothing when no post-match decision is visible', () => {
    const markup = renderToStaticMarkup(
      <BookingDetailPostMatchDecisionSection
        bookingId="booking-1"
        outcomeReview={outcomeReview({
          postMatchDecision: {
            ...outcomeReview().postMatchDecision,
            visible: false,
          },
        })}
      />,
    );

    expect(markup).toBe('');
  });
});

function outcomeReview(input: Partial<BookingOutcomeReviewPanel> = {}): BookingOutcomeReviewPanel {
  return {
    helper: 'Use retained chat before final confirmation.',
    postMatchDecision: {
      approveNote: 'Approved after admin chat evidence review.',
      canResolve: true,
      feeLabel: 'Fee held',
      feeTone: 'pill-danger',
      holdNote: 'Held after admin chat evidence review.',
      resolutionLabel: 'Pending admin decision',
      resolutionTone: 'pill-warn',
      timingLabel: '16m after match',
      timingTone: 'pill-warn',
      visible: true,
    },
    primaryHref: '/bookings/post-match-cancellations?view=post-match-cancellations#booking-booking-1',
    primaryLabel: 'Open review queue',
    rows: [
      {
        helper: 'Open the retained chat before confirming cancellation.',
        href: '#chat',
        label: 'Chat evidence',
        tone: 'pill-success',
        value: '3 messages',
      },
      {
        helper: 'Internal notes are available for the final decision trail.',
        href: '#operator-notes',
        label: 'Operator notes',
        tone: 'pill-success',
        value: '1 note',
      },
      {
        helper: 'No closeout exception is visible for this booking stage.',
        href: '#booking-closeout-readiness',
        label: 'Closeout status',
        tone: 'pill-success',
        value: 'Ready',
      },
    ],
    status: 'Post-match cancellation',
    title: 'Post-match cancellation review',
    tone: 'pill-warn',
    visible: true,
    ...input,
  };
}
