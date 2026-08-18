import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('PaymentClearingDetailPage Vuexy links', () => {
  const source = readFileSync(join(__dirname, 'page.tsx'), 'utf8');

  it('uses the shared Vuexy text link atom for finance evidence links', () => {
    expect(source).toContain("import { AdminTextLink } from '../../../../components/admin-text-link';");
    expect(source).toContain('<AdminTextLink');
    expect(source).not.toContain('className="text-link"');
    expect(source).not.toContain("import Link from 'next/link';");
  });

  it('keeps list context and provides an action-complete bank matching path', () => {
    expect(source).toContain('safePaymentClearingDetailReturnTo');
    expect(source).toContain('href={returnTo}');
    expect(source).toContain('Compare candidate evidence');
    expect(source).toContain('href="#matching-bank-candidates"');
    expect(source).toContain('Find matching bank transaction');
    expect(source).toContain('bankCandidateReviewHref');
    expect(source).toContain("url.searchParams.set('candidateQ', clearingEntryId)");
    expect(source).toContain('clearingState.isMatchable');
  });

  it('distinguishes a missing record from a retryable API failure', () => {
    expect(source).toContain('adminGetResult<AdminBookingPaymentClearingEntryDetail | null>');
    expect(source).toContain('entryResult.status === 404');
    expect(source).toContain('<AdminErrorState');
    expect(source).toContain('Payment clearing evidence unavailable');
    expect(source).toContain('Support reference:');
    expect(source).toContain('href={detailHref}>Retry');
  });

  it('supports protected owner assignment from the evidence detail', () => {
    expect(source).toContain("readParam(query, 'confirm') === 'review-owner'");
    expect(source).toContain('buildPaymentClearingReviewOwnerOptions');
    expect(source).toContain('action={assignPaymentClearingDetailReviewAction}');
    expect(source).toContain("name: 'confirmationClearingEntryId'");
    expect(source).toContain('/review-assignment`');
    expect(source).toContain('reason.length < 12');
    expect(source).toContain('Review owner updated.');
  });

  it('shows owner, amount, direction, candidates, and semantic payment fee evidence', () => {
    expect(source).toContain('title="Review owner history"');
    expect(source).toContain('title="Matching bank candidates"');
    expect(source).toContain('label="Expected bank direction"');
    expect(source).toContain('label="Current owner"');
    expect(source).toContain('entry.remainingAmount ??');
    expect(source).toContain('<AdminTableSubstack>');
    expect(source).toContain('Payment fee policy evidence is missing');
    expect(source).toContain("entry.status === 'REVERSED'");
    expect(source).toContain("label={clearingState.closedAtLabel}");
    expect(source).toContain('Amount gap');
    expect(source).toContain('Date gap');
    expect(source).toContain('These are unranked leads, not match recommendations.');
    expect(source).toContain('Manual comparison required');
    expect(source).toContain('activeMatchCount} active · {matches.length} history');
    expect(source).toContain('No review owner has been assigned. Use Assign owner');
    expect(source).not.toContain('className="muted admin-block"');
  });
});
