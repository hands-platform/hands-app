import { renderToStaticMarkup } from 'react-dom/server';

import { RefundCommandBoardSection } from './refund-command-board-section';

describe('RefundCommandBoardSection', () => {
  it('separates exclusive workstreams from overlapping urgency metrics', () => {
    const markup = renderToStaticMarkup(
      <RefundCommandBoardSection
        approvalRequired={3}
        approvalHref="/refunds?review=requested"
        currentReview="open"
        currentSla="all"
        currentSort="oldest"
        gatewayProcessing={2}
        gatewayHref="/refunds?review=processing"
        generatedAt="2026-08-09T08:00:00.000Z"
        oldestOpenLabel="8d ago"
        oldestOpenHref="/refunds?review=open&sort=oldest"
        otherReview={1}
        otherReviewHref="/refunds?review=other"
        reconciliationRequired={5}
        reconciliationHref="/refunds?review=state-mismatch"
        refreshHref="/refunds?range=all&amp;review=open&amp;sort=oldest"
        slaOverdue={4}
        slaOverdueHref="/refunds?review=open&sla=overdue"
      />,
    );

    expect(markup).toContain('Current refund work');
    expect(markup).toContain('aria-label="Refund workstreams"');
    expect(markup).toContain('aria-label="Refund urgency"');
    expect(markup).toContain('Exclusive queue counts');
    expect(markup).toContain('SLA overdue overlaps the workstreams above.');
    expect(markup).toContain('Approval required');
    expect(markup).toContain('Gateway processing');
    expect(markup).toContain('Reconciliation required');
    expect(markup).toContain('SLA overdue');
    expect(markup).toContain('Oldest open');
    expect(markup).toContain('Other review');
    expect(markup).toContain('8d ago');
    expect(markup).toContain('/finance-tax/approval-queue?view=refunds');
    expect(markup).toContain('refund-command-metrics');
    expect(markup).toContain('refund-command-workstreams');
    expect(markup).toContain('refund-command-urgency');
    expect(markup).toContain('href="/refunds?review=requested"');
    expect(markup).toContain('href="/refunds?review=state-mismatch"');
    expect(markup).toContain('href="/refunds?review=other"');
    expect(markup).toContain('href="/refunds?review=open&amp;sort=oldest"');
    expect(markup).toContain('aria-current="page"');
    expect(markup).not.toContain('refund preview');
  });

  it('reduces emphasis when all action counts are clear', () => {
    const markup = renderToStaticMarkup(
      <RefundCommandBoardSection
        approvalRequired={0}
        approvalHref="/refunds?review=requested"
        currentReview="open"
        currentSla="all"
        currentSort="oldest"
        gatewayProcessing={0}
        gatewayHref="/refunds?review=processing"
        generatedAt="2026-08-09T08:00:00.000Z"
        oldestOpenLabel="None in scope"
        oldestOpenHref="/refunds?review=open&sort=oldest"
        otherReview={0}
        otherReviewHref="/refunds?review=other"
        reconciliationRequired={0}
        reconciliationHref="/refunds?review=state-mismatch"
        refreshHref="/refunds?range=all&amp;review=open&amp;sort=oldest"
        slaOverdue={0}
        slaOverdueHref="/refunds?review=open&sla=overdue"
      />,
    );

    expect(markup).toContain('No urgent action');
    expect(markup).toContain('None in scope');
  });
});
