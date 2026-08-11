import type { StatusBadgeTone } from '../../components/status-badge';
import { formatMoney, readPlainRecord, shortDisplayId } from '../../lib/admin-format';
import type { AdminAuditLog } from '../../lib/admin-api';

export const OPERATIONS_HANDOFF_FINANCE_DECISION_ACTIONS = [
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
] as const;

export type OperationsHandoffFinanceDecisionRow = {
  readonly actorLabel: string;
  readonly completedAt: string;
  readonly detail: string;
  readonly href: string;
  readonly id: string;
  readonly recordLabel: string;
  readonly status:
    | 'Approved'
    | 'Cancelled'
    | 'Closed'
    | 'Declared'
    | 'Executed'
    | 'Matched'
    | 'Paid'
    | 'Partially matched'
    | 'Rejected'
    | 'Refunded'
    | 'Resolved'
    | 'Reviewed'
    | 'Reversed';
  readonly title: string;
  readonly tone: StatusBadgeTone;
};

const financeDecisionActions = new Set<string>(OPERATIONS_HANDOFF_FINANCE_DECISION_ACTIONS);

export function buildOperationsHandoffFinanceDecisionRows(
  auditLogs: readonly AdminAuditLog[],
): OperationsHandoffFinanceDecisionRow[] {
  return auditLogs
    .filter((log) => financeDecisionActions.has(log.action))
    .map(financeDecisionRow)
    .filter((row): row is OperationsHandoffFinanceDecisionRow => row !== null)
    .sort((left, right) => Date.parse(right.completedAt) - Date.parse(left.completedAt));
}

function financeDecisionRow(log: AdminAuditLog): OperationsHandoffFinanceDecisionRow | null {
  if (log.action.startsWith('company_bank_account.')) {
    return companyBankAccountDecisionRow(log);
  }
  if (log.action.startsWith('bank_reconciliation.')) {
    return bankReconciliationDecisionRow(log);
  }
  if (log.action.startsWith('wallet_adjustment_request.')) {
    return walletAdjustmentDecisionRow(log);
  }
  if (log.action.startsWith('partner_bank_deposit_request.')) {
    return partnerBankDepositDecisionRow(log);
  }
  if (log.action.startsWith('payout_batch.')) {
    return payoutDecisionRow(log);
  }
  if (log.action.startsWith('provider_wallet.withdrawal_request.')) {
    return partnerWithdrawalDecisionRow(log);
  }
  if (log.action === 'monthly_tax_closing.status_update') {
    return monthlyTaxClosingDecisionRow(log);
  }
  if (log.action === 'payment.refund' || log.action === 'payment.refund.reject') {
    return refundDecisionRow(log);
  }

  return financeReviewResolutionRow(log);
}

function bankReconciliationDecisionRow(
  log: AdminAuditLog,
): OperationsHandoffFinanceDecisionRow {
  const metadata = readPlainRecord(log.metadata);
  const bankTransactionId =
    readString(metadata?.bankTransactionId)
    || targetId(log.target, 'bank_transaction:');
  const amount = readNumber(metadata?.amount);
  const currency = readString(metadata?.currency) || 'VND';
  const amountLabel = amount === null ? '' : formatMoney(Math.abs(amount), currency);
  const reason = readString(metadata?.reason);
  const sourceType = readString(metadata?.sourceType);
  const sourceLabel = bankReconciliationSourceLabel(sourceType);
  const reversed = log.action === 'bank_reconciliation.match.reverse';
  const cleared = log.action === 'bank_reconciliation.transaction.ignore';
  const partiallyMatched =
    !reversed
    && !cleared
    && readString(metadata?.bankStatusAfter) === 'PARTIALLY_MATCHED';

  return {
    actorLabel: auditActorLabel(log),
    completedAt: log.createdAt,
    detail: reversed
      ? reason || `${amountLabel ? `${amountLabel} ` : ''}reconciliation evidence was reversed and the bank row returned to review.`
      : cleared
        ? reason || `${amountLabel ? `${amountLabel} ` : ''}bank row was reviewed and cleared without creating a reconciliation match.`
        : `${amountLabel ? `${amountLabel} ` : ''}bank evidence was ${partiallyMatched ? 'partially ' : ''}matched${sourceLabel ? ` to ${sourceLabel}` : ''}.`,
    href: `/finance-tax/bank-reconciliation/${bankTransactionId}`,
    id: log.id,
    recordLabel: `Bank transaction ${shortDisplayId(bankTransactionId)}`,
    status: reversed ? 'Reversed' : cleared ? 'Resolved' : partiallyMatched ? 'Partially matched' : 'Matched',
    title: reversed
      ? 'Bank reconciliation match reversed'
      : cleared
        ? 'Bank transaction cleared without match'
        : partiallyMatched
          ? 'Bank transaction partially matched'
          : 'Bank transaction matched',
    tone: reversed ? 'warning' : cleared ? 'info' : partiallyMatched ? 'warning' : 'success',
  };
}

