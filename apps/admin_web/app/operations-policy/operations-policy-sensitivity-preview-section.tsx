import { AdminDataTable } from '../../components/admin-data-table';
import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminTraceSummary } from '../../components/admin-overview-card';
import { AdminSection } from '../../components/admin-surface';
import { StatusBadgeFromPillClass } from '../../components/status-badge';
import type { PolicySupplySensitivity } from './policy-supply-sensitivity';

type OperationsPolicySensitivityPreviewSectionProps = {
  readonly sensitivity: PolicySupplySensitivity;
};

const MARKETPLACE_SUPPLY_SENSITIVITY_HEADERS = [
  'Radius',
  'Eligible',
  'Visible',
  'Held',
  'Excluded stale',
  'Delta vs current',
] as const;
const LOCATION_FRESHNESS_SENSITIVITY_HEADERS = [
  'Freshness',
  'Eligible',
  'Visible',
  'Held',
  'Excluded stale',
  'Delta vs current',
] as const;

export function OperationsPolicySensitivityPreviewSection({
  sensitivity,
}: OperationsPolicySensitivityPreviewSectionProps) {
  const coordinateSample = Number(
    sensitivity.summary.find((item) => item.label === 'Coordinate sample')?.value ?? 0,
  );
  const noEligibleScenario = [...sensitivity.radiusRows, ...sensitivity.freshnessRows]
    .every((row) => row.eligible === 0);
  const demoReference = sensitivity.referenceLabel.startsWith('Demo ');

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
      {coordinateSample > 0 ? (
        <div className="operations-policy-sensitivity-stack admin-mt-14">
          <div className="operations-policy-sensitivity-reference">
            <strong>Reference: {sensitivity.referenceLabel}</strong>
            {demoReference ? (
              <StatusBadgeFromPillClass pillClass="pill-warn">Demo reference</StatusBadgeFromPillClass>
            ) : null}
          </div>
          {noEligibleScenario ? (
            <AdminEmptyState
              framed
              message="Eligible supply remains 0 under every sampled radius and freshness option. Improve Partner status, identity, location, or alert readiness before using policy changes as a recovery action."
              title="No scenario produces eligible supply"
            />
          ) : (
            <>
          <section aria-labelledby="marketplace-supply-sensitivity-title">
          <h3 id="marketplace-supply-sensitivity-title">Marketplace supply sensitivity{demoReference ? ' · Demo reference' : ''}</h3>
          <p className="muted">
            Marketplace blockers include account, identity,
            location, and alert readiness. Negative wallet stays visible and is shown as a marketplace/payout hold.
          </p>
          <AdminDataTable
            className="operations-policy-sensitivity-table service-trace"
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
                <td>{row.visible ?? row.eligible}</td>
                <td>{row.finalGateHeld}</td>
                <td>{row.staleExcluded ?? 0}</td>
                <td>{formatDelta(row.deltaVsCurrent ?? 0)}</td>
              </tr>
            ))}
          </AdminDataTable>
          </section>
          <section aria-labelledby="location-freshness-sensitivity-title">
          <h3 id="location-freshness-sensitivity-title">Location freshness sensitivity{demoReference ? ' · Demo reference' : ''}</h3>
          <p className="muted">
            Shows how strict or loose freshness rules affect marketplace matching without real-time
            tracking.
          </p>
          <AdminDataTable
            className="operations-policy-sensitivity-table service-trace"
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
                <td>{row.visible ?? row.eligible + row.staleExcluded}</td>
                <td>{row.finalGateHeld ?? 0}</td>
                <td>{row.staleExcluded}</td>
                <td>{formatDelta(row.deltaVsCurrent ?? 0)}</td>
              </tr>
            ))}
          </AdminDataTable>
          </section>
            </>
          )}
        </div>
      ) : (
        <AdminEmptyState
          framed
          message="No sampled Partner has a usable saved coordinate. Radius and freshness comparisons are hidden until location evidence is available."
          title="Supply sensitivity cannot be compared"
        />
      )}
    </AdminSection>
  );
}

function formatDelta(value: number) {
  return value > 0 ? `+${value}` : String(value);
}
