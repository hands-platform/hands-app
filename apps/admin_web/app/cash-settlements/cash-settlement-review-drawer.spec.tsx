import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { vi } from 'vitest';

import type { AdminCashSettlementDetail } from '../../lib/admin-api';
import { CashSettlementReviewDrawer } from './cash-settlement-review-drawer';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

describe('CashSettlementReviewDrawer', () => {
  it('shows authoritative debt amounts, permission state, audit timeline and evidence trace', () => {
    const markup = renderToStaticMarkup(
      <CashSettlementReviewDrawer
        canAllocate={false}
        closeHref="/cash-settlements"
        detail={detail()}
        detailLoaded
        returnTo="/cash-settlements?review=earning-1"
      />,
    );

    expect(markup).toContain('Original debt');
    expect(markup).toContain('170.000 VND');
    expect(markup).toContain('Allocated');
    expect(markup).toContain('70.000 VND');
    expect(markup).toContain('Remaining exposure');
    expect(markup).toContain('100.000 VND');
    expect(markup).toContain('Review only');
    expect(markup).toContain('Approved deposit allocated');
    expect(markup).toContain('Finance Operator');
    expect(markup).toContain('/finance-tax/partner-bank-deposits/deposit-1');
    expect(markup).toContain('Ledger ledger-1');
    expect(markup).toContain('Journal journal-1');
    expect(markup).not.toContain('name="reasonCode"');
    expect(markup).toContain('class="cash-settlement-review-drawer-shell service-menu-dialog-shell"');
    expect(markup).toContain(
      'cash-settlement-review-drawer-shell service-menu-dialog-shell"><div class="calendar-drawer-header"',
    );
  });

  it('keeps the Cash drawer close control square without changing the shared drawer contract', () => {
    const css = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8');
    const source = readFileSync(
      join(process.cwd(), 'app/cash-settlements/cash-settlement-review-drawer.tsx'),
      'utf8',
    );
    const ruleStart = css.indexOf('.cash-settlement-review-drawer .calendar-icon-button');
    const rule = css.slice(ruleStart, css.indexOf('}', ruleStart));

    expect(rule).toContain('height: 42px');
    expect(rule).toContain('min-height: 42px');
    expect(rule).toContain('width: 42px');
    expect(rule).toContain('padding: 0');
    expect(source).toContain("document.body.style.overflow = 'hidden'");
    expect(source).toContain('document.body.style.overflow = previousOverflow');
    expect(source).toContain("document.documentElement.style.overflow = 'hidden'");
    expect(source).toContain('document.documentElement.style.overflow = previousRootOverflow');
  });

  it('uses a fail-closed header when the selected earning cannot be verified', () => {
    const markup = renderToStaticMarkup(
      <CashSettlementReviewDrawer
        canAllocate
        closeHref="/cash-settlements"
        detail={null}
        detailLoaded={false}
        returnTo="/cash-settlements?review=missing"
      />,
    );

    expect(markup).toContain('Review unavailable');
    expect(markup).toContain('Cash settlement evidence');
    expect(markup).toContain('The selected receivable could not be verified.');
    expect(markup).toContain('Debt evidence unavailable');
    expect(markup).toContain('No financial action is available.');
    expect(markup).not.toContain('Approved evidence allocation');
    expect(markup).not.toContain('One open cash fee receivable');
    expect(markup).not.toContain('<form');
  });
});

function detail(): AdminCashSettlementDetail {
  return {
    allocatedAmount: 70_000,
    auditLogs: [
      {
        action: 'partner_bank_deposit.cash_debt_allocate',
        actor: { fullName: 'Finance Operator', id: 'admin-1' },
        createdAt: '2026-08-09T10:00:00.000Z',
        id: 'audit-1',
        metadata: {
          amount: 70_000,
          cashDebtFullyAllocated: false,
          currency: 'VND',
          reasonCode: 'PARTIAL_RECOVERY',
        },
        target: 'partner_bank_deposit_request:deposit-1',
      },
    ],
    availableDeposits: [],
    earning: {
      bankDepositCashDebtAllocations: [
        {
          amount: 70_000,
          createdAt: '2026-08-09T10:00:00.000Z',
          currency: 'VND',
          id: 'allocation-1',
          partnerBankDepositRequest: {
            bankTransactionId: 'VCB-1',
            id: 'deposit-1',
            journalBatchId: 'journal-1',
            ledgerEntryId: 'ledger-1',
            status: 'EXECUTED',
          },
        },
      ],
      bookingId: 'booking-1',
      createdAt: '2026-08-01T00:00:00.000Z',
      currency: 'VND',
      grossAmount: 500_000,
      id: 'earning-1',
      netAmount: -170_000,
      platformFee: 150_000,
      providerProfile: { displayName: 'Partner One' },
      providerProfileId: 'partner-1',
      status: 'AVAILABLE',
      withholdingAmount: 20_000,
    },
    originalDebtAmount: 170_000,
    remainingDebtAmount: 100_000,
    walletBalance: -100_000,
  };
}
