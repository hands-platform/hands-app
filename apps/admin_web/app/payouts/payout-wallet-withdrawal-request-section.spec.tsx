import { PayoutWalletWithdrawalRequestSection } from './payout-wallet-withdrawal-request-section';
import type { AdminProviderWalletWithdrawalRequest } from '../../lib/admin-api';
import { readFileSync } from 'node:fs';

const sectionSource = readFileSync(new URL('./payout-wallet-withdrawal-request-section.tsx', import.meta.url), 'utf8');

describe('PayoutWalletWithdrawalRequestSection', () => {
  it('opens one page-level paid reversal review instead of repeating reversal forms per row', () => {
    expect(sectionSource).toContain('Review paid reversal');
    expect(sectionSource).toContain('reverseHrefForRequest');
    expect(sectionSource).not.toContain('Separate Finance approver for');
    expect(sectionSource).not.toContain('Bank reversal evidence URL for');
    expect(sectionSource).toContain('Review request for ${partnerLabel(request)} (${shortRecordId(request.id)})');
    expect(sectionSource).toContain('Match bank evidence for ${partnerLabel(request)} (${shortRecordId(request.id)})');
    expect(sectionSource).toContain('Open withdrawal journal for ${partnerLabel(request)} (${shortRecordId(request.id)})');
  });

  it('renders withdrawal requests with partner, bank, status, and finance actions', () => {
    const section = PayoutWalletWithdrawalRequestSection({
      requests: [
        {
          amount: 500000,
          bankAccount: {
            accountHolderName: 'Smoke Partner',
            accountNumberMasked: '****1234',
            bankName: 'VCB',
            id: 'bank-1',
            isPrimary: true,
            status: 'APPROVED',
          },
          bankAccountId: 'bank-1',
          createdAt: '2026-06-27T09:00:00.000Z',
          currency: 'VND',
          id: 'withdrawal-request-1',
          providerProfile: {
            displayName: 'Smoke Partner',
            user: { phone: '+84900001111' },
          },
          providerProfileId: 'provider-1',
          status: 'REQUESTED',
        },
      ] satisfies AdminProviderWalletWithdrawalRequest[],
      updateWithdrawalRequestAction: async () => undefined,
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Partner wallet withdrawal requests');
    expect(rendered).toContain('1 needs action');
    expect(rendered).toContain('Smoke Partner');
    expect(rendered).toContain('500.000 VND');
    expect(rendered).toContain('VCB');
    expect(rendered).toContain('Requested');
    expect(rendered).toContain('Approve');
    expect(rendered).toContain('Request correction');
    expect(rendered).toContain('Reject');
    expect(hrefsIn(section)).toContain('/partners/provider-1?section=full#finance');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group payout-wallet-withdrawal-request-section admin-mb-16 admin-section',
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table admin-data-table payout-withdrawal-compact-table',
        'admin-form-input',
        'admin-form-control-button button button-sm button-primary',
        'admin-form-control-button button button-sm button-outline',
        'admin-form-control-button button button-sm button-danger',
      ]),
    );
  });

  it('shows bank correction rows as partner-pending instead of finance-approvable', () => {
    const section = PayoutWalletWithdrawalRequestSection({
      requests: [
        {
          amount: 420000,
          bankAccount: {
            accountHolderName: 'Smoke Partner',
            accountNumberLast4: '7788',
            bankName: 'Techcombank',
            id: 'bank-1',
            isPrimary: true,
            status: 'REJECTED',
          },
          bankAccountId: 'bank-1',
          correctionReason: 'Bank account name does not match KYC name.',
          createdAt: '2026-06-27T09:00:00.000Z',
          currency: 'VND',
          id: 'withdrawal-request-needs-bank-correction',
          providerProfile: {
            displayName: 'Smoke Partner',
            user: { phone: '+84900001111' },
          },
          providerProfileId: 'provider-1',
          status: 'NEEDS_BANK_CORRECTION',
        },
      ] satisfies AdminProviderWalletWithdrawalRequest[],
      updateWithdrawalRequestAction: async () => undefined,
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Waiting for partner bank correction');
    expect(rendered).toContain(
      'Partner must update bank details in the Partner app before finance can approve this withdrawal.',
    );
    expect(rendered).toContain('Bank account name does not match KYC name.');
    expect(rendered).not.toContain('Approve');
    expect(rendered).not.toContain('Request correction');
    expect(rendered).not.toContain('Reject');
  });

  it('shows server preflight blockers and removes disallowed withdrawal closeout actions', () => {
    const section = PayoutWalletWithdrawalRequestSection({
      requests: [
        {
          amount: 500000,
          bankAccount: {
            accountHolderName: 'Blocked Partner',
            accountNumberMasked: '****1234',
            bankName: 'VCB',
            id: 'bank-blocked',
            isPrimary: true,
            status: 'APPROVED',
          },
          bankAccountId: 'bank-blocked',
          createdAt: '2026-07-26T09:00:00.000Z',
          currency: 'VND',
          id: 'withdrawal-request-blocked',
          preflight: {
            availableBalance: 300000,
            bankAccountApproved: true,
            blockers: [
              {
                code: 'INSUFFICIENT_AVAILABLE_BALANCE',
                message: 'Available partner wallet balance cannot cover this withdrawal.',
              },
            ],
            canApprove: false,
            canMarkBankTransferPending: false,
            canMarkPaid: false,
            canReject: true,
            independentApproverAvailable: true,
            lockJournalPosted: true,
            paidJournalPosted: false,
            paidLedgerRecorded: false,
            ready: false,
            walletBalance: 300000,
            warnings: [],
          },
          providerProfile: {
            displayName: 'Blocked Partner',
            user: { phone: '+84900002222' },
          },
          providerProfileId: 'provider-blocked',
          status: 'APPROVED',
        },
      ] satisfies AdminProviderWalletWithdrawalRequest[],
      updateWithdrawalRequestAction: async () => undefined,
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Available partner wallet balance cannot cover this withdrawal.');
    expect(rendered).not.toContain('Bank pending');
    expect(rendered).not.toContain('Mark paid');
    expect(rendered).toContain('Reject');
  });

  it('never offers reject after a withdrawal enters bank transfer pending', () => {
    const section = PayoutWalletWithdrawalRequestSection({
      requests: [
        {
          amount: 500000,
          bankAccount: {
            accountHolderName: 'Smoke Partner',
            accountNumberMasked: '****1234',
            bankName: 'VCB',
            id: 'bank-pending',
            isPrimary: true,
            status: 'APPROVED',
          },
          bankAccountId: 'bank-pending',
          createdAt: '2026-07-26T09:00:00.000Z',
          currency: 'VND',
          id: 'withdrawal-request-bank-pending',
          preflight: {
            availableBalance: 500000,
            bankAccountApproved: true,
            blockers: [],
            canApprove: false,
            canMarkBankTransferPending: false,
            canMarkPaid: false,
            canReject: true,
            independentApproverAvailable: true,
            lockJournalPosted: true,
            paidJournalPosted: false,
            paidLedgerRecorded: false,
            ready: false,
            walletBalance: 500000,
            warnings: [],
          },
          providerProfile: {
            displayName: 'Smoke Partner',
            user: { phone: '+84900003333' },
          },
          providerProfileId: 'provider-bank-pending',
          status: 'BANK_TRANSFER_PENDING',
        },
      ] satisfies AdminProviderWalletWithdrawalRequest[],
      updateWithdrawalRequestAction: async () => undefined,
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Paid closeout approval pending');
    expect(rendered).not.toContain('Reject note');
    expect(rendered).not.toContain('Reject');
  });

  it('renders withdrawal status-change audit evidence for released locked amounts', () => {
    const request = {
      amount: 500000,
      bankAccount: {
        accountHolderName: 'Smoke Partner',
        accountNumberMasked: '****1234',
        bankName: 'VCB',
        id: 'bank-1',
        isPrimary: true,
        status: 'APPROVED',
      },
      bankAccountId: 'bank-1',
      createdAt: '2026-06-27T09:00:00.000Z',
      currency: 'VND',
      id: 'withdrawal-request-rejected',
      metadata: {
        lastStatusChange: {
          previousStatus: 'APPROVED',
          nextStatus: 'REJECTED',
          lockedAmountReleased: true,
          releasedAmount: 500000,
        },
      },
      providerProfile: {
        displayName: 'Smoke Partner',
        user: { phone: '+84900001111' },
      },
      providerProfileId: 'provider-1',
      status: 'REJECTED',
    } as unknown as AdminProviderWalletWithdrawalRequest;
    const section = PayoutWalletWithdrawalRequestSection({
      requests: [request],
      updateWithdrawalRequestAction: async () => undefined,
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Approved -> Rejected');
    expect(rendered).toContain('Lock released 500.000 VND');
  });

  it('keeps accounting previews out of withdrawal rows while retaining amount and status evidence', () => {
    const section = PayoutWalletWithdrawalRequestSection({
      requests: [
        {
          amount: 800000,
          bankAccount: null,
          bankAccountId: null,
          createdAt: '2026-06-27T09:00:00.000Z',
          currency: 'VND',
          id: 'withdrawal-locked',
          providerProfileId: 'provider-locked',
          status: 'APPROVED',
        },
        {
          amount: 500000,
          bankAccount: null,
          bankAccountId: null,
          createdAt: '2026-06-27T10:00:00.000Z',
          currency: 'VND',
          id: 'withdrawal-paid',
          paidAt: '2026-06-28T10:00:00.000Z',
          providerProfileId: 'provider-paid',
          status: 'PAID',
        },
        {
          amount: 300000,
          bankAccount: null,
          bankAccountId: null,
          createdAt: '2026-06-27T11:00:00.000Z',
          currency: 'VND',
          id: 'withdrawal-returned',
          providerProfileId: 'provider-returned',
          status: 'REJECTED',
        },
      ] as unknown as AdminProviderWalletWithdrawalRequest[],
      updateWithdrawalRequestAction: async () => undefined,
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).not.toContain('Accounting preview');
    expect(rendered).toContain('800.000 VND');
    expect(rendered).toContain('500.000 VND');
    expect(rendered).toContain('300.000 VND');
    expect(rendered).toContain('Review request');
    expect(sectionSource).not.toContain('AdminWithdrawalAccountingPreview');
  });

  it('summarizes finance queue status filters before the withdrawal table', () => {
    const section = PayoutWalletWithdrawalRequestSection({
      activeStatus: 'BANK_TRANSFER_PENDING',
      range: '7d',
      requests: [
        {
          amount: 500000,
          bankAccount: null,
          bankAccountId: null,
          createdAt: '2026-06-27T09:00:00.000Z',
          currency: 'VND',
          id: 'withdrawal-review-required',
          providerProfileId: 'provider-review',
          status: 'REVIEW_REQUIRED',
        },
        {
          amount: 650000,
          bankAccount: null,
          bankAccountId: null,
          createdAt: '2026-06-27T09:30:00.000Z',
          currency: 'VND',
          id: 'withdrawal-bank-pending',
          providerProfileId: 'provider-bank',
          status: 'BANK_TRANSFER_PENDING',
        },
        {
          amount: 500000,
          bankAccount: null,
          bankAccountId: null,
          createdAt: '2026-06-27T10:00:00.000Z',
          currency: 'VND',
          id: 'withdrawal-rejected',
          metadata: {
            lastStatusChange: {
              previousStatus: 'APPROVED',
              nextStatus: 'REJECTED',
              lockedAmountReleased: true,
              releasedAmount: 500000,
            },
          },
          providerProfileId: 'provider-rejected',
          status: 'REJECTED',
        },
      ] as unknown as AdminProviderWalletWithdrawalRequest[],
      updateWithdrawalRequestAction: async () => undefined,
    });

    const rendered = normalizeSpaces(textContent(section));
    const hrefs = hrefsIn(section);

    expect(rendered).toContain('Withdrawal request status summary');
    expect(rendered).toContain('Review required 1');
    expect(rendered).toContain('Bank transfer pending 1');
    expect(rendered).not.toContain('Lock released 1');
    expect(rendered).toContain('Selected');
    expect(hrefs).toContain('/payouts?range=7d&withdrawalStatus=REVIEW_REQUIRED#partner-wallet-withdrawal-requests');
    expect(hrefs).toContain('/payouts?range=7d&withdrawalStatus=BANK_TRANSFER_PENDING#partner-wallet-withdrawal-requests');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'admin-summary-card-grid payout-wallet-withdrawal-summary-grid',
        'card admin-card admin-summary-card payout-wallet-withdrawal-summary-card is-info is-active',
      ]),
    );
    expect(sectionSource).toContain('AdminSummaryCardGrid');
    expect(sectionSource).not.toContain('function WithdrawalSummaryCard');
    expect(sectionSource).not.toContain('<div className="card admin-card payout-wallet-withdrawal-summary-card is-audit">');
    expect(sectionSource).not.toContain('<AdminCard className="payout-wallet-withdrawal-summary-card is-audit">');
    expect(sectionSource).not.toContain("'card admin-card payout-wallet-withdrawal-summary-card'");
  });

  it('shows paid withdrawals as a separately paginated bank reconciliation action queue', () => {
    const request = {
      amount: 500000,
      bankAccount: null,
      bankAccountId: null,
      createdAt: '2026-07-15T09:00:00.000Z',
      currency: 'VND',
      id: 'withdrawal-paid-unmatched',
      paidAt: '2026-07-15T10:00:00.000Z',
      reviewedByAdminId: 'finance-maker-1',
      paidBy: { id: 'finance-maker-1', fullName: 'Finance Maker' },
      approvalAdminId: 'finance-approver-2',
      approvalAdmin: { id: 'finance-approver-2', fullName: 'Finance Approver' },
      providerProfileId: 'provider-paid',
      reconciliationState: 'UNMATCHED',
      bankReconciliationCandidate: {
        id: 'bank-transaction-paid-500',
        occurredAt: '2026-07-15T10:00:00.000Z',
        transferRef: 'VCB-PAID-500',
      },
      bankReconciliationCandidateCount: 1,
      status: 'PAID',
      transferRef: 'VCB-PAID-500',
    } satisfies AdminProviderWalletWithdrawalRequest;
    const section = PayoutWalletWithdrawalRequestSection({
      activeReconciliation: 'unmatched',
      activeStatus: 'PAID',
      pagination: {
        from: 1,
        page: 1,
        pageSize: 10,
        rows: [request],
        to: 1,
        totalPages: 2,
        totalRows: 11,
      },
      paginationHrefForPage: (page) => `/payouts?withdrawalPage=${page}`,
      range: '30d',
      requests: [request],
      summary: {
        bankTransferPending: 0,
        bankTransferPendingAmount: 0,
        currency: 'VND',
        lockReleased: 0,
        paidAmount: 1_500_000,
        paidReconciled: 2,
        paidReconciledAmount: 1_000_000,
        paidUnreconciled: 11,
        paidUnreconciledAmount: 5_500_000,
        pendingWithdrawalPayableAmount: 0,
        requested: 0,
        requestedAmount: 0,
        returnedAmount: 0,
        reviewRequired: 0,
        total: 13,
        totalAmount: 6_500_000,
      },
      updateWithdrawalRequestAction: async () => undefined,
    });

    const rendered = normalizeSpaces(textContent(section));
    const hrefs = hrefsIn(section);

    expect(rendered).toContain('Paid / bank match pending 11');
    expect(rendered).toContain('1 bank match pending');
    expect(rendered).toContain('Bank match pending');
    expect(rendered).toContain('Paid by Finance Maker');
    expect(rendered).toContain('Approved by Finance Approver');
    expect(rendered).toContain('Showing 1 to 1 of 11 withdrawals');
    expect(hrefs).toContain(
      '/payouts?range=30d&withdrawalReconciliation=unmatched&withdrawalStatus=PAID#partner-wallet-withdrawal-requests',
    );
    expect(hrefs).toContain(
      '/finance-tax/bank-reconciliation/bank-transaction-paid-500',
    );
    expect(hrefs).toContain(
      '/finance-tax/general-ledger?q=withdrawal-paid-unmatched',
    );
    expect(hrefs).toContain('/payouts?withdrawalPage=2');
  });

  it('blocks broad bank matching when a paid withdrawal has no exact transfer reference', () => {
    const section = PayoutWalletWithdrawalRequestSection({
      requests: [
        {
          amount: 500000,
          bankAccount: null,
          bankAccountId: null,
          createdAt: '2026-05-01T09:00:00.000Z',
          currency: 'VND',
          id: 'withdrawal-paid-without-reference',
          paidAt: '2026-05-01T10:00:00.000Z',
          providerProfileId: 'provider-paid',
          reconciliationState: 'UNMATCHED',
          status: 'PAID',
          transferRef: null,
        },
      ] satisfies AdminProviderWalletWithdrawalRequest[],
      updateWithdrawalRequestAction: async () => undefined,
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Transfer reference missing');
    expect(rendered).not.toContain('Match bank evidence');
    expect(hrefsIn(section).some((href) => href.startsWith('/finance-tax/bank-reconciliation?'))).toBe(false);
  });

  it('blocks bank matching when a transfer reference has no unique exact bank transaction', () => {
    const section = PayoutWalletWithdrawalRequestSection({
      requests: [
        {
          amount: 120000,
          bankAccount: null,
          bankAccountId: null,
          bankReconciliationCandidate: null,
          bankReconciliationCandidateCount: 0,
          createdAt: '2026-07-03T09:00:00.000Z',
          currency: 'VND',
          id: 'withdrawal-paid-no-candidate',
          paidAt: '2026-07-03T10:00:00.000Z',
          providerProfileId: 'provider-paid',
          reconciliationState: 'UNMATCHED',
          status: 'PAID',
          transferRef: 'BANK-OUT-NO-CANDIDATE',
        },
      ] satisfies AdminProviderWalletWithdrawalRequest[],
      updateWithdrawalRequestAction: async () => undefined,
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Exact bank transaction not identified');
    expect(rendered).toContain('Open statement imports');
    expect(rendered).not.toContain('Match bank evidence');
    expect(hrefsIn(section)).toContain(
      '/finance-tax/bank-reconciliation?workspace=imports&importRange=all',
    );
  });

  it('routes ambiguous exact-reference candidates to an all-date outflow review', () => {
    const section = PayoutWalletWithdrawalRequestSection({
      requests: [
        {
          amount: 120000,
          bankAccount: null,
          bankAccountId: null,
          bankReconciliationCandidate: null,
          bankReconciliationCandidateCount: 2,
          createdAt: '2026-07-03T09:00:00.000Z',
          currency: 'VND',
          id: 'withdrawal-paid-ambiguous',
          paidAt: '2026-07-03T10:00:00.000Z',
          providerProfileId: 'provider-paid',
          reconciliationState: 'UNMATCHED',
          status: 'PAID',
          transferRef: 'BANK OUT / 120',
        },
      ] satisfies AdminProviderWalletWithdrawalRequest[],
      updateWithdrawalRequestAction: async () => undefined,
    });

    const rendered = normalizeSpaces(textContent(section));
    expect(rendered).toContain('Multiple bank transactions share this reference');
    expect(rendered).toContain('Review candidate transactions');
    expect(hrefsIn(section)).toContain(
      '/finance-tax/bank-reconciliation?q=BANK+OUT+%2F+120&range=all&review=unmatched&type=OUTFLOW',
    );
  });

  it('announces an explicit saved view and exposes a clear action without raw status copy', () => {
    const section = PayoutWalletWithdrawalRequestSection({
      activeStatus: 'REVIEW_REQUIRED',
      requests: [],
      savedView: {
        clearHref: '/payouts?range=all',
        label: 'Withdrawal requests · Review required',
        resultCount: 12,
      },
      updateWithdrawalRequestAction: async () => undefined,
    });
    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain(
      'Saved view Withdrawal requests · Review required 12 requests in this view Clear saved view',
    );
    expect(rendered).toContain('No rows in selected filter');
    expect(rendered).not.toContain('REVIEW_REQUIRED');
    expect(hrefsIn(section)).toContain('/payouts?range=all');
  });

  it('shows returned-bank evidence for reversed withdrawals', () => {
    const section = PayoutWalletWithdrawalRequestSection({
      requests: [
        {
          amount: 500000,
          bankAccount: null,
          bankAccountId: null,
          createdAt: '2026-07-15T09:00:00.000Z',
          currency: 'VND',
          id: 'withdrawal-reversed',
          metadata: {
            reversal: {
              occurredAt: '2026-07-16T10:00:00.000Z',
              reason: 'The receiving bank returned the transfer.',
              reversalReference: 'BANK-RETURN-501',
            },
          },
          providerProfileId: 'provider-reversed',
          status: 'REVERSED',
        },
      ],
      updateWithdrawalRequestAction: async () => undefined,
    });

    const rendered = normalizeSpaces(textContent(section));
    const hrefs = hrefsIn(section);

    expect(rendered).toContain('Reversed to Partner wallet');
    expect(rendered).toContain('BANK-RETURN-501');
    expect(rendered).toContain('The receiving bank returned the transfer.');
    expect(rendered).toContain('Reversed');
    expect(hrefs).toContain('/finance-tax/general-ledger?q=withdrawal-reversed');
  });

  it('shows a single reversal review link only when paid evidence is complete', () => {
    const request = {
      amount: 500000,
      bankAccount: null,
      bankAccountId: null,
      createdAt: '2026-07-15T09:00:00.000Z',
      currency: 'VND',
      id: 'withdrawal-paid-reversible',
      paidAt: '2026-07-15T10:00:00.000Z',
      providerProfileId: 'provider-paid',
      reconciliationState: 'UNMATCHED',
      status: 'PAID',
      transferRef: 'VCB-PAID-501',
      preflight: {
        availableBalance: 0,
        bankAccountApproved: true,
        blockers: [],
        canApprove: false,
        canMarkBankTransferPending: false,
        canMarkPaid: false,
        canReject: false,
        canReversePaid: true,
        independentApproverAvailable: true,
        lockJournalPosted: true,
        paidJournalPosted: true,
        paidLedgerRecorded: true,
        ready: false,
        reversalJournalPosted: false,
        reversalLedgerRecorded: false,
        walletBalance: 0,
        warnings: [],
      },
    } satisfies AdminProviderWalletWithdrawalRequest;
    const section = PayoutWalletWithdrawalRequestSection({
      requests: [request],
      reverseHrefForRequest: (requestId) => `/payouts?reverseWithdrawalRequestId=${requestId}`,
      updateWithdrawalRequestAction: async () => undefined,
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Review paid reversal');
    expect(rendered).not.toContain('Reversal reason');
    expect(hrefsIn(section)).toContain(
      '/payouts?reverseWithdrawalRequestId=withdrawal-paid-reversible',
    );
  });

  it('scopes withdrawal summary typography to direct summary-card children', () => {
    const css = readFileSync('app/globals.css', 'utf8');

    expect(css).toContain('.payout-wallet-withdrawal-summary-card > span');
    expect(css).toContain('.payout-wallet-withdrawal-summary-card > strong');
    expect(css).toContain('.payout-wallet-withdrawal-summary-card > small');
    expect(css).not.toContain('.payout-wallet-withdrawal-summary-card span {');
    expect(css).not.toContain('.payout-wallet-withdrawal-summary-card strong {');
    expect(css).not.toContain('.payout-wallet-withdrawal-summary-card small {');
  });

  it('uses the shared empty-state atom for no-row messaging', () => {
    expect(sectionSource).toContain('AdminTablePanel');
    expect(sectionSource).toContain('AdminEmptyState');
    expect(sectionSource).toContain('AdminTextLink');
    expect(sectionSource).not.toContain('className="text-link"');
    expect(sectionSource).not.toContain('className="payout-wallet-withdrawal-request-section admin-mb-16 vuexy-booking-table-card vuexy-booking-table-group"');
    expect(sectionSource).not.toContain('<div className="empty-state">');

    const emptySection = PayoutWalletWithdrawalRequestSection({
      requests: [],
      updateWithdrawalRequestAction: async () => undefined,
    });
    expect(classNamesIn(emptySection)).not.toContain('admin-table-scroll');
  });

  it('uses the shared inline fallback atom for missing partner phone values', () => {
    expect(sectionSource).toContain('AdminInlineFallback');
    expect(sectionSource).not.toContain(
      '<p className="muted">{request.providerProfile?.user?.phone ?? \'No phone on file\'}</p>',
    );
  });

  it('uses shared badge atoms for withdrawal status and action warnings', () => {
    expect(sectionSource).toContain('StatusBadge');
    expect(sectionSource).toContain('statusBadgeTone');
    expect(sectionSource).not.toContain('<span className={`pill ${statusPillClass(request.status)}`}>');
    expect(sectionSource).not.toContain('<span className="pill pill-warn">Waiting for partner bank correction</span>');
    expect(sectionSource).not.toContain('<span className="pill pill-warn">Finance review required before payout</span>');
    expect(sectionSource).not.toContain('<span className="pill pill-info">Manual bank transfer pending</span>');
    expect(sectionSource).not.toContain('function statusPillClass');
  });

  it('uses the shared money atom for withdrawal request amounts', () => {
    expect(sectionSource).toContain('MoneyText');
    expect(sectionSource).not.toContain('<strong>{formatMoney(request.amount, request.currency)}</strong>');
    expect(sectionSource).not.toContain('formatMoney(statusChange.evidenceAmount');
  });

  it('uses the shared DateTimeText atom for visible withdrawal timestamps', () => {
    expect(sectionSource).toContain('DateTimeText');
    expect(sectionSource).not.toContain('formatDateTime,');
    expect(sectionSource).not.toContain('<span className="muted">{formatDateTime(request.createdAt)}</span>');
    expect(sectionSource).not.toContain('<p className="muted">Reviewed {formatDateTime(request.reviewedAt)}</p>');
    expect(sectionSource).not.toContain('<span className="muted">Paid {formatDateTime(request.paidAt)}</span>');
  });
});

function textContent(value: unknown): string {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value === 'boolean') {
    return '';
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(textContent).join(' ');
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  return textContent(props?.children);
}

function hrefsIn(value: unknown): string[] {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(hrefsIn);
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  const href = typeof props?.href === 'string' ? [props.href] : [];
  return [...href, ...hrefsIn(props?.children)];
}

function classNamesIn(value: unknown): string[] {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(classNamesIn);
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  const className = typeof props?.className === 'string' ? [props.className] : [];
  return [...className, ...classNamesIn(props?.children)];
}

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function resolveElement(value: unknown): unknown {
  const record = readRecord(value);
  const props = readRecord(record?.props);
  return typeof record?.type === 'function' ? resolveElement(record.type(props)) : value;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}
