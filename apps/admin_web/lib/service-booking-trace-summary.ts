type ServiceBookingTraceSummaryRow = {
  readonly booking?: {
    readonly earning?: {
      readonly netAmount?: number;
    } | null;
    readonly payment?: {
      readonly amount?: number;
    } | null;
  } | null;
  readonly currency: string;
  readonly platformFeeAmount: number;
  readonly taxWithheldAmount: number;
  readonly traceStatus: string;
  readonly walletAmount: number;
};

export function serviceBookingTraceSummary(rows: readonly ServiceBookingTraceSummaryRow[]) {
  const currency = rows.find((row) => row.currency)?.currency ?? 'VND';
  return rows.reduce(
    (summary, row) => ({
      currency: summary.currency,
      paymentAmount: summary.paymentAmount + (row.booking?.payment?.amount ?? 0),
      providerNetAmount: summary.providerNetAmount + (row.booking?.earning?.netAmount ?? 0),
      platformFeeAmount: summary.platformFeeAmount + row.platformFeeAmount,
      withholdingAmount: summary.withholdingAmount + row.taxWithheldAmount,
      walletAmount: summary.walletAmount + row.walletAmount,
      missingTraceCount: summary.missingTraceCount + (row.traceStatus === 'Complete' ? 0 : 1),
    }),
    {
      currency,
      paymentAmount: 0,
      providerNetAmount: 0,
      platformFeeAmount: 0,
      withholdingAmount: 0,
      walletAmount: 0,
      missingTraceCount: 0,
    },
  );
}
