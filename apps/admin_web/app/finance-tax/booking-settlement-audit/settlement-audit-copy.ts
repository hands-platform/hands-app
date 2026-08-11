import type { AdminSettlementAuditHealth } from '../../../lib/admin-api';

type BlockerCode = AdminSettlementAuditHealth['blockers'][number]['code'];
type Workflow = NonNullable<AdminSettlementAuditHealth['workflow']>;

export function settlementAuditBlockerLabel(code: BlockerCode) {
  return code
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function settlementAuditBlockerShortLabel(code: BlockerCode) {
  const labels: Partial<Record<BlockerCode, string>> = {
    ALLOCATION_DELTA: 'Allocation',
    BANK_MATCH_INCOMPLETE: 'Bank match',
    CANONICAL_CLEARING_MISSING: 'Clearing missing',
    CANONICAL_JOURNAL_MISSING: 'Journal missing',
    CLEARING_AMOUNT_MISMATCH: 'Clearing amount',
    CLEARING_STILL_OPEN: 'Clearing open',
    COUPON_EVIDENCE_MISSING: 'Coupon evidence',
    PAYMENT_FEE_POLICY_MISSING: 'Fee policy',
    REVERSAL_CLEARING_MISSING: 'Reversal clearing',
    REVERSAL_JOURNAL_MISSING: 'Reversal journal',
    REVERSAL_LEDGER_MISSING: 'Reversal ledger',
    TAX_PERIOD_MISMATCH: 'Tax period',
  };
  return labels[code] ?? settlementAuditBlockerLabel(code);
}

export function settlementAuditRemediationLabel(code: BlockerCode) {
  if (code.includes('JOURNAL')) return 'Open journal';
  if (code.includes('CLEARING') || code === 'BANK_MATCH_INCOMPLETE') return 'Open clearing';
  if (code.includes('TAX_PERIOD')) return 'Review tax period';
  if (code.includes('COUPON')) return 'Review coupon evidence';
  if (code.includes('FEE')) return 'Review fee policy';
  if (code.includes('REVERSAL')) return 'Open reversal evidence';
  return 'Open remediation workspace';
}

export function settlementAuditDueLabel(
  dueAt: string | null | undefined,
  priority: number | undefined,
) {
  if (dueAt) return `Due ${formatSettlementAuditTimestamp(dueAt)}`;
  return priority != null ? `Priority ${priority} · no due date recorded` : 'No due date recorded';
}

export function settlementAuditOwnerLabel(owner: string) {
  if (owner === 'finance-operations') return 'Finance Operations';
  if (owner === 'tax-period-close') return 'Tax & Period Close';
  if (owner === 'accounting') return 'Accounting';
  return owner;
}

export function settlementAuditWorkflowStateLabel(state: Workflow['state'] | undefined) {
  if (state === 'TAX_OPEN') return 'Tax workflow open';
  if (state === 'TAX_DECLARED') return 'Tax declared';
  if (state === 'TAX_PAID') return 'Tax paid';
  if (state === 'TAX_CLOSED') return 'Tax closed';
  if (state === 'REVERSED') return 'Settlement reversed';
  return 'Tax workflow unknown';
}

export function settlementAuditWorkflowUrgencyLabel(urgency: Workflow['urgency']) {
  if (urgency === 'DUE_SOON') return 'Due soon';
  if (urgency === 'OVERDUE') return 'Overdue';
  if (urgency === 'BLOCKED') return 'Blocked';
  if (urgency === 'UNKNOWN') return 'Due date unknown';
  return 'On schedule';
}

export function settlementAuditWorkflowUrgencyTone(urgency: Workflow['urgency']) {
  if (urgency === 'OVERDUE' || urgency === 'BLOCKED') return 'danger' as const;
  if (urgency === 'DUE_SOON' || urgency === 'UNKNOWN') return 'warning' as const;
  return 'success' as const;
}

export function formatSettlementAuditTimestamp(value: string | null | undefined) {
  if (!value) return 'not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'not recorded';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
    timeZoneName: 'short',
    year: 'numeric',
  }).format(date);
}

export function settlementAuditAgeLabel(value: string | null | undefined, checkedAt: string) {
  if (!value || !checkedAt) return null;
  const ageMs = new Date(checkedAt).getTime() - new Date(value).getTime();
  if (!Number.isFinite(ageMs) || ageMs < 0) return null;
  const hours = Math.floor(ageMs / 3_600_000);
  return hours >= 48 ? `${Math.floor(hours / 24)}d` : `${hours}h`;
}

export function settlementAuditFormulaLabel() {
  return 'Allocation rule: Customer payment + HANDS-funded coupon';
}
