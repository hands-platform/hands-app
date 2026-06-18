import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { marketplaceDisplayText as displayOperationalWording } from '../../lib/admin-copy';
import type { PolicyOutcomeEffectAnalysis } from './policy-outcome-effect';

type OperationsPolicyOutcomeEffectSectionProps = {
  readonly analysis: PolicyOutcomeEffectAnalysis;
};

const POLICY_OUTCOME_EFFECT_HEADERS = [
  'Policy cohort',
  'Sample',
  'Matched / completed',
  'Marketplace supply',
  'Check',
  'Operator read',
] as const;

export function OperationsPolicyOutcomeEffectSection({
  analysis,
}: OperationsPolicyOutcomeEffectSectionProps) {
  return (
    <section className="card admin-mb-16">
      <div className="ops-section-header">
        <div>
          <h2>Policy outcome effect</h2>
          <p className="muted">
            Groups real bookings by the policy snapshot saved at booking open. Use this before changing the 10
            minute response window, marketplace policy, invite cap, or marketplace opening mode.
          </p>
        </div>
        <span className={`pill ${analysis.sampleCount ? 'pill-info' : 'pill-warn'}`}>
          {analysis.sampleCount} booking(s) with saved policy
        </span>
      </div>
      <div className="service-trace-summary admin-mt-12">
        {analysis.metrics.map((metric) => (
          <div key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.helper}</small>
          </div>
        ))}
      </div>
      <AdminTableScroll>
        <AdminDataTable
          className="service-trace"
          emptyMessage={
            'No policy snapshots are available yet. Create a fresh customer booking, then check this section again after Partners accept, reject, or complete the request.'
          }
          headers={POLICY_OUTCOME_EFFECT_HEADERS}
          rowCount={analysis.rows.length}
        >
          {analysis.rows.map((row) => (
            <tr key={row.key}>
              <td>
                <strong>{displayOperationalWording(row.policy)}</strong>
                <p className="muted">{row.value}</p>
              </td>
              <td>{row.sample}</td>
              <td>
                <strong>{row.matchedRate}</strong>
                <p className="muted">{row.completedRate} completed</p>
              </td>
              <td>
                <strong>{row.avgBackupInvites}</strong>
                <p className="muted">{row.avgParticipants} participant avg</p>
              </td>
              <td>
                <span className={`pill ${row.outcomePill}`}>{row.outcomeLabel}</span>
                <p className="muted admin-mt-6">{row.outcomeDetail}</p>
              </td>
              <td>
                <p className="admin-m-0">{row.operatorRead}</p>
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
      <div className="ops-task-grid admin-mt-14">
        {analysis.cards.map((card) => (
          <div className={`ops-task-card ${card.className}`} key={card.title}>
            <span className={`pill ${card.pillClass}`}>{card.scope}</span>
            <h3>{card.title}</h3>
            <p>{card.detail}</p>
            <small>{card.operatorAction}</small>
          </div>
        ))}
      </div>
    </section>
  );
}