function bankReconciliationSourceLabel(sourceType: string) {
  switch (sourceType) {
    case 'payment-clearing':
      return 'payment clearing';
    case 'partner-bank-deposit':
      return 'a Partner bank deposit';
    case 'withdrawal':
      return 'a Partner withdrawal';
    case 'payout-batch':
      return 'a payout batch';
    case 'accounting-journal':
      return 'an accounting journal';
    default:
      return '';
  }
}

function companyBankAccountDecisionRow(
  log: AdminAuditLog,
): OperationsHandoffFinanceDecisionRow {
  const metadata = readPlainRecord(log.metadata);
  const after = readPlainRecord(metadata?.after);
  const rejected = log.action === 'company_bank_account.approval_rejected';
  const operation = readString(metadata?.operation);
  const accountId = targetId(log.target, 'company_bank_account:');
  const accountLabel = [
    readString(after?.name),
    readString(after?.bankName),
    readString(after?.currency),
  ]
    .filter(Boolean)
    .join(' · ');
  const decisionReason = readString(metadata?.decisionReason);

  return {
    actorLabel: auditActorLabel(log),
    completedAt: log.createdAt,
    detail: rejected
      ? decisionReason || 'The requested bank account change was rejected.'
      : operation === 'CREATE'
        ? 'A maker request passed independent approval and the account was created.'
        : 'A maker request passed independent approval and the account change was applied.',
    href: '/finance-tax/company-bank-accounts',
    id: log.id,
    recordLabel: accountLabel || `Bank account ${shortDisplayId(accountId)}`,
    status: rejected ? 'Rejected' : 'Approved',
    title: operation === 'CREATE'
      ? 'Company bank account creation'
      : 'Company bank account change',
    tone: rejected ? 'danger' : 'success',
  };
}

function walletAdjustmentDecisionRow(
  log: AdminAuditLog,
): OperationsHandoffFinanceDecisionRow {
  const metadata = readPlainRecord(log.metadata);
  const requestId = targetId(log.target, 'manual_wallet_adjustment_request:');
  const decisionReason = readString(metadata?.decisionReason);
  const isRejected = log.action === 'wallet_adjustment_request.reject';
  const isCancelled = log.action === 'wallet_adjustment_request.cancel_stale';
  const directMasterApproval =
    readString(metadata?.approvalChannel) === 'MASTER_ADMIN_CUSTOMER_DIRECT';

  return {
    actorLabel: auditActorLabel(log),
    completedAt: log.createdAt,
    detail: isRejected
      ? decisionReason || 'The manual wallet adjustment request was rejected without ledger movement.'
      : isCancelled
        ? decisionReason || 'The stale request was cancelled after its wallet balance changed; no ledger or journal was posted.'
        : directMasterApproval
          ? 'The customer wallet adjustment was applied immediately under the Master Admin direct-adjustment policy.'
          : 'The approved request posted an immutable wallet ledger entry and balanced accounting evidence.',
    href: '/wallet-adjustments',
    id: log.id,
    recordLabel: `Wallet request ${shortDisplayId(requestId)}`,
    status: isRejected ? 'Rejected' : isCancelled ? 'Cancelled' : 'Executed',
    title: isCancelled ? 'Stale wallet request cancelled' : 'Manual wallet adjustment',
    tone: isRejected ? 'danger' : isCancelled ? 'warning' : 'success',
  };
}

