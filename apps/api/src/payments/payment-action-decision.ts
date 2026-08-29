export const PAYMENT_ACTION_POLICY_VERSION = 'admin-payment-actions-v1';

export type PaymentAdminAction = 'SYNC' | 'CAPTURE' | 'RELEASE' | 'REQUEST_REFUND';
export type PaymentActionDecisionState = 'AVAILABLE' | 'REVIEW_REQUIRED' | 'BLOCKED';
export type PaymentEvidenceState = 'VERIFIED' | 'MISSING' | 'CONFLICT' | 'NOT_APPLICABLE';
export type PaymentPrimaryQueue =
  | 'evidence-conflict'
  | 'missing-gateway-evidence'
  | 'capture-ready'
  | 'release-recommended'
  | 'terminal-cash-cleanup'
  | 'completed-authorization-blocked'
  | 'cash-debt'
  | 'active-cash'
  | 'failed-active'
  | 'needs-action'
  | 'authorized-diagnostic'
  | 'history-captured'
  | 'history-refunded'
  | 'history-released';

export type PaymentActionDecision = {
  readonly action: PaymentAdminAction;
  readonly state: PaymentActionDecisionState;
  readonly recommended: boolean;
  readonly reasonCode: string;
  readonly reason: string;
  readonly requiredEvidence: readonly string[];
  readonly verifiedAt: string | null;
  readonly policyVersion: string;
};

export type PaymentActionDecisionRecord = {
  readonly amount: number;
  readonly bookingId: string;
  readonly method: string;
  readonly providerRef?: string | null;
  readonly rawMeta?: unknown;
  readonly status: string;
  readonly booking?: {
    readonly status?: string | null;
    readonly earning?: {
      readonly netAmount?: number | null;
      readonly status?: string | null;
    } | null;
    readonly customerWalletLedgerEntries?: readonly {
      readonly amount: number;
      readonly createdAt?: Date | string | null;
      readonly sourceKey?: string | null;
      readonly updatedAt?: Date | string | null;
    }[];
  } | null;
  readonly callbackAttempts?: readonly {
    readonly callbackAmount?: number | null;
    readonly createdAt?: Date | string | null;
    readonly outcome?: string | null;
    readonly signatureVerified?: boolean | null;
  }[];
};

export type PaymentEvidenceSummary = {
  readonly state: PaymentEvidenceState;
  readonly label: string;
  readonly reason: string;
  readonly verifiedAt: string | null;
};

export type PaymentOperationDecision = {
  readonly actionDecisions: readonly PaymentActionDecision[];
  readonly availableActions: readonly PaymentAdminAction[];
  readonly blockedActions: readonly PaymentAdminAction[];
  readonly evaluatedAt: string;
  readonly evidence: PaymentEvidenceSummary;
  readonly primaryAction: PaymentActionDecision | null;
  readonly primaryQueue: PaymentPrimaryQueue;
};

const EXTERNAL_METHODS = new Set(['MOMO', 'VNPAY', 'CARD', 'BANK_TRANSFER']);
const TERMINAL_PAYMENT_STATUSES = new Set(['CAPTURED', 'REFUNDED', 'RELEASED']);
const NON_CAPTURE_BOOKING_STATUSES = new Set(['CANCELLED', 'EXPIRED', 'NO_SHOW', 'REFUNDED']);
const ACTIVE_BOOKING_STATUSES = new Set([
  'CREATED',
  'OPEN_MATCHING',
  'MATCHED',
  'PROVIDER_ON_THE_WAY',
  'ARRIVED',
  'IN_SERVICE',
]);

export function paymentActionDecisions(record: PaymentActionDecisionRecord): PaymentActionDecision[] {
  const evidence = paymentEvidenceSummary(record);
  const bookingStatus = record.booking?.status ?? 'UNKNOWN';
  const capture = captureDecision(record, evidence, bookingStatus);
  const release = releaseDecision(record, evidence, bookingStatus);
  const refund = refundDecision(record);
  const sync = syncDecision(record, evidence);
  const decisions = [sync, capture, release, refund];
  const primaryAction = primaryActionFor(record, evidence, decisions);

  return decisions.map((candidate) => ({
    ...candidate,
    recommended: candidate.action === primaryAction,
  }));
}

