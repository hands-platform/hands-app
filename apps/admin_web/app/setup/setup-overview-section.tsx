import { AdminMetricGrid, AdminSectionHeader } from '../../components/admin-page-template';
import { DateTimeText } from '../../components/date-time-text';
import { AdminSignal, StatusBadge } from '../../components/status-badge';

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
            <AdminSignal tone={currentStage.ok ? 'ok' : 'warn'}>{currentStage.label}</AdminSignal>
            <AdminSignal tone={readinessOk ? 'ok' : 'info'}>
              {readinessUnavailable
                ? 'External status unknown'
                : readinessOk
                  ? 'Production E2E ready'
                  : 'Production deferred'}
            </AdminSignal>
            <StatusBadge tone="info">
              {readinessUnavailable ? 'Readiness not loaded' : <>Updated <DateTimeText value={readinessTimestamp} /></>}
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