function partnerBankDepositDecisionRow(
  log: AdminAuditLog,
): OperationsHandoffFinanceDecisionRow {
  const metadata = readPlainRecord(log.metadata);
  const requestId = targetId(log.target, 'partner_bank_deposit_request:');
  const rejected = log.action === 'partner_bank_deposit_request.reject';
  const decisionReason = readString(metadata?.decisionReason);

  return {
    actorLabel: auditActorLabel(log),
    completedAt: log.createdAt,
    detail: rejected
      ? decisionReason || 'The Partner bank deposit request was rejected without wallet or journal movement.'
      : 'The approved deposit posted the Partner wallet ledger, balanced journal, and bank evidence link.',
    href: `/finance-tax/partner-bank-deposits/${requestId}`,
    id: log.id,
    recordLabel: `Deposit request ${shortDisplayId(requestId)}`,
    status: rejected ? 'Rejected' : 'Executed',
    title: 'Partner bank deposit',
    tone: rejected ? 'danger' : 'success',
  };
}

function payoutDecisionRow(
  log: AdminAuditLog,
): OperationsHandoffFinanceDecisionRow | null {
  const metadata = readPlainRecord(log.metadata);
  const payoutBatchId = targetId(log.target, 'payout_batch:');
  const reversed = log.action === 'payout_batch.reversal';
  if (!reversed && readString(metadata?.status) !== 'PAID') {
    return null;
  }
  const reason = readString(metadata?.reason);

  return {
    actorLabel: auditActorLabel(log),
    completedAt: log.createdAt,
    detail: reversed
      ? reason || 'The paid payout was reversed with wallet and journal reversal evidence.'
      : 'An independent Finance approver completed paid closeout after transfer and journal checks.',
    href: '/payouts?details=all&view=records&range=all',
    id: log.id,
    recordLabel: `Payout batch ${shortDisplayId(payoutBatchId)}`,
    status: reversed ? 'Reversed' : 'Paid',
    title: reversed ? 'Payout batch reversal' : 'Payout paid closeout',
    tone: reversed ? 'warning' : 'success',
  };
}

function partnerWithdrawalDecisionRow(
  log: AdminAuditLog,
): OperationsHandoffFinanceDecisionRow | null {
  const metadata = readPlainRecord(log.metadata);
  const requestId = targetId(log.target, 'provider_wallet_withdrawal_request:');
  const reversed = log.action === 'provider_wallet.withdrawal_request.reversal';
  const status = readString(metadata?.status);
  if (!reversed && status !== 'PAID' && status !== 'REJECTED') {
    return null;
  }

  const amount = readNumber(metadata?.amount);
  const currency = readString(metadata?.currency) || 'VND';
  const amountLabel = amount === null ? '' : formatMoney(amount, currency);
  const reason = readString(metadata?.reason);
  const rejected = status === 'REJECTED';

  return {
    actorLabel: auditActorLabel(log),
    completedAt: log.createdAt,
    detail: reversed
      ? reason || 'The paid withdrawal was reversed with immutable wallet and journal evidence.'
      : rejected
        ? `${amountLabel ? `${amountLabel} ` : ''}withdrawal was rejected and its reserved wallet liability was released without bank outflow.`
        : `${amountLabel ? `${amountLabel} ` : ''}withdrawal reached paid closeout after independent approval and bank evidence checks.`,
    href: '/payouts?details=all&view=records&range=all',
    id: log.id,
    recordLabel: `Withdrawal ${shortDisplayId(requestId)}`,
    status: reversed ? 'Reversed' : rejected ? 'Rejected' : 'Paid',
    title: reversed
      ? 'Partner withdrawal reversal'
      : rejected
        ? 'Partner withdrawal rejected'
        : 'Partner withdrawal paid',
    tone: reversed ? 'warning' : rejected ? 'danger' : 'success',
  };
}