export function paymentOperationDecision(
  record: PaymentActionDecisionRecord,
  evaluatedAt = new Date().toISOString(),
): PaymentOperationDecision {
  const evidence = paymentEvidenceSummary(record);
  const actionDecisions = paymentActionDecisions(record);
  const primaryAction = actionDecisions.find((candidate) => candidate.recommended) ?? null;
  return {
    actionDecisions,
    availableActions: actionDecisions
      .filter((candidate) => paymentActionCanExecute(candidate))
      .map((candidate) => candidate.action),
    blockedActions: actionDecisions
      .filter((candidate) => !paymentActionCanExecute(candidate))
      .map((candidate) => candidate.action),
    evaluatedAt,
    evidence,
    primaryAction,
    primaryQueue: paymentPrimaryQueue(record, evidence, actionDecisions),
  };
}

export function paymentActionDecision(
  record: PaymentActionDecisionRecord,
  action: PaymentAdminAction,
): PaymentActionDecision {
  return paymentActionDecisions(record).find((decision) => decision.action === action)!;
}

export function paymentEvidenceSummary(record: PaymentActionDecisionRecord): PaymentEvidenceSummary {
  if (record.method === 'CASH') {
    const meta = jsonRecord(record.rawMeta);
    const collectedAt = stringValue(meta.cashCollectedAt);
    const collectionReference = stringValue(meta.cashCollectionReference);
    const collectedBy = stringValue(meta.cashCollectedBy);
    if (collectedAt && collectionReference && collectedBy) {
      return {
        state: 'VERIFIED',
        label: 'Verified',
        reason: 'Cash collection time, collector, and receipt reference are recorded.',
        verifiedAt: collectedAt,
      };
    }
    return {
      state: 'MISSING',
      label: 'Missing',
      reason: 'Cash collection evidence is incomplete.',
      verifiedAt: null,
    };
  }

  if (record.method === 'CUSTOMER_WALLET') {
    const reservation = record.booking?.customerWalletLedgerEntries?.find(
      (entry) => entry.amount < 0 && entry.sourceKey?.includes(record.bookingId),
    );
    if (!reservation) {
      return {
        state: 'MISSING',
        label: 'Missing',
        reason: 'Customer wallet reservation ledger evidence is missing.',
        verifiedAt: null,
      };
    }
    return {
      state: 'VERIFIED',
      label: 'Verified',
      reason: 'Customer wallet reservation ledger evidence is recorded.',
      verifiedAt: isoValue(reservation.updatedAt) ?? isoValue(reservation.createdAt),
    };
  }

  if (!EXTERNAL_METHODS.has(record.method)) {
    return {
      state: 'NOT_APPLICABLE',
      label: 'N/A',
      reason: 'This payment method has no supported gateway evidence contract.',
      verifiedAt: null,
    };
  }

  const attempts = record.callbackAttempts ?? [];
  const conflictingAttempt = attempts.find(
    (attempt) =>
      (attempt.outcome !== 'ACCEPTED' && attempt.outcome !== 'REPLAY') ||
      attempt.signatureVerified !== true ||
      (typeof attempt.callbackAmount === 'number' && attempt.callbackAmount !== record.amount),
  );
  if (conflictingAttempt) {
    return {
      state: 'CONFLICT',
      label: 'Conflict',
      reason: 'Gateway callback signature, outcome, or amount conflicts with the payment record.',
      verifiedAt: isoValue(conflictingAttempt.createdAt),
    };
  }

  const verifiedAttempt = attempts.find(
    (attempt) =>
      (attempt.outcome === 'ACCEPTED' || attempt.outcome === 'REPLAY') &&
      attempt.signatureVerified === true &&
      (attempt.callbackAmount == null || attempt.callbackAmount === record.amount),
  );
  if (record.providerRef && verifiedAttempt) {
    return {
      state: 'VERIFIED',
      label: 'Verified',
      reason: 'Gateway reference and verified callback evidence are recorded.',
      verifiedAt: isoValue(verifiedAttempt.createdAt),
    };
  }

  return {
    state: 'MISSING',
    label: 'Missing',
    reason: record.providerRef
      ? 'No verified gateway callback attempt is recorded.'
      : 'Gateway reference and verified callback evidence are missing.',
    verifiedAt: null,
  };
}

export function paymentActionCanExecute(decision: PaymentActionDecision): boolean {
  return decision.state === 'AVAILABLE' ||
    (decision.action === 'REQUEST_REFUND' && decision.state === 'REVIEW_REQUIRED');
}

