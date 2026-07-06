import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminTraceSummary } from '../../components/admin-overview-card';
import { AdminNotePanel, AdminSection } from '../../components/admin-surface';
import { StatusBadgeFromPillClass } from '../../components/status-badge';
import type { MatchingStageImpactPreview } from './matching-stage-impact-preview';

type OperationsPolicyMatchingStageImpactSectionProps = {
  readonly preview: MatchingStageImpactPreview;
};

const MATCHING_STAGE_IMPACT_HEADERS = [
  'Scenario',
  'Value',
  'Stage 1 first-pick',
  'Stage 2 marketplace',
  'Stage 3 choice',
  'Stage 4 repair',
  'No supply',
  'Overdue',
  'Operator read',
] as const;

export function OperationsPolicyMatchingStageImpactSection({
  preview,
}: OperationsPolicyMatchingStageImpactSectionProps) {
  return (
    <AdminSection
      className="admin-mb-16"
      description="Estimates how current open bookings would move across Stage 1/2/3/4 if the response window, 10km radius, or location freshness policy changed. This is a planning preview; saved booking snapshots still protect live requests."
      id="matching-stage-impact"
      statusLabel={preview.currentPolicyLabel}
      statusTone="info"
      title="Matching stage impact preview"
    >
      <AdminTraceSummary
        className="admin-mt-12"
        metrics={preview.summary.map((item) => ({
          detail: item.helper,
          label: item.label,
          value: item.value,
        }))}
      />
      <AdminTableScroll>
        <AdminDataTable
          className="service-trace"
          emptyMessage={null}
          headers={MATCHING_STAGE_IMPACT_HEADERS}
          rowCount={preview.rows.length}
        >
          {preview.rows.map((row) => (
            <tr key={`${row.scenario}-${row.value}`}>
              <td>
                <StatusBadgeFromPillClass pillClass={row.pillClass}>{row.scenario}</StatusBadgeFromPillClass>
              </td>
              <td>{row.value}</td>
              <td>{row.stage1}</td>
              <td>{row.stage2}</td>
              <td>{row.stage3}</td>
              <td>{row.repair}</td>
              <td>{row.noSupply}</td>
              <td>{row.overdue}</td>
              <td>{row.operatorRead}</td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
      <AdminNotePanel className="admin-mt-14">
        <strong>How to use this preview</strong>
        <p className="muted">
          If a tested value increases Stage 2 marketplace count without increasing stale/no-supply checks, it
          may reduce customer waiting anxiety. If it increases overdue or no-supply count, improve Partner
          location freshness, push delivery, or city supply before changing policy.
        </p>
      </AdminNotePanel>
    </AdminSection>
  );
}