function monthlyTaxClosingDecisionRow(
  log: AdminAuditLog,
): OperationsHandoffFinanceDecisionRow | null {
  const metadata = readPlainRecord(log.metadata);
  const toStatus = readString(metadata?.toStatus);
  if (!['REVIEWED', 'DECLARED', 'PAID', 'CLOSED'].includes(toStatus)) {
    return null;
  }

  const period = readString(metadata?.period) || monthlyTaxClosingTarget(log.target).period;
  const currency = readString(metadata?.currency) || monthlyTaxClosingTarget(log.target).currency;
  const statusModel = monthlyTaxClosingStatusModel(toStatus);

  return {
    actorLabel: auditActorLabel(log),
    completedAt: log.createdAt,
    detail: statusModel.detail,
    href: `/finance-tax/monthly-tax-closing?period=${encodeURIComponent(period)}`,
    id: log.id,
    recordLabel: [period, currency].filter(Boolean).join(' · ') || 'Monthly tax period',
    status: statusModel.status,
    title: statusModel.title,
    tone: statusModel.tone,
  };
}

function monthlyTaxClosingStatusModel(status: string): Pick<
  OperationsHandoffFinanceDecisionRow,
  'detail' | 'status' | 'title' | 'tone'
> {
  switch (status) {
    case 'REVIEWED':
      return {
        detail: 'Finance completed period review and moved the reconciled records toward declaration.',
        status: 'Reviewed',
        title: 'Monthly tax period reviewed',
        tone: 'info',
      };
    case 'DECLARED':
      return {
        detail: 'The tax declaration was recorded and linked settlement snapshots were marked declared.',
        status: 'Declared',
        title: 'Monthly tax declaration filed',
        tone: 'info',
      };
    case 'PAID':
      return {
        detail: 'Partner withholding remittance was paid with separate approval, bank evidence, and a balanced GL journal.',
        status: 'Paid',
        title: 'Partner withholding remittance paid',
        tone: 'success',
      };
    default:
      return {
        detail: 'The monthly tax period was closed. Source records are read-only and corrections require reversal entries.',
        status: 'Closed',
        title: 'Monthly tax period closed',
        tone: 'success',
      };
  }
}

