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

type SetupPageSearchParams = Promise<Record<string, string | string[] | undefined>>;
const DEFAULT_SETUP_BACKLOG_LIMIT = 8;

export default async function SetupPage({ searchParams }: { searchParams?: SetupPageSearchParams }) {
  const params = (await searchParams) ?? {};
  const commandMode = readSetupCommandMode(params.commands);
  const showSetupDetails = commandMode === 'full' || readSearchParam(params.details) === 'all';
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
  const setupGroupDetails = showSetupDetails ? buildSetupGroupDetails(readiness, setupOrder) : [];

  return (
    <div className="setup-page">
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

      <SetupReadinessOrderSection
        commandMode={commandMode}
        readinessChecks={readiness.checks}
        recommendedOrder={setupOrder}
      />

      <SetupExternalBacklogSection
        missingCount={summary.missing}
        backlog={externalBacklog}
        backlogLimit={showSetupDetails ? undefined : DEFAULT_SETUP_BACKLOG_LIMIT}
      />

      {showSetupDetails ? (
        <SetupGroupDetailSection commandMode={commandMode} groups={setupGroupDetails} />
      ) : (
        <SetupGroupDetailSummaryLink groupCount={setupOrder.length} />
      )}
    </div>
  );
}

function readSetupCommandMode(value: string | string[] | undefined): 'full' | 'summary' {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === 'all' ? 'full' : 'summary';
}

function readSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function SetupGroupDetailSummaryLink({ groupCount }: { readonly groupCount: number }) {
  return (
    <section className="card admin-mt-16">
      <div className="ops-section-header">
        <div>
          <h2>Setup group details</h2>
          <p className="muted">
            Full environment notes and command packs are kept out of the default setup payload.
          </p>
        </div>
        <a className="pill pill-neutral" href="/setup?details=all">
          Show {groupCount} setup group(s)
        </a>
      </div>
    </section>
  );
}
