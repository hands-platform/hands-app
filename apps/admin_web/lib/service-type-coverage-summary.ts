type ServiceTypeCoverageTone = 'pill-danger' | 'pill-success' | 'pill-warn';

type ServiceTypeCoverageSummaryRow = {
  readonly currency: string;
  readonly hiddenPartnerPriceCount: number;
  readonly missingBasePayoutCount: number;
  readonly missingDurations: readonly number[];
  readonly netCompanyFee: number;
  readonly tone: ServiceTypeCoverageTone | string;
};

export function serviceTypeCoverageSummary(rows: readonly ServiceTypeCoverageSummaryRow[]) {
  const currency = rows.find((row) => row.currency)?.currency ?? 'VND';

  return rows.reduce(
    (summary, row) => ({
      currency: summary.currency,
      blockedCount: summary.blockedCount + (row.tone === 'pill-danger' ? 1 : 0),
      warningCount: summary.warningCount + (row.tone === 'pill-warn' ? 1 : 0),
      readyCount: summary.readyCount + (row.tone === 'pill-success' ? 1 : 0),
      missingDurationCount: summary.missingDurationCount + row.missingDurations.length,
      missingBasePayoutCount: summary.missingBasePayoutCount + row.missingBasePayoutCount,
      hiddenPartnerPriceCount: summary.hiddenPartnerPriceCount + row.hiddenPartnerPriceCount,
      netCompanyFee: summary.netCompanyFee + row.netCompanyFee,
    }),
    {
      currency,
      blockedCount: 0,
      warningCount: 0,
      readyCount: 0,
      missingDurationCount: 0,
      missingBasePayoutCount: 0,
      hiddenPartnerPriceCount: 0,
      netCompanyFee: 0,
    },
  );
}