function captureDecision(
  record: PaymentActionDecisionRecord,
  evidence: PaymentEvidenceSummary,
  bookingStatus: string,
): PaymentActionDecision {
  const requiredStatus = record.method === 'CASH' ? 'PENDING' : 'AUTHORIZED';
  if (record.status !== requiredStatus) {
    return decision('CAPTURE', 'BLOCKED', false, 'PAYMENT_STATE_NOT_CAPTURABLE',
      `Capture requires payment state ${requiredStatus}; current state is ${record.status}.`, [], null);
  }
  if (bookingStatus !== 'COMPLETED') {
    return decision('CAPTURE', 'BLOCKED', false, 'BOOKING_NOT_COMPLETED',
      `Capture requires a COMPLETED booking; current booking state is ${bookingStatus}.`,
      ['Verified booking completion'], null);
  }
  if (evidence.state !== 'VERIFIED') {
    return decision('CAPTURE', 'BLOCKED', false, 'PAYMENT_EVIDENCE_NOT_VERIFIED',
      evidence.reason, captureEvidence(record.method), evidence.verifiedAt);
  }
  return decision('CAPTURE', 'AVAILABLE', true, 'CAPTURE_READY',
    'Booking completion and payment evidence are verified.', captureEvidence(record.method), evidence.verifiedAt);
}

function releaseDecision(
  record: PaymentActionDecisionRecord,
  evidence: PaymentEvidenceSummary,
  bookingStatus: string,
): PaymentActionDecision {
  if (record.method === 'CASH') {
    return decision('RELEASE', 'BLOCKED', false, 'CASH_HAS_NO_AUTHORIZATION_HOLD',
      'Cash payments do not have an authorization hold to release.', [], null);
  }
  if (record.status !== 'AUTHORIZED') {
    return decision('RELEASE', 'BLOCKED', false, 'PAYMENT_STATE_NOT_RELEASEABLE',
      `Release requires payment state AUTHORIZED; current state is ${record.status}.`, [], null);
  }
  if (!NON_CAPTURE_BOOKING_STATUSES.has(bookingStatus)) {
    return decision('RELEASE', 'BLOCKED', false, 'BOOKING_STATE_NOT_RELEASEABLE',
      `Release is reserved for a non-capture terminal booking; current booking state is ${bookingStatus}.`,
      ['Verified non-capture booking outcome'], null);
  }
  if (!EXTERNAL_METHODS.has(record.method) && record.method !== 'CUSTOMER_WALLET') {
    return decision('RELEASE', 'BLOCKED', false, 'RELEASE_NOT_APPLICABLE',
      `${record.method} does not have a supported authorization release contract.`, [], null);
  }
  if (EXTERNAL_METHODS.has(record.method) && !record.providerRef) {
    return decision('RELEASE', 'BLOCKED', false, 'GATEWAY_REFERENCE_MISSING',
      'The external authorization cannot be released without a gateway reference.', ['Gateway reference'], null);
  }
  if (evidence.state !== 'VERIFIED') {
    return decision('RELEASE', 'BLOCKED', false, 'PAYMENT_EVIDENCE_NOT_VERIFIED',
      evidence.reason,
      record.method === 'CUSTOMER_WALLET'
        ? ['Customer wallet reservation ledger entry']
        : ['Gateway reference', 'Verified gateway callback or status evidence'],
      evidence.verifiedAt);
  }
  return decision('RELEASE', 'AVAILABLE', true, 'RELEASE_RECOMMENDED',
    `Booking state ${bookingStatus} must not capture customer funds.`,
    ['Verified non-capture booking outcome'], null);
}

