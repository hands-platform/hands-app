type PaymentAuditRecord = {
  amount: number;
  method: string;
  bookingId: string;
  status?: string;
};

type EarningCancellationAudit = {
  skipped: boolean;
  reason?: string;
  earningId?: string;
};

export function paymentCaptureAuditMetadata(payment: PaymentAuditRecord) {
  return {
    amount: payment.amount,
    method: payment.method,
    bookingId: payment.bookingId,
  };
}

export function paymentReleaseAuditMetadata(payment: PaymentAuditRecord) {
  return {
    ...paymentCaptureAuditMetadata(payment),
    status: payment.status,
  };
}

export function paymentRefundAuditMetadata(
  payment: PaymentAuditRecord,
  earningCancellation: EarningCancellationAudit,
) {
  return {
    amount: payment.amount,
    method: payment.method,
    earningCancellation,
  };
}
