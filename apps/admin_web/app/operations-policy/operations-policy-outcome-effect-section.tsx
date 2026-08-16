import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminTraceSummary } from '../../components/admin-overview-card';
import { AdminSection, AdminTaskCard, AdminTaskGrid } from '../../components/admin-surface';
import { StatusBadgeFromPillClass } from '../../components/status-badge';
import { marketplaceDisplayText as displayOperationalWording } from '../../lib/admin-copy';
import type { PolicyOutcomeEffectAnalysis } from './policy-outcome-effect';
import { policyCountLabel } from './policy-copy';

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
    <AdminSection
      className="admin-mb-16"
      description="Groups real bookings by the policy record saved at booking open. Use this before changing the 10 minute response window, marketplace policy, invite cap, or marketplace opening mode."
      statusLabel={`${policyCountLabel(analysis.sampleCount, 'booking')} with saved policy`}
      statusTone={analysis.sampleCount ? 'info' : 'warning'}
      title="Policy outcome effect"
    >
      <AdminTraceSummary
        className="admin-mt-12"
        metrics={analysis.metrics.map((metric) => ({
          detail: metric.helper,
          label: metric.label,
          value: metric.value,
        }))}
      />
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
                <StatusBadgeFromPillClass pillClass={row.outcomePill}>
                  {row.outcomeLabel}
                </StatusBadgeFromPillClass>
                <p className="muted admin-mt-6">{row.outcomeDetail}</p>
              </td>
              <td>
                <p className="admin-m-0">{row.operatorRead}</p>
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
      <AdminTaskGrid className="admin-mt-14">
        {analysis.cards.map((card) => (
          <AdminTaskCard
            actionLabel={card.operatorAction}
            className={card.className}
            detail={card.detail}
            key={card.title}
            leading={<StatusBadgeFromPillClass pillClass={card.pillClass}>{card.scope}</StatusBadgeFromPillClass>}
            title={card.title}
          />
        ))}
      </AdminTaskGrid>
    </AdminSection>
  );
}
