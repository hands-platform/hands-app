import {
  buildOperationsHandoffFinanceDecisionRows,
  OPERATIONS_HANDOFF_FINANCE_DECISION_ACTIONS,
} from './operations-handoff-finance-decisions';

describe('operations handoff finance decisions', () => {
  it('keeps the completed Finance decision action contract explicit', () => {
    expect(OPERATIONS_HANDOFF_FINANCE_DECISION_ACTIONS).toEqual([
      'company_bank_account.create',
      'company_bank_account.update',
      'company_bank_account.approval_rejected',
      'bank_reconciliation.match.create',
      'bank_reconciliation.match.reverse',
      'bank_reconciliation.transaction.ignore',
      'company_bank_transaction.review_escalation_resolved',
      'partner_bank_deposit.reconciliation_escalation_resolved',
      'wallet_adjustment_request.execute',
      'wallet_adjustment_request.reject',
      'wallet_adjustment_request.cancel_stale',
      'partner_bank_deposit_request.execute',
      'partner_bank_deposit_request.reject',
      'payout_batch.update',
      'payout_batch.reversal',
      'provider_wallet.withdrawal_request.update',
      'provider_wallet.withdrawal_request.reversal',
      'monthly_tax_closing.status_update',
      'payment.refund',
      'payment.refund.reject',
    ]);
  });

  it('maps bank account approval decisions without exposing account numbers', () => {
    const rows = buildOperationsHandoffFinanceDecisionRows([
      {
        action: 'company_bank_account.create',
        actor: { fullName: 'Finance Approver' },
        createdAt: '2026-07-29T02:00:00.000Z',
        id: 'audit-approved',
        metadata: {
          after: {
            accountNumberMasked: '********1234',
            bankName: 'Vietcombank',
            currency: 'VND',
            name: 'Operating account',
          },
          decision: 'APPROVE',
          operation: 'CREATE',
        },
        target: 'company_bank_account:account-1',
      },
      {
        action: 'company_bank_account.approval_rejected',
        actor: { email: 'approver@hands.local' },
        createdAt: '2026-07-29T01:00:00.000Z',
        id: 'audit-rejected',
        metadata: {
          decisionReason: 'Evidence does not identify the bank owner.',
          operation: 'UPDATE',
        },
        target: 'company_bank_account:account-2',
      },
    ]);

    expect(rows).toMatchObject([
      {
        actorLabel: 'Finance Approver',
        href: '/finance-tax/company-bank-accounts',
        recordLabel: 'Operating account · Vietcombank · VND',
        status: 'Approved',
        title: 'Company bank account creation',
      },
      {
        actorLabel: 'approver@hands.local',
        detail: 'Evidence does not identify the bank owner.',
        status: 'Rejected',
        title: 'Company bank account change',
      },
    ]);
    expect(JSON.stringify(rows)).not.toContain('********1234');
  });

  it('maps completed bank matches, reversals, and manual clears without exposing raw bank evidence', () => {
    const rows = buildOperationsHandoffFinanceDecisionRows([
      {
        action: 'bank_reconciliation.match.create',
        actor: { fullName: 'Finance Approver' },
        createdAt: '2026-07-29T06:00:00.000Z',
        id: 'bank-match',
        metadata: {
          amount: 500000,
          bankStatusAfter: 'MATCHED',
          bankTransactionId: 'bank-transaction-matched',
          currency: 'VND',
          sourceType: 'payment-clearing',
          transferRef: 'PRIVATE-BANK-REF',
        },
        target: 'bank_transaction:bank-transaction-matched',
      },
      {
        action: 'bank_reconciliation.match.create',
        createdAt: '2026-07-29T05:00:00.000Z',
        id: 'bank-partial-match',
        metadata: {
          amount: 200000,
          bankStatusAfter: 'PARTIALLY_MATCHED',
          bankTransactionId: 'bank-transaction-partial',
          currency: 'VND',
          sourceType: 'partner-bank-deposit',
        },
        target: 'bank_transaction:bank-transaction-partial',
      },
      {
        action: 'bank_reconciliation.match.reverse',
        createdAt: '2026-07-29T04:00:00.000Z',
        id: 'bank-match-reversed',
        metadata: {
          amount: 500000,
          bankTransactionId: 'bank-transaction-reversed',
          currency: 'VND',
          reason: 'The bank evidence was linked to the wrong payout.',
        },
        target: 'bank_reconciliation_match:match-reversed',
      },
      {
        action: 'bank_reconciliation.transaction.ignore',
        createdAt: '2026-07-29T03:00:00.000Z',
        id: 'bank-cleared',
        metadata: {
          amount: 1000,
          bankTransactionId: 'bank-transaction-cleared',
          currency: 'VND',
          reason: 'Bank-generated rounding row; no internal ledger source exists.',
        },
        target: 'bank_transaction:bank-transaction-cleared',
      },
      {
        action: 'company_bank_transaction.review_assignment',
        createdAt: '2026-07-29T07:00:00.000Z',
        id: 'bank-review-assignment',
        target: 'bank_transaction:bank-transaction-open',
      },
    ]);

    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({
      actorLabel: 'Finance Approver',
      detail: expect.stringContaining('payment clearing'),
      href: '/finance-tax/bank-reconciliation/bank-transaction-matched',
      status: 'Matched',
      title: 'Bank transaction matched',
    });
    expect(rows[1]).toMatchObject({
      detail: expect.stringContaining('Partner bank deposit'),
      status: 'Partially matched',
      title: 'Bank transaction partially matched',
    });
    expect(rows[2]).toMatchObject({
      detail: 'The bank evidence was linked to the wrong payout.',
      status: 'Reversed',
      title: 'Bank reconciliation match reversed',
    });
    expect(rows[3]).toMatchObject({
      detail: 'Bank-generated rounding row; no internal ledger source exists.',
      status: 'Resolved',
      title: 'Bank transaction cleared without match',
    });
    expect(JSON.stringify(rows)).not.toContain('PRIVATE-BANK-REF');
  });

  it('maps resolved bank and Partner deposit SLA records to their existing evidence pages', () => {
    const rows = buildOperationsHandoffFinanceDecisionRows([
      {
        action: 'company_bank_transaction.review_escalation_resolved',
        createdAt: '2026-07-29T03:00:00.000Z',
        id: 'audit-bank',
        metadata: { bankTransactionId: 'bank-transaction-1' },
        target: 'notification:notification-1',
      },
      {
        action: 'partner_bank_deposit.reconciliation_escalation_resolved',
        createdAt: '2026-07-29T04:00:00.000Z',
        id: 'audit-deposit',
        metadata: { partnerBankDepositRequestId: 'deposit-request-1' },
        target: 'notification:notification-2',
      },
      {
        action: 'booking.completed.closeout',
        createdAt: '2026-07-29T05:00:00.000Z',
        id: 'audit-unrelated',
        target: 'booking:booking-1',
      },
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      href: '/finance-tax/partner-bank-deposits/deposit-request-1',
      status: 'Resolved',
      title: 'Partner deposit SLA resolved',
    });
    expect(rows[1]).toMatchObject({
      href: '/finance-tax/bank-reconciliation/bank-transaction-1',
      status: 'Resolved',
      title: 'Bank reconciliation SLA resolved',
    });
  });

  it('maps completed wallet and Partner deposit decisions without treating requests as money movement', () => {
    const rows = buildOperationsHandoffFinanceDecisionRows([
      {
        action: 'wallet_adjustment_request.execute',
        actor: { fullName: 'Master Admin' },
        createdAt: '2026-07-29T05:00:00.000Z',
        id: 'audit-wallet',
        metadata: {
          approvalChannel: 'MASTER_ADMIN_CUSTOMER_DIRECT',
          ledgerEntryId: 'ledger-1',
        },
        target: 'manual_wallet_adjustment_request:wallet-request-1',
      },
      {
        action: 'wallet_adjustment_request.reject',
        createdAt: '2026-07-29T04:00:00.000Z',
        id: 'audit-wallet-rejected',
        metadata: { decisionReason: 'The supporting evidence is incomplete.' },
        target: 'manual_wallet_adjustment_request:wallet-request-2',
      },
      {
        action: 'partner_bank_deposit_request.execute',
        createdAt: '2026-07-29T03:00:00.000Z',
        id: 'audit-deposit-executed',
        metadata: { ledgerEntryId: 'provider-ledger-1' },
        target: 'partner_bank_deposit_request:deposit-request-1',
      },
      {
        action: 'partner_bank_deposit_request.create',
        createdAt: '2026-07-29T02:00:00.000Z',
        id: 'audit-open-request',
        target: 'partner_bank_deposit_request:deposit-request-open',
      },
    ]);

    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      detail: expect.stringContaining('Master Admin direct-adjustment policy'),
      href: '/wallet-adjustments',
      status: 'Executed',
      title: 'Manual wallet adjustment',
    });
    expect(rows[1]).toMatchObject({
      detail: 'The supporting evidence is incomplete.',
      status: 'Rejected',
    });
    expect(rows[2]).toMatchObject({
      href: '/finance-tax/partner-bank-deposits/deposit-request-1',
      status: 'Executed',
      title: 'Partner bank deposit',
    });
  });

  it('keeps only PAID payout updates and maps reversals as completed decisions', () => {
    const rows = buildOperationsHandoffFinanceDecisionRows([
      {
        action: 'payout_batch.update',
        createdAt: '2026-07-29T06:00:00.000Z',
        id: 'audit-processing',
        metadata: { status: 'PROCESSING' },
        target: 'payout_batch:payout-processing',
      },
      {
        action: 'payout_batch.update',
        createdAt: '2026-07-29T05:00:00.000Z',
        id: 'audit-paid',
        metadata: { approvalAdminId: 'approver-1', status: 'PAID' },
        target: 'payout_batch:payout-paid',
      },
      {
        action: 'payout_batch.reversal',
        createdAt: '2026-07-29T07:00:00.000Z',
        id: 'audit-reversed',
        metadata: { reason: 'Bank returned the transfer.' },
        target: 'payout_batch:payout-reversed',
      },
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      detail: 'Bank returned the transfer.',
      status: 'Reversed',
      title: 'Payout batch reversal',
    });
    expect(rows[1]).toMatchObject({
      status: 'Paid',
      title: 'Payout paid closeout',
    });
    expect(rows.map((row) => row.recordLabel)).not.toContain('Payout batch payout-pr...');
  });

  it('keeps only paid and rejected Partner withdrawal updates plus immutable reversals', () => {
    const rows = buildOperationsHandoffFinanceDecisionRows([
      {
        action: 'provider_wallet.withdrawal_request.update',
        createdAt: '2026-07-29T08:00:00.000Z',
        id: 'withdrawal-pending',
        metadata: { amount: 500000, currency: 'VND', status: 'BANK_TRANSFER_PENDING' },
        target: 'provider_wallet_withdrawal_request:withdrawal-pending',
      },
      {
        action: 'provider_wallet.withdrawal_request.update',
        actor: { fullName: 'Finance Approver' },
        createdAt: '2026-07-29T07:00:00.000Z',
        id: 'withdrawal-paid',
        metadata: { amount: 500000, currency: 'VND', status: 'PAID' },
        target: 'provider_wallet_withdrawal_request:withdrawal-paid',
      },
      {
        action: 'provider_wallet.withdrawal_request.update',
        createdAt: '2026-07-29T06:00:00.000Z',
        id: 'withdrawal-rejected',
        metadata: { amount: 300000, currency: 'VND', status: 'REJECTED' },
        target: 'provider_wallet_withdrawal_request:withdrawal-rejected',
      },
      {
        action: 'provider_wallet.withdrawal_request.reversal',
        createdAt: '2026-07-29T09:00:00.000Z',
        id: 'withdrawal-reversed',
        metadata: {
          amount: 500000,
          currency: 'VND',
          reason: 'Bank returned the transfer.',
        },
        target: 'provider_wallet_withdrawal_request:withdrawal-reversed',
      },
    ]);

    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      detail: 'Bank returned the transfer.',
      href: '/payouts?details=all&view=records&range=all',
      status: 'Reversed',
      title: 'Partner withdrawal reversal',
    });
    expect(rows[1]).toMatchObject({
      actorLabel: 'Finance Approver',
      detail: expect.stringContaining('500.000 VND'),
      status: 'Paid',
      title: 'Partner withdrawal paid',
    });
    expect(rows[2]).toMatchObject({
      detail: expect.stringContaining('without bank outflow'),
      status: 'Rejected',
      title: 'Partner withdrawal rejected',
    });
  });

  it('maps monthly review, declaration, withholding remittance, and final close decisions', () => {
    const rows = buildOperationsHandoffFinanceDecisionRows([
      {
        action: 'monthly_tax_closing.status_update',
        createdAt: '2026-07-29T04:00:00.000Z',
        id: 'closing-reviewed',
        metadata: { currency: 'VND', period: '2026-06', toStatus: 'REVIEWED' },
        target: 'monthly_tax_closing:2026-06:VND',
      },
      {
        action: 'monthly_tax_closing.status_update',
        createdAt: '2026-07-29T05:00:00.000Z',
        id: 'closing-declared',
        metadata: { currency: 'VND', period: '2026-06', toStatus: 'DECLARED' },
        target: 'monthly_tax_closing:2026-06:VND',
      },
      {
        action: 'monthly_tax_closing.status_update',
        createdAt: '2026-07-29T06:00:00.000Z',
        id: 'closing-paid',
        metadata: {
          currency: 'VND',
          period: '2026-06',
          remittance: {
            evidenceUrl: 'https://private.example/remittance.pdf',
            transferRef: 'VCB-TAX-202606',
          },
          toStatus: 'PAID',
        },
        target: 'monthly_tax_closing:2026-06:VND',
      },
      {
        action: 'monthly_tax_closing.status_update',
        createdAt: '2026-07-29T07:00:00.000Z',
        id: 'closing-closed',
        metadata: { currency: 'VND', period: '2026-06', toStatus: 'CLOSED' },
        target: 'monthly_tax_closing:2026-06:VND',
      },
      {
        action: 'monthly_tax_closing.status_update',
        createdAt: '2026-07-29T03:00:00.000Z',
        id: 'closing-draft',
        metadata: { currency: 'VND', period: '2026-06', toStatus: 'DRAFT' },
        target: 'monthly_tax_closing:2026-06:VND',
      },
    ]);

    expect(rows).toHaveLength(4);
    expect(rows.map((row) => row.status)).toEqual(['Closed', 'Paid', 'Declared', 'Reviewed']);
    expect(rows[0]).toMatchObject({
      href: '/finance-tax/monthly-tax-closing?period=2026-06',
      recordLabel: '2026-06 · VND',
      title: 'Monthly tax period closed',
    });
    expect(rows[1]).toMatchObject({
      detail: expect.stringContaining('balanced GL journal'),
      title: 'Partner withholding remittance paid',
    });
    expect(JSON.stringify(rows)).not.toContain('private.example');
    expect(JSON.stringify(rows)).not.toContain('VCB-TAX-202606');
  });

  it('maps only completed or rejected refunds and keeps settlement reversal evidence in one decision row', () => {
    const rows = buildOperationsHandoffFinanceDecisionRows([
      {
        action: 'payment.refund.request',
        createdAt: '2026-07-29T04:00:00.000Z',
        id: 'refund-requested',
        metadata: { refundId: 'refund-requested' },
        target: 'payment:payment-requested',
      },
      {
        action: 'payment.refund.provider-processing',
        createdAt: '2026-07-29T05:00:00.000Z',
        id: 'refund-processing',
        metadata: { refundId: 'refund-processing', status: 'PROVIDER_PROCESSING' },
        target: 'payment:payment-processing',
      },
      {
        action: 'payment.refund.reject',
        actor: { fullName: 'Finance Approver' },
        createdAt: '2026-07-29T06:00:00.000Z',
        id: 'refund-rejected',
        metadata: {
          reason: 'Chat evidence does not support a refund.',
          refundId: 'refund-rejected',
        },
        target: 'payment:payment-rejected',
      },
      {
        action: 'payment.refund',
        createdAt: '2026-07-29T07:00:00.000Z',
        id: 'refund-completed',
        metadata: {
          amount: 300000,
          earningCancellation: { earningId: 'earning-1', skipped: false },
          method: 'MOMO',
          settlementReversal: {
            settlementId: 'settlement-reversal-1',
            settlementStatus: 'REVERSED',
            skipped: false,
          },
        },
        target: 'payment:payment-completed',
      },
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      detail: expect.stringContaining('MOMO refund completed'),
      href: '/finance-tax/settlement-reversals/settlement-reversal-1',
      recordLabel: expect.stringContaining('Settlement reversal'),
      status: 'Refunded',
      title: 'Refund and settlement reversal completed',
    });
    expect(rows[1]).toMatchObject({
      actorLabel: 'Finance Approver',
      detail: 'Chat evidence does not support a refund.',
      href: '/payments/payment-rejected',
      status: 'Rejected',
      title: 'Refund request rejected',
    });
  });

  it('shows the Partner receivable outcome for a refund completed after payout', () => {
    const rows = buildOperationsHandoffFinanceDecisionRows([
      {
        action: 'payment.refund',
        createdAt: '2026-07-29T08:00:00.000Z',
        id: 'refund-after-payout',
        metadata: {
          amount: 500000,
          earningCancellation: {
            earningId: 'earning-paid-1',
            reason: 'PAID_REFUND_RECEIVABLE_CREATED',
            receivableAmount: 430000,
            skipped: false,
          },
          method: 'CARD',
          settlementReversal: {
            settlementId: 'settlement-reversal-paid-1',
            settlementStatus: 'REVERSED',
            skipped: false,
          },
        },
        target: 'payment:payment-after-payout',
      },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      detail: expect.stringContaining('Partner receivable evidence was recorded'),
      href: '/finance-tax/settlement-reversals/settlement-reversal-paid-1',
      status: 'Refunded',
      title: 'Refund and settlement reversal completed',
    });
    expect(rows[0]?.detail).toContain('430.000 VND');
  });
});
