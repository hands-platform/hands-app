import { AdminDataTable } from '../../components/admin-data-table';
import { AdminSection } from '../../components/admin-surface';
import { formatMoney } from '../../lib/admin-format';
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
  'Finance snapshot',
  'Next action',
] as const;

export function ServiceTypeCoverageBoardSection({
  hiddenRowCount,
  rows,
  summary,
  visibleRows,
}: ServiceTypeCoverageBoardSectionProps) {
  return (
    <AdminSection
      className="admin-card-scroll admin-mb-16"
      description="Checks each service name as one operating unit: duration options, minimum-price payout rules, Partner price visibility, and projected company commission."
      status={
        <div className="actions">
          <span className={summary.blockedCount ? 'pill pill-danger' : 'pill pill-success'}>
            {summary.blockedCount} blocked
          </span>
          <span className={summary.warningCount ? 'pill pill-warn' : 'pill pill-success'}>
            {summary.warningCount} warning
          </span>
          <span className="pill pill-info">{summary.readyCount} ready</span>
        </div>
      }
      title="Service type coverage board"
    >
      <div className="service-trace-summary admin-mt-12">
        <div>
          <span>Service types checked</span>
          <strong>{rows.length}</strong>
        </div>
        <div>
          <span>Missing duration options</span>
          <strong>{summary.missingDurationCount}</strong>
        </div>
        <div>
          <span>Missing base payout</span>
          <strong>{summary.missingBasePayoutCount}</strong>
        </div>
        <div>
          <span>Hidden Partner prices</span>
          <strong>{summary.hiddenPartnerPriceCount}</strong>
        </div>
        <div>
          <span>Net company fee</span>
          <strong>{formatMoney(summary.netCompanyFee, summary.currency)}</strong>
        </div>
      </div>
      {visibleRows.length ? (
        <div className="admin-table-scroll">
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
                    <span className={`pill ${row.missingDurations.length ? 'pill-warn' : 'pill-success'}`}>
                      {row.activeDurationLabels || 'No active duration'}
                    </span>
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
                    <span className={`pill ${row.missingBasePayoutCount ? 'pill-danger' : 'pill-success'}`}>
                      {row.missingBasePayoutCount} missing base payout
                    </span>
                    <small>{row.activeOptionCount} active option(s)</small>
                    <small>{row.payoutRuleCount} payout rule(s)</small>
                  </div>
                </td>
                <td>
                  <div className="service-matrix-cell">
                    <span className={`pill ${row.hiddenPartnerPriceCount ? 'pill-warn' : 'pill-success'}`}>
                      {row.visiblePartnerPriceCount} visible / {row.hiddenPartnerPriceCount} hidden
                    </span>
                    <small>{row.belowMinimumCount} below minimum</small>
                    <small>{row.missingPayoutPriceCount} missing payout rule</small>
                  </div>
                </td>
                <td>
                  <div className="service-matrix-cell">
                    <strong>{formatMoney(row.netCompanyFee, row.currency)}</strong>
                    <small>Customer min {formatMoney(row.customerMinimumTotal, row.currency)}</small>
                    <small>Partner payout {formatMoney(row.partnerPayoutTotal, row.currency)}</small>
                  </div>
                </td>
                <td>
                  <span className={`pill ${row.tone}`}>{row.statusLabel}</span>
                  <p className="muted">{row.nextAction}</p>
                </td>
              </tr>
            ))}
          </AdminDataTable>
        </div>
      ) : (
        <p className="muted">No service type matches the current catalog search.</p>
      )}
      {hiddenRowCount ? (
        <p className="muted">
          Showing first {visibleRows.length} of {rows.length} service type(s). Search by service name or group
          key to narrow the board.
        </p>
      ) : null}
    </AdminSection>
  );
}
