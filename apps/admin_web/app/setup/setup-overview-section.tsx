import { AdminMetricGrid, AdminSectionHeader } from '../../components/admin-page-template';
import { StatusBadge } from '../../components/status-badge';
import { formatDateTime as formatDate } from '../../lib/admin-format';

type SetupOverviewSectionProps = {
  readonly readinessOk: boolean;
  readonly readinessUnavailable: boolean;
  readonly readinessTimestamp: string;
  readonly currentStage: {
    readonly ok: boolean;
    readonly label: string;
    readonly blockers: number;
    readonly helper: string;
  };
  readonly summary: {
    readonly ready: number;
    readonly partial: number;
    readonly blocked: number;
    readonly missing: number;
  };
};

export function SetupOverviewSection({
  readinessOk,
  readinessUnavailable,
  readinessTimestamp,
  currentStage,
  summary,
}: SetupOverviewSectionProps) {
  return (
    <>
      <AdminSectionHeader
        actions={
          <>
          <span className={`signal ${currentStage.ok ? 'signal-ok' : 'signal-warn'}`}>
            {currentStage.label}
          </span>
          <span className={`signal ${readinessOk ? 'signal-ok' : 'signal-info'}`}>
            {readinessUnavailable ? 'External status unknown' : readinessOk ? 'Production E2E ready' : 'Production deferred'}
          </span>
          <StatusBadge tone="info">
            {readinessUnavailable ? 'Readiness not loaded' : `Updated ${formatDate(readinessTimestamp)}`}
          </StatusBadge>
          </>
        }
        description="One checklist for credentials, account setup, and external services needed before production-like E2E."
        title="External setup"
      />

      <AdminMetricGrid
        metrics={[
          { label: 'Current blockers', value: currentStage.blockers, helper: currentStage.helper },
          {
            label: 'Ready',
            value: summary.ready,
            helper: 'External groups configured enough for local/E2E use.',
          },
          {
            label: 'Partial',
            value: summary.partial,
            helper: 'Some values exist, but production values are missing.',
          },
          {
            label: 'Blocked',
            value: summary.blocked,
            helper: 'Cannot run real E2E until required values are set.',
          },
          {
            label: 'Missing values',
            value: summary.missing,
            helper: 'Secret values are never displayed here.',
          },
        ]}
      />
    </>
  );
}
