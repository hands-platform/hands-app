import { AdminExternalReadiness, apiGet } from '../../lib/admin-api';
import { AdminPageTemplate } from '../../components/admin-page-template';
import { AdminDetailGrid, AdminSection } from '../../components/admin-surface';
import { StatusBadgeLink } from '../../components/status-badge';
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
    <AdminPageTemplate
      contentClassName="setup-page"
      description="External accounts, credentials, and readiness checks for production-like HANDS operations."
      title="Setup"
    >
      <SetupOverviewSection
        readinessOk={readiness.ok}
        readinessUnavailable={readinessUnavailable}
        readinessTimestamp={readiness.timestamp}
        currentStage={currentStage}
        summary={summary}
      />

      <SetupProgressControlSection sequence={projectControlSequence} verifiedBaseline={verifiedBaseline} />

      <SetupRegistrationHandoffSection registrationPlan={registrationPlan} />

      <AdminDetailGrid ariaLabel="Setup operator actions and migration runway" className="admin-mb-16">
        <SetupOperatorActionsSection nextActions={nextActions} deferredActions={deferredActions} />

        <SetupMigrationRunwaySection groupStatuses={groupStatuses} />
      </AdminDetailGrid>

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
    </AdminPageTemplate>
  );
}

function readSetupCommandMode(value: string | string[] | undefined): 'full' | 'summary' {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === 'all' ? 'full' : 'summary';
}

function readSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

export function SetupGroupDetailSummaryLink({ groupCount }: { readonly groupCount: number }) {
  return (
    <AdminSection
      actions={
        <StatusBadgeLink tone="neutral" href="/setup?details=all">
          Show {groupCount} setup group(s)
        </StatusBadgeLink>
      }
      className="admin-mt-16"
      description="Full environment notes and command packs are kept out of the default setup payload."
      title="Setup group details"
    />
  );
}
