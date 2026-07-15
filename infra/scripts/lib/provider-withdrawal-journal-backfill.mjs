export function buildProviderWithdrawalBackfillCandidate(input) {
  const metadata = record(input.request.metadata);
  const bankPayout = record(metadata.bankPayout);
  const lockPeriod = vietnamMonthlyPeriod(input.request.createdAt);
  const paidAt = validDate(bankPayout.bankTransferDate) ?? validDate(input.request.paidAt) ?? validDate(input.request.reviewedAt);
  const paidPeriod = paidAt ? vietnamMonthlyPeriod(paidAt) : null;
  const completedByAdminId = text(bankPayout.completedByAdminId) ?? text(input.request.reviewedByAdminId);
  const transferRef = text(input.request.transferRef) ?? text(bankPayout.transferRef);
  const hasAttachment = Boolean(text(bankPayout.attachmentFileId) ?? text(bankPayout.attachmentUrl));
  const missingPhases = [
    ...(input.existingPhases.has('lock') ? [] : ['LOCK']),
    ...(input.existingPhases.has('paid') ? [] : ['PAID']),
  ];
  const blockers = [];

  if (input.request.status !== 'PAID') blockers.push('STATUS_NOT_PAID');
  if (!input.request.providerProfile?.userId) blockers.push('PROVIDER_USER_MISSING');
  if (!input.providerUserExists) blockers.push('PROVIDER_USER_ACTOR_MISSING');
  if (!completedByAdminId) blockers.push('PAID_ADMIN_MISSING');
  if (completedByAdminId && !input.paidAdminExists) blockers.push('PAID_ADMIN_ACTOR_MISSING');
  if (!transferRef) blockers.push('TRANSFER_REFERENCE_MISSING');
  if (!paidAt || !paidPeriod) blockers.push('PAID_DATE_MISSING');
  if (!hasAttachment) blockers.push('TRANSFER_ATTACHMENT_MISSING');
  if (!input.walletLedgerValid) blockers.push('PAID_WALLET_LEDGER_INVALID');
  if (missingPhases.includes('LOCK') && input.closedPeriods.has(lockPeriod)) blockers.push('LOCK_PERIOD_CLOSED');
  if (paidPeriod && missingPhases.includes('PAID') && input.closedPeriods.has(paidPeriod)) blockers.push('PAID_PERIOD_CLOSED');

  return {
    blockers,
    completedByAdminId,
    eligible: missingPhases.length > 0 && blockers.length === 0,
    hasAttachment,
    lockPeriod,
    missingPhases,
    paidAt,
    paidPeriod,
    transferRef,
  };
}

export function providerWithdrawalJournalCreateData(input) {
  const phase = input.phase;
  const sourceKey = `accounting-journal:provider-withdrawal:${input.requestId}:${phase.toLowerCase()}`;
  const metadata = {
    backfilledAt: input.backfilledAt.toISOString(),
    backfilledByAdminId: input.backfilledByAdminId,
    historicalBackfill: true,
    providerProfileId: input.providerProfileId,
    withdrawalPhase: phase,
    withdrawalRequestId: input.requestId,
    ...(input.transferRef ? { transferRef: input.transferRef } : {}),
  };
  const accounts = phase === 'LOCK'
    ? {
        debitCode: 'partner_wallet_liability',
        debitName: 'Partner wallet liability',
        creditCode: 'partner_withdrawal_payable',
        creditName: 'Partner withdrawal payable',
      }
    : {
        debitCode: 'partner_withdrawal_payable',
        debitName: 'Partner withdrawal payable',
        creditCode: 'company_bank_cash',
        creditName: 'Company bank / cash',
      };
  const memo = `Partner withdrawal ${phase.toLowerCase()} ${input.requestId}`;
  const entry = (side, accountCode, accountName) => ({
    accountCode,
    accountName,
    amount: input.amount,
    currency: input.currency,
    memo,
    metadata,
    side,
    sourceId: input.requestId,
    sourceType: 'PROVIDER_WITHDRAWAL',
  });

  return {
    createdById: input.createdById,
    currency: input.currency,
    entries: {
      create: [
        entry('DEBIT', accounts.debitCode, accounts.debitName),
        entry('CREDIT', accounts.creditCode, accounts.creditName),
      ],
    },
    metadata,
    monthlyPeriod: input.monthlyPeriod,
    postedAt: input.postedAt,
    providerProfileId: input.providerProfileId,
    sourceId: input.requestId,
    sourceKey,
    sourceType: 'PROVIDER_WITHDRAWAL',
    status: 'POSTED',
    totalCredit: input.amount,
    totalDebit: input.amount,
  };
}

export function vietnamMonthlyPeriod(value) {
  const date = validDate(value);
  if (!date) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date);
  return `${parts.find((part) => part.type === 'year')?.value}-${parts.find((part) => part.type === 'month')?.value}`;
}

function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function text(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function validDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
