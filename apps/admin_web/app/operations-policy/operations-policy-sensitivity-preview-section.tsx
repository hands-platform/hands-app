import { AdminDataTable } from '../../components/admin-data-table';
import { AdminTraceSummary } from '../../components/admin-overview-card';
import { AdminDetailGrid, AdminSection } from '../../components/admin-surface';
import { StatusBadgeFromPillClass } from '../../components/status-badge';
import type { PolicySupplySensitivity } from './policy-supply-sensitivity';

type OperationsPolicySensitivityPreviewSectionProps = {
  readonly sensitivity: PolicySupplySensitivity;
};

const MARKETPLACE_SUPPLY_SENSITIVITY_HEADERS = [
  'Radius',
  'Visible Partners',
  'Fresh location',
  'Marketplace/payout held',
  'Operator read',
] as const;
const LOCATION_FRESHNESS_SENSITIVITY_HEADERS = [
  'Freshness',
  'Eligible Partners',
  'Stale excluded',
  'Operator read',
] as const;

export function OperationsPolicySensitivityPreviewSection({
  sensitivity,
}: OperationsPolicySensitivityPreviewSectionProps) {
  return (
    <AdminSection
      className="admin-mb-16"
      description="Before changing radius or location freshness, compare how many Partners would remain usable around the latest customer coordinate. This keeps policy choices tied to real supply instead of guesswork."
      statusLabel={sensitivity.currentPolicyLabel}
      statusTone="info"
      title="Policy sensitivity preview"
    >
      <AdminTraceSummary
        className="admin-mt-12"
        metrics={sensitivity.summary.map((item) => ({
          detail: item.helper,
          label: item.label,
          value: item.value,
        }))}
      />
      <AdminDetailGrid className="admin-mt-14">
        <div className="admin-scroll-x">
          <h3>Marketplace supply sensitivity</h3>
          <p className="muted">
            Reference point: {sensitivity.referenceLabel}. Marketplace blockers include account, identity,
            location, and alert readiness. Negative wallet stays visible and is shown as a marketplace/payout hold.
          </p>
          <AdminDataTable
            className="service-trace"
            emptyMessage={null}
            headers={MARKETPLACE_SUPPLY_SENSITIVITY_HEADERS}
            rowCount={sensitivity.radiusRows.length}
          >
            {sensitivity.radiusRows.map((row) => (
              <tr key={row.radiusLabel}>
                <td>
                  <StatusBadgeFromPillClass pillClass={row.pillClass}>
                    {row.radiusLabel}
                  </StatusBadgeFromPillClass>
                </td>
                <td>{row.eligible}</td>
                <td>{row.fresh}</td>
                <td>{row.finalGateHeld}</td>
                <td>{row.operatorRead}</td>
              </tr>
            ))}
          </AdminDataTable>
        </div>
        <div className="admin-scroll-x">
          <h3>Location freshness sensitivity</h3>
          <p className="muted">
            Shows how strict or loose freshness rules affect marketplace matching without real-time
            tracking.
          </p>
          <AdminDataTable
            className="service-trace"
            emptyMessage={null}
            headers={LOCATION_FRESHNESS_SENSITIVITY_HEADERS}
            rowCount={sensitivity.freshnessRows.length}
          >
            {sensitivity.freshnessRows.map((row) => (
              <tr key={row.freshnessLabel}>
                <td>
                  <StatusBadgeFromPillClass pillClass={row.pillClass}>
                    {row.freshnessLabel}
                  </StatusBadgeFromPillClass>
                </td>
                <td>{row.eligible}</td>
                <td>{row.staleExcluded}</td>
                <td>{row.operatorRead}</td>
              </tr>
            ))}
          </AdminDataTable>
        </div>
      </AdminDetailGrid>
    </AdminSection>
  );
}