function refundDecisionRow(log: AdminAuditLog): OperationsHandoffFinanceDecisionRow {
  const metadata = readPlainRecord(log.metadata);
  const settlementReversal = readPlainRecord(metadata?.settlementReversal);
  const earningCancellation = readPlainRecord(metadata?.earningCancellation);
  const paymentId = targetId(log.target, 'payment:');
  const rejected = log.action === 'payment.refund.reject';
  const reason = readString(metadata?.reason);
  const amount = readNumber(metadata?.amount);
  const amountLabel = amount === null ? '' : formatMoney(amount, 'VND');
  const paymentMethod = readString(metadata?.method);
  const settlementId = readString(settlementReversal?.settlementId);
  const settlementReversed =
    settlementReversal?.skipped !== true
    && readString(settlementReversal?.settlementStatus) === 'REVERSED';
  const receivableAmount = readNumber(earningCancellation?.receivableAmount);
  const refundAfterPayout =
    readString(earningCancellation?.reason) === 'PAID_REFUND_RECEIVABLE_CREATED';

  return {
    actorLabel: auditActorLabel(log),
    completedAt: log.createdAt,
    detail: rejected
      ? reason || 'The refund request was rejected without payment, wallet, settlement, or journal movement.'
      : refundAfterPayout
        ? `${amountLabel ? `${amountLabel} ` : ''}refund completed after payout; ${formatMoney(receivableAmount ?? 0, 'VND')} Partner receivable evidence was recorded.`
        : settlementReversed
          ? `${amountLabel ? `${amountLabel} ` : ''}${paymentMethod ? `${paymentMethod} ` : ''}refund completed with an immutable settlement reversal and accounting evidence.`
          : `${amountLabel ? `${amountLabel} ` : ''}${paymentMethod ? `${paymentMethod} ` : ''}refund completed; no posted settlement snapshot required reversal.`,
    href: settlementReversed && settlementId
      ? `/finance-tax/settlement-reversals/${settlementId}`
      : `/payments/${paymentId}`,
    id: log.id,
    recordLabel: settlementReversed && settlementId
      ? `Settlement reversal ${shortDisplayId(settlementId)}`
      : `Payment ${shortDisplayId(paymentId)}`,
    status: rejected ? 'Rejected' : 'Refunded',
    title: rejected
      ? 'Refund request rejected'
      : settlementReversed
        ? 'Refund and settlement reversal completed'
        : 'Refund completed',
    tone: rejected ? 'danger' : 'success',
  };
}

function financeReviewResolutionRow(
  log: AdminAuditLog,
): OperationsHandoffFinanceDecisionRow {
  const metadata = readPlainRecord(log.metadata);
  const partnerDepositRequestId = readString(metadata?.partnerBankDepositRequestId);
  const bankTransactionId = readString(metadata?.bankTransactionId);
  const batchImportId = readString(metadata?.batchImportId);
  const isPartnerDeposit =
    log.action === 'partner_bank_deposit.reconciliation_escalation_resolved';
  const sourceId = partnerDepositRequestId || bankTransactionId || batchImportId;

  return {
    actorLabel: auditActorLabel(log),
    completedAt: log.createdAt,
    detail: isPartnerDeposit
      ? 'The overdue Partner deposit review was closed after reconciliation evidence became complete.'
      : 'The overdue bank reconciliation review was closed after its source was matched or cleared.',
    href: financeReviewHref({
      bankTransactionId,
      batchImportId,
      partnerDepositRequestId,
    }),
    id: log.id,
    recordLabel: sourceId
      ? `${isPartnerDeposit ? 'Deposit' : 'Bank record'} ${shortDisplayId(sourceId)}`
      : 'Finance review alert',
    status: 'Resolved',
    title: isPartnerDeposit
      ? 'Partner deposit SLA resolved'
      : 'Bank reconciliation SLA resolved',
    tone: 'info',
  };
}

function financeReviewHref(input: {
  readonly bankTransactionId: string;
  readonly batchImportId: string;
  readonly partnerDepositRequestId: string;
}) {
  if (input.partnerDepositRequestId) {
    return `/finance-tax/partner-bank-deposits/${input.partnerDepositRequestId}`;
  }
  if (input.bankTransactionId) {
    return `/finance-tax/bank-reconciliation/${input.bankTransactionId}`;
  }
  if (input.batchImportId) {
    return `/finance-tax/bank-reconciliation/import-batches/${input.batchImportId}`;
  }
  return '/finance-tax/bank-reconciliation';
}

function auditActorLabel(log: AdminAuditLog) {
  return log.actor?.fullName
    ?? log.actor?.email
    ?? log.actor?.phone
    ?? log.actor?.id
    ?? 'System';
}

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function readNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function targetId(target: string, prefix: string) {
  return target.startsWith(prefix) ? target.slice(prefix.length) : target;
}

function monthlyTaxClosingTarget(target: string) {
  const parts = targetId(target, 'monthly_tax_closing:').split(':');
  return {
    period: parts[0] ?? '',
    currency: parts[1] ?? '',
  };
}