function paymentPrimaryQueue(
  record: PaymentActionDecisionRecord,
  evidence: PaymentEvidenceSummary,
  decisions: readonly PaymentActionDecision[],
): PaymentPrimaryQueue {
  const bookingStatus = record.booking?.status ?? 'UNKNOWN';
  const terminal = NON_CAPTURE_BOOKING_STATUSES.has(bookingStatus);
  const actionAvailable = (action: PaymentAdminAction) =>
    decisions.some((candidate) => candidate.action === action && paymentActionCanExecute(candidate));

  if (evidence.state === 'CONFLICT') return 'evidence-conflict';
  if (
    EXTERNAL_METHODS.has(record.method) &&
    evidence.state === 'MISSING' &&
    record.status !== 'RELEASED' &&
    record.status !== 'REFUNDED'
  ) {
    return 'missing-gateway-evidence';
  }
  if (record.method === 'CASH' && record.status === 'PENDING' && terminal) {
    return 'terminal-cash-cleanup';
  }
  if (actionAvailable('CAPTURE')) return 'capture-ready';
  if (record.status === 'AUTHORIZED' && bookingStatus === 'COMPLETED') {
    return 'completed-authorization-blocked';
  }
  if (actionAvailable('RELEASE')) return 'release-recommended';
  if (record.method === 'CASH' && record.status === 'PENDING') {
    const earning = record.booking?.earning;
    if ((earning?.netAmount ?? 0) < 0 && earning?.status !== 'PAID') return 'cash-debt';
    return ACTIVE_BOOKING_STATUSES.has(bookingStatus) ? 'active-cash' : 'needs-action';
  }
  if (record.status === 'FAILED' && ACTIVE_BOOKING_STATUSES.has(bookingStatus)) return 'failed-active';
  if (record.status === 'CAPTURED') return 'history-captured';
  if (record.status === 'REFUNDED') return 'history-refunded';
  if (record.status === 'RELEASED') return 'history-released';
  if (record.status === 'AUTHORIZED') return 'authorized-diagnostic';
  return 'needs-action';
}

function primaryActionFor(
  record: PaymentActionDecisionRecord,
  evidence: PaymentEvidenceSummary,
  decisions: readonly PaymentActionDecision[],
): PaymentAdminAction | null {
  if (evidence.state === 'CONFLICT') return null;
  const available = (action: PaymentAdminAction) =>
    decisions.some((candidate) => candidate.action === action && paymentActionCanExecute(candidate));
  if (EXTERNAL_METHODS.has(record.method) && evidence.state === 'MISSING' && available('SYNC')) {
    return 'SYNC';
  }
  if (available('CAPTURE')) return 'CAPTURE';
  if (available('RELEASE')) return 'RELEASE';
  return null;
}

function refundDecision(record: PaymentActionDecisionRecord): PaymentActionDecision {
  if (record.status !== 'CAPTURED') {
    return decision('REQUEST_REFUND', 'BLOCKED', false, 'PAYMENT_NOT_CAPTURED',
      `Refund review requires payment state CAPTURED; current state is ${record.status}.`,
      ['Captured payment', 'Refund reason'], null);
  }
  return decision('REQUEST_REFUND', 'REVIEW_REQUIRED', false, 'REFUND_APPROVAL_REQUIRED',
    'Submit the captured payment to Finance Approval Queue with retained reason and evidence.',
    ['Refund reason', 'Booking and customer evidence'], null);
}

function syncDecision(
  record: PaymentActionDecisionRecord,
  evidence: PaymentEvidenceSummary,
): PaymentActionDecision {
  if (!EXTERNAL_METHODS.has(record.method)) {
    return decision('SYNC', 'BLOCKED', false, 'SYNC_NOT_APPLICABLE',
      `${record.method} does not use an external gateway status sync.`, [], null);
  }
  if (TERMINAL_PAYMENT_STATUSES.has(record.status)) {
    return decision('SYNC', 'BLOCKED', false, 'PAYMENT_STATE_NOT_SYNCABLE',
      `Gateway status sync is not executable for terminal payment state ${record.status}.`, [], evidence.verifiedAt);
  }
  if (!record.providerRef) {
    return decision('SYNC', 'BLOCKED', false, 'GATEWAY_REFERENCE_MISSING',
      'Gateway status sync requires a provider reference.', ['Gateway reference'], null);
  }
  return decision('SYNC', 'AVAILABLE', evidence.state !== 'VERIFIED', 'SYNC_AVAILABLE',
    'Gateway reference is available for a fresh provider status query.', ['Gateway reference'], evidence.verifiedAt);
}

function captureEvidence(method: string): string[] {
  if (method === 'CASH') {
    return ['Cash collected at', 'Collector identity', 'Receipt or collection reference'];
  }
  if (method === 'CUSTOMER_WALLET') {
    return ['Customer wallet reservation ledger entry'];
  }
  return ['Gateway reference', 'Verified gateway callback or status evidence'];
}

function decision(
  action: PaymentAdminAction,
  state: PaymentActionDecisionState,
  recommended: boolean,
  reasonCode: string,
  reason: string,
  requiredEvidence: readonly string[],
  verifiedAt: string | null,
): PaymentActionDecision {
  return {
    action,
    state,
    recommended,
    reasonCode,
    reason,
    requiredEvidence,
    verifiedAt,
    policyVersion: PAYMENT_ACTION_POLICY_VERSION,
  };
}

function jsonRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isoValue(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}
