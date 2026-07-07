import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminTraceSummary } from '../../components/admin-overview-card';
import { AdminTableSection } from '../../components/admin-table-panel';
import { MoneyText } from '../../components/money-text';
import { StatusBadge, StatusBadgeFromPillClass } from '../../components/status-badge';
import type { ServiceTypeCoverageRow } from '../../lib/service-type-coverage-rows';

type ServiceTypeCoverageBoardSummary = {
  readonly blockedCount: number;
  readonly currency: string;
  readonly hiddenPartnerPriceCount: number;
  readonly missingBasePayoutCount: number;
  readonly missingDurationCount: number;
  readonly netCompanyFee: number;
  readonly readyCount: number;
  readonly warningCount: number;
};

type ServiceTypeCoverageBoardSectionProps = {
  readonly hiddenRowCount: number;
  readonly rows: readonly ServiceTypeCoverageRow[];
  readonly summary: ServiceTypeCoverageBoardSummary;
  readonly visibleRows: readonly ServiceTypeCoverageRow[];
};

const SERVICE_TYPE_COVERAGE_HEADERS = [
  'Service type',
  'Duration coverage',
  'Payout coverage',
  'Partner price visibility',
  'Finance record',
  'Next action',
] as const;

export function ServiceTypeCoverageBoardSection({
  hiddenRowCount,
  rows,
  summary,
  visibleRows,
}: ServiceTypeCoverageBoardSectionProps) {
  return (
    <AdminTableSection
      className="admin-mb-16"
      description="Checks each service name as one operating unit: duration options, minimum-price payout rules, Partner price visibility, and projected company commission."
      scrollable
      status={
        <div className="actions">
          <StatusBadge tone={summary.blockedCount ? 'danger' : 'success'}>
            {summary.blockedCount} blocked
          </StatusBadge>
          <StatusBadge tone={summary.warningCount ? 'warning' : 'success'}>
            {summary.warningCount} warning
          </StatusBadge>
          <StatusBadge tone="info">{summary.readyCount} ready</StatusBadge>
        </div>
      }
      title="Service type coverage board"
    >
      <AdminTraceSummary
        className="admin-mt-12"
        metrics={[
          { label: 'Service types checked', value: rows.length },
          { label: 'Missing duration options', value: summary.missingDurationCount },
          { label: 'Missing base payout', value: summary.missingBasePayoutCount },
          { label: 'Hidden Partner prices', value: summary.hiddenPartnerPriceCount },
          {
            label: 'Net company fee',
            value: <MoneyText amount={summary.netCompanyFee} currency={summary.currency} />,
          },
        ]}
      />
      {visibleRows.length ? (
        <AdminTableScroll>
          <AdminDataTable
            className="service-trace"
            emptyMessage={null}
            headers={SERVICE_TYPE_COVERAGE_HEADERS}
            rowCount={visibleRows.length}
          >
            {visibleRows.map((row) => (
              <tr key={row.key}>
                <td>
                  <strong>{row.label}</strong>
                  <p className="muted">{row.key}</p>
                </td>
                <td>
                  <div className="service-matrix-cell">
                    <StatusBadge tone={row.missingDurations.length ? 'warning' : 'success'}>
                      {row.activeDurationLabels || 'No active duration'}
                    </StatusBadge>
                    <small>
                      Missing duration options:{' '}
                      {row.missingDurations.length
                        ? row.missingDurations.map((duration) => `${duration} min`).join(', ')
                        : 'none'}
                    </small>
                  </div>
                </td>
                <td>
                  <div className="service-matrix-cell">
                    <StatusBadge tone={row.missingBasePayoutCount ? 'danger' : 'success'}>
                      {row.missingBasePayoutCount} missing base payout
                    </StatusBadge>
                    <small>{row.activeOptionCount} active option(s)</small>
                    <small>{row.payoutRuleCount} payout rule(s)</small>
                  </div>
                </td>
                <td>
                  <div className="service-matrix-cell">
                    <StatusBadge tone={row.hiddenPartnerPriceCount ? 'warning' : 'success'}>
                      {row.visiblePartnerPriceCount} visible / {row.hiddenPartnerPriceCount} hidden
                    </StatusBadge>
                    <small>{row.belowMinimumCount} below minimum</small>
                    <small>{row.missingPayoutPriceCount} missing payout rule</small>
                  </div>
                </td>
                <td>
                  <div className="service-matrix-cell">
                    <strong>
                      <MoneyText amount={row.netCompanyFee} currency={row.currency} />
                    </strong>
                    <small>
                      Customer min <MoneyText amount={row.customerMinimumTotal} currency={row.currency} />
                    </small>
                    <small>
                      Partner payout <MoneyText amount={row.partnerPayoutTotal} currency={row.currency} />
                    </small>
                  </div>
                </td>
                <td>
                  <StatusBadgeFromPillClass pillClass={row.tone}>{row.statusLabel}</StatusBadgeFromPillClass>
                  <p className="muted">{row.nextAction}</p>
                </td>
              </tr>
            ))}
          </AdminDataTable>
        </AdminTableScroll>
      ) : (
        <AdminEmptyState framed message="No service type matches the current catalog search." />
      )}
      {hiddenRowCount ? (
        <p className="muted">
          Showing first {visibleRows.length} of {rows.length} service type(s). Search by service name or group
          key to narrow the board.
        </p>
      ) : null}
    </AdminTableSection>
  );
}
