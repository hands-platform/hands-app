import { AdminExternalReadiness, apiGet } from '../../lib/admin-api';
import { SetupExternalBacklogSection } from './setup-external-backlog-section';
import { SetupGroupDetailSection } from './setup-group-detail-section';
import { SetupMigrationRunwaySection } from './setup-migration-runway-section';
import { SetupOverviewSection } from './setup-overview-section';
import { SetupOperatorActionsSection } from './setup-operator-actions-section';
import {
  buildCurrentStageStatus,
  buildDeferredOperatorActions,
  buildExternalBacklog,
  buildExternalRegistrationPlan,
  buildGroupStatuses,
  buildNextOperatorActions,
  buildSetupGroupDetails,
  buildSummary,
  isReadinessUnavailable,
} from './setup-page-model';
import {
  externalRegistrationPlan,
  projectControlSequence,
  setupOrder,
  verifiedBaseline,
} from './setup-page-data';
import { SetupProgressControlSection } from './setup-progress-control-section';
import { SetupReadinessOrderSection } from './setup-readiness-order-section';
import { SetupRegistrationHandoffSection } from './setup-registration-handoff-section';

export default async function SetupPage() {
  const readiness = await apiGet<AdminExternalReadiness>('/health/external', {
    ok: false,
    timestamp: new Date(0).toISOString(),
    checks: [],
  });

  const readinessUnavailable = isReadinessUnavailable(readiness);
  const summary = buildSummary(readiness, readinessUnavailable);
  const groupStatuses = buildGroupStatuses(readiness, setupOrder);
  const externalBacklog = buildExternalBacklog(readiness, setupOrder, readinessUnavailable);
  const nextActions = buildNextOperatorActions(readiness, setupOrder, readinessUnavailable);
  const deferredActions = buildDeferredOperatorActions(readiness, setupOrder, readinessUnavailable);
  const currentStage = buildCurrentStageStatus(readiness, setupOrder, readinessUnavailable);
  const registrationPlan = buildExternalRegistrationPlan(
    readiness,
    externalRegistrationPlan,
    readinessUnavailable,
  );
  const setupGroupDetails = buildSetupGroupDetails(readiness, setupOrder);

  return (
    <>
      <SetupOverviewSection
        readinessOk={readiness.ok}
        readinessUnavailable={readinessUnavailable}
        readinessTimestamp={readiness.timestamp}
        currentStage={currentStage}
        summary={summary}
      />

      <SetupProgressControlSection sequence={projectControlSequence} verifiedBaseline={verifiedBaseline} />

      <SetupRegistrationHandoffSection registrationPlan={registrationPlan} />

      <section className="detail-grid admin-mb-16">
        <SetupOperatorActionsSection nextActions={nextActions} deferredActions={deferredActions} />

        <SetupMigrationRunwaySection groupStatuses={groupStatuses} />
      </section>

      <SetupReadinessOrderSection readinessChecks={readiness.checks} recommendedOrder={setupOrder} />

      <SetupExternalBacklogSection missingCount={summary.missing} backlog={externalBacklog} />

      <SetupGroupDetailSection groups={setupGroupDetails} />
    </>
  );
}
