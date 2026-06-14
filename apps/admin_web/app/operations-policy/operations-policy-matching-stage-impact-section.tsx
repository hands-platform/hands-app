import { AdminTableScroll } from '../../components/admin-data-table';
import type { MatchingStageImpactPreview } from './matching-stage-impact-preview';

type OperationsPolicyMatchingStageImpactSectionProps = {
  readonly preview: MatchingStageImpactPreview;
};

export function OperationsPolicyMatchingStageImpactSection({
  preview,
}: OperationsPolicyMatchingStageImpactSectionProps) {
  return (
    <section className="card admin-mb-16" id="matching-stage-impact">
      <div className="ops-section-header">
        <div>
          <h2>Matching stage impact preview</h2>
          <p className="muted">
            Estimates how current open bookings would move across Stage 1/2/3/4 if the response window, 10km
            radius, or location freshness policy changed. This is a planning preview; saved booking snapshots
            still protect live requests.
          </p>
        </div>
        <span className="pill pill-info">{preview.currentPolicyLabel}</span>
      </div>
      <div className="service-trace-summary admin-mt-12">
        {preview.summary.map((item) => (
          <div key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.helper}</small>
          </div>
        ))}
      </div>
      <AdminTableScroll>
        <table className="table service-trace">
          <thead>
            <tr>
              <th>Scenario</th>
              <th>Value</th>
              <th>Stage 1 first-pick</th>
              <th>Stage 2 marketplace</th>
              <th>Stage 3 choice</th>
              <th>Stage 4 repair</th>
              <th>No supply</th>
              <th>Overdue</th>
              <th>Operator read</th>
            </tr>
          </thead>
          <tbody>
            {preview.rows.map((row) => (
              <tr key={`${row.scenario}-${row.value}`}>
                <td>
                  <span className={`pill ${row.pillClass}`}>{row.scenario}</span>
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
          </tbody>
        </table>
      </AdminTableScroll>
      <div className="ops-task-note admin-mt-14">
        <strong>How to use this preview</strong>
        <p className="muted">
          If a tested value increases Stage 2 marketplace count without increasing stale/no-supply checks, it
          may reduce customer waiting anxiety. If it increases overdue or no-supply count, improve Partner
          location freshness, push delivery, or city supply before changing policy.
        </p>
      </div>
    </section>
  );
}
