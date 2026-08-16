import { Activity, ArrowUpRight, Settings2 } from 'lucide-react';

import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminFormControlLink } from '../../components/admin-form-controls';
import { AdminErrorState, AdminSection } from '../../components/admin-surface';
import { DateTimeText } from '../../components/date-time-text';
import { StatusBadge, type StatusBadgeTone } from '../../components/status-badge';
import type { AdminExternalReadiness, AdminExternalServiceStatus } from '../../lib/admin-api';
import {
  externalServicesFromReadiness,
  setupServiceHasEvidenceGap,
  setupServicesForView,
  setupWorkspaceCounts,
  type SetupWorkspaceMode,
  type SetupWorkspaceView,
} from './setup-page-model';

type SetupOverviewSectionProps = {
  readonly errorCode: string | null;
  readonly mode: SetupWorkspaceMode;
  readonly readiness: AdminExternalReadiness | null;
  readonly requestId: string | null;
  readonly status: number | null;
  readonly view: SetupWorkspaceView;
};

export function SetupOverviewSection({
  errorCode,
  mode,
  readiness,
  requestId,
  status,
  view,
}: SetupOverviewSectionProps) {
  if (!readiness) {
    const error = setupLoadError(status, errorCode, requestId);
    return (
      <AdminErrorState
        action={<AdminFormControlLink className="button-secondary" href={error.actionHref}>{error.actionLabel}</AdminFormControlLink>}
        message={error.message}
        title={error.title}
      />
    );
  }

  const services = externalServicesFromReadiness(readiness);
  const fallbackCounts = setupWorkspaceCounts(services);
  const counts = readiness.counts?.notMonitored === undefined
    ? fallbackCounts
    : { ...fallbackCounts, ...readiness.counts };
  const rows = setupServicesForView(services, mode, view);
  const generatedAt = readiness.generatedAt ?? readiness.timestamp;

  return (
    <>
      <section aria-label="External service context" className="setup-context-strip">
        <div>
          <span>Launch profile</span>
          <strong>{readiness.launchProfile === 'ONLINE_PAYMENTS' ? 'Online payments' : 'Cash-only launch'}</strong>
        </div>
        <div>
          <span>Last refresh</span>
          <strong><DateTimeText value={generatedAt} /></strong>
        </div>
        <div>
          <span>Current interpretation</span>
          <strong>Configuration and runtime evidence are separate</strong>
        </div>
      </section>

      <nav aria-label="External service workspace" className="setup-workspace-tabs">
        <SetupTab active={mode === 'runtime'} href={setupHref('runtime', mode === 'runtime' ? view : 'active')} icon={Activity}>
          Runtime health
        </SetupTab>
        <SetupTab active={mode === 'readiness'} href={setupHref('readiness', mode === 'readiness' ? view : 'needs-action')} icon={Settings2}>
          Launch readiness
        </SetupTab>
      </nav>

      <nav aria-label="External service saved views" className="setup-saved-views">
        {mode === 'runtime' ? (
          <>
            <SetupSavedView active={view === 'needs-action'} count={counts.needsAction} href={setupHref('runtime', 'needs-action')} label="Needs action" />
            <SetupSavedView active={view === 'active'} count={services.filter((service) => service.enabled && service.configurationStatus !== 'DEFERRED').length} href={setupHref('runtime', 'active')} label="Active services" />
            <SetupSavedView active={view === 'evidence-gaps'} count={counts.evidenceGaps} href={setupHref('runtime', 'evidence-gaps')} label="Evidence gaps" />
          </>
        ) : (
          <>
            <SetupSavedView active={view === 'needs-action'} count={counts.launchBlockers} href={setupHref('readiness', 'needs-action')} label="Needs action" />
            <SetupSavedView active={view === 'active'} count={counts.required} href={setupHref('readiness', 'active')} label="Required capabilities" />
            <SetupSavedView active={view === 'deferred'} count={counts.deferred} href={setupHref('readiness', 'deferred')} label="Deferred" />
          </>
        )}
      </nav>

      {mode === 'runtime' ? (
        <section aria-label="Runtime service status summary" className="setup-status-strip">
          <SetupStatusItem href={setupHref('runtime', 'needs-action')} label="Needs action" stateLabel={counts.needsAction ? 'Review' : 'No action'} tone={counts.needsAction ? 'danger' : 'neutral'} value={counts.needsAction} />
          <SetupStatusItem label="Degraded" stateLabel={counts.degraded ? 'Review' : 'No action'} tone={counts.degraded ? 'warning' : 'neutral'} value={counts.degraded} />
          <SetupStatusItem href={setupHref('runtime', 'evidence-gaps')} label="Unknown" stateLabel={counts.unknown ? 'Check state' : 'None'} tone={counts.unknown ? 'warning' : 'neutral'} value={counts.unknown} />
          <SetupStatusItem href={setupHref('runtime', 'evidence-gaps')} label="Not monitored" stateLabel={counts.notMonitored ? 'Evidence gap' : 'None'} tone={counts.notMonitored ? 'info' : 'neutral'} value={counts.notMonitored} />
          <SetupStatusItem href={setupHref('runtime', 'evidence-gaps')} label="Evidence gaps" stateLabel={counts.evidenceGaps ? 'Review coverage' : 'Covered'} tone={counts.evidenceGaps ? 'info' : 'neutral'} value={counts.evidenceGaps} />
        </section>
      ) : view === 'deferred' ? (
        <DeferredLaunchSummary count={rows.length} />
      ) : (
        <section aria-label="Launch readiness summary" className="setup-status-strip">
          <SetupStatusItem href={setupHref('readiness', 'needs-action')} label="Launch blockers" stateLabel={counts.launchBlockers ? 'Review' : 'Clear'} tone={counts.launchBlockers ? 'danger' : 'success'} value={counts.launchBlockers} />
          <SetupStatusItem href={setupHref('readiness', 'active')} label="Required capabilities" stateLabel={`${counts.configurationReady} configured`} tone="info" value={counts.required} />
          <SetupStatusItem href={setupHref('readiness', 'deferred')} label="Deferred" stateLabel="Future scope" tone="neutral" value={counts.deferred} />
        </section>
      )}

      {mode === 'runtime' ? (
        <RuntimeHealthSection generatedAt={generatedAt} rows={rows} />
      ) : (
        <LaunchReadinessSection counts={counts} launchProfile={readiness.launchProfile ?? 'CASH_ONLY'} rows={rows} view={view} />
      )}
    </>
  );
}

function RuntimeHealthSection({ generatedAt, rows }: { readonly generatedAt: string; readonly rows: readonly AdminExternalServiceStatus[] }) {
  return (
    <AdminSection
      className="setup-health-section"
      description={<>Generated <DateTimeText value={generatedAt} />. Healthy is shown only after a successful safe runtime probe.</>}
      id="runtime-health"
      title="Runtime health"
    >
      <AdminTableScroll ariaLabel="External service runtime health table" className="setup-health-table-scroll">
        <AdminDataTable
          className="setup-health-table setup-runtime-table"
          emptyMessage="No services match this view."
          headers={['Service', 'Runtime status', 'Evidence / last event', 'Current impact', 'Action']}
          rowCount={rows.length}
        >
          {rows.map((service) => <RuntimeHealthRow key={service.id} service={service} />)}
        </AdminDataTable>
      </AdminTableScroll>
    </AdminSection>
  );
}

function RuntimeHealthRow({ service }: { readonly service: AdminExternalServiceStatus }) {
  const runtime = runtimePresentation(service.runtimeStatus);
  return (
    <tr>
      <td><strong>{service.name}</strong><small>{configurationLabel(service)}</small></td>
      <td>
        <StatusBadge tone={runtime.tone}>{runtime.label}</StatusBadge>
        {setupServiceHasEvidenceGap(service) ? <small>Runtime evidence gap</small> : null}
        {service.isStale ? <small>Stale evidence</small> : null}
      </td>
      <td>
        <span className="setup-evidence-copy">
          <strong>{evidenceLevelLabel(service)}</strong>
          <small>{service.evidenceSummary}</small>
          {(service.lastVerifiedAt ?? service.lastProbeAt) ? <small>Last verified <DateTimeText value={service.lastVerifiedAt ?? service.lastProbeAt ?? ''} /></small> : <small>No runtime verification recorded</small>}
        </span>
        <SetupServiceDetails service={service} />
      </td>
      <td>{service.impactSummary}</td>
      <td className="setup-health-action-cell"><ServiceAction service={service} /></td>
    </tr>
  );
}

function DeferredLaunchSummary({ count }: { readonly count: number }) {
  return (
    <section aria-labelledby="deferred-launch-summary-title" className="setup-deferred-summary">
      <div>
        <span>Future launch ledger</span>
        <h2 id="deferred-launch-summary-title">Deferred for cash-only launch</h2>
        <p>These capabilities do not block the current launch. Review them only when the listed trigger is reached.</p>
      </div>
      <strong aria-label={`${count} deferred capabilities`}>{count}</strong>
    </section>
  );
}

function LaunchReadinessSection({
  counts,
  launchProfile,
  rows,
  view,
}: {
  readonly counts: ReturnType<typeof setupWorkspaceCounts>;
  readonly launchProfile: string;
  readonly rows: readonly AdminExternalServiceStatus[];
  readonly view: SetupWorkspaceView;
}) {
  if (view === 'deferred') {
    return <DeferredCapabilitiesSection rows={rows} />;
  }

  const cashOnlyClear = launchProfile === 'CASH_ONLY' && view === 'needs-action' && rows.length === 0;
  return (
    <AdminSection
      className="setup-health-section"
      description={launchProfile === 'CASH_ONLY'
        ? 'Cash is the current launch payment method. Disabled MoMo, VNPay, and referral links are intentionally deferred.'
        : 'Capabilities required for the online-payments launch profile.'}
      id="launch-readiness"
      title="Launch readiness"
    >
      {cashOnlyClear ? (
        <div className="setup-launch-ready-state">
          <AdminEmptyState
            framed
            title="Cash-only launch configuration is ready"
            message={`No current launch configuration blockers. ${counts.configurationReady} of ${counts.required} required capabilities are configured; runtime verification is available for ${counts.runtimeVerified}; ${counts.evidenceGaps} need runtime evidence; ${counts.deferred} are intentionally deferred.`}
          />
          <nav aria-label="Cash-only launch follow-up" className="setup-launch-ready-actions">
            <AdminFormControlLink className="button-secondary" href={setupHref('readiness', 'active')}>View required capabilities</AdminFormControlLink>
            <AdminFormControlLink className="button-secondary" href={setupHref('runtime', 'evidence-gaps')}>Review evidence gaps</AdminFormControlLink>
            <AdminFormControlLink className="button-secondary" href={setupHref('readiness', 'deferred')}>Review deferred ledger</AdminFormControlLink>
          </nav>
        </div>
      ) : <AdminTableScroll ariaLabel="External service launch readiness table" className="setup-health-table-scroll">
        <AdminDataTable
          className="setup-health-table setup-readiness-table"
          emptyMessage="No capabilities match this view."
          headers={['Capability', 'Launch requirement', 'Configuration', 'Evidence / last verified', 'Next step']}
          rowCount={rows.length}
        >
          {rows.map((service) => (
            <tr key={service.id}>
              <td><strong>{service.name}</strong></td>
              <td><StatusBadge tone={service.requiredForCurrentLaunch ? 'info' : 'neutral'}>{service.requiredForCurrentLaunch ? 'Required now' : 'Not required now'}</StatusBadge></td>
              <td><StatusBadge tone={configurationPresentation(service).tone}>{configurationPresentation(service).label}</StatusBadge>{service.configurationCheckedAt ? <small>Checked <DateTimeText value={service.configurationCheckedAt} /></small> : null}</td>
              <td>
                <span className="setup-evidence-copy">
                  <strong>{evidenceLevelLabel(service)}</strong>
                  {(service.lastVerifiedAt ?? service.configurationCheckedAt) ? <small>Last verified <DateTimeText value={service.lastVerifiedAt ?? service.configurationCheckedAt ?? ''} /></small> : <small>No verification recorded</small>}
                </span>
                <SetupServiceDetails service={service} />
              </td>
              <td className="setup-health-action-cell"><ServiceAction service={service} /></td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>}
    </AdminSection>
  );
}

function DeferredCapabilitiesSection({
  rows,
}: {
  readonly rows: readonly AdminExternalServiceStatus[];
}) {
  return (
    <AdminSection
      className="setup-health-section setup-deferred-section"
      description="A future-work ledger for capabilities intentionally outside the cash-only launch. Times are shown in Vietnam time (UTC+7)."
      id="launch-readiness"
      title="Deferred capability ledger"
    >
      <AdminTableScroll ariaLabel="Deferred launch capability ledger" className="setup-health-table-scroll setup-deferred-table-scroll">
        <AdminDataTable
          className="setup-health-table setup-deferred-table"
          emptyMessage="No capabilities are deferred for this launch profile."
          headers={['Capability', 'Why deferred', 'Re-entry prerequisites', 'Review trigger', 'Action']}
          rowCount={rows.length}
        >
          {rows.map((service) => <DeferredCapabilityRow key={service.id} service={service} />)}
        </AdminDataTable>
      </AdminTableScroll>
    </AdminSection>
  );
}

function DeferredCapabilityRow({ service }: { readonly service: AdminExternalServiceStatus }) {
  const checks = service.reentryChecks ?? [];
  const currentChecks = checks.filter((check) => check.status !== 'FUTURE');
  const verified = currentChecks.filter((check) => check.status === 'VERIFIED').length;
  const visibleChecks = currentChecks.slice(0, 2);
  const remaining = Math.max(0, currentChecks.length - visibleChecks.length);

  return (
    <tr id={`deferred-capability-${service.id}`}>
      <td>
        <strong>{service.name}</strong>
        <small>{futureReadinessLabel(service.futureReadiness)}</small>
      </td>
      <td>{service.deferredReason ?? 'Outside the current launch stage.'}</td>
      <td>
        <span className="setup-reentry-summary">
          <strong>{verified}/{currentChecks.length} current gates verified</strong>
          {visibleChecks.map((check) => <small key={check.label}>{check.label}</small>)}
          {remaining > 0 ? <small>{remaining} more in the checklist</small> : null}
        </span>
      </td>
      <td>{service.reviewTrigger ?? 'Review when this capability enters launch scope.'}</td>
      <td className="setup-health-action-cell">
        <DeferredCapabilityDetails service={service} />
      </td>
    </tr>
  );
}

function DeferredCapabilityDetails({ service }: { readonly service: AdminExternalServiceStatus }) {
  const checks = service.reentryChecks ?? [];
  const relatedWorkspaceHref = service.relatedWorkspaceHref ?? service.escalationRoute;
  const runbookHref = service.runbookHref ?? service.runbookUrl;
  return (
    <details className="setup-deferred-details">
      <summary>{deferredActionLabel(service.name)}</summary>
      <div className="setup-deferred-details-panel">
        <StatusBadge tone={futureReadinessTone(service.futureReadiness)}>{futureReadinessLabel(service.futureReadiness)}</StatusBadge>
        <ul aria-label={`${service.name} re-entry checklist`}>
          {checks.map((check) => (
            <li key={check.label}>
              <StatusBadge tone={check.status === 'VERIFIED' ? 'success' : check.status === 'FUTURE' ? 'neutral' : 'warning'}>
                {check.status === 'VERIFIED' ? 'Verified' : check.status === 'FUTURE' ? 'Future scope' : 'Pending'}
              </StatusBadge>
              <span>{check.label}</span>
            </li>
          ))}
        </ul>
        <dl>
          <div><dt>Last reviewed</dt><dd>{service.reviewedAt ? <DateTimeText value={service.reviewedAt} /> : 'No review recorded'}</dd></div>
          {service.platformScope ? <div><dt>Current platform scope</dt><dd>{service.platformScope === 'ANDROID_MVP' ? 'Android MVP; iOS remains future scope' : 'iOS release preparation'}</dd></div> : null}
        </dl>
        <nav aria-label={`${service.name} supporting destinations`} className="setup-deferred-links">
          {service.evidenceHref ? <AdminFormControlLink className="button-secondary button-compact" href={service.evidenceHref}>View evidence<ArrowUpRight aria-hidden="true" size={14} /></AdminFormControlLink> : null}
          {relatedWorkspaceHref ? <AdminFormControlLink className="button-secondary button-compact" href={relatedWorkspaceHref}>Open related workspace<ArrowUpRight aria-hidden="true" size={14} /></AdminFormControlLink> : null}
          {runbookHref ? <AdminFormControlLink className="button-compact" href={runbookHref}>Open runbook<ArrowUpRight aria-hidden="true" size={14} /></AdminFormControlLink> : null}
        </nav>
      </div>
    </details>
  );
}

function ServiceAction({ service }: { readonly service: AdminExternalServiceStatus }) {
  const evidenceHref = service.evidenceHref ?? null;
  const relatedWorkspaceHref = service.relatedWorkspaceHref ?? service.escalationRoute;
  const runbookHref = service.runbookHref ?? service.runbookUrl;
  return (
    <span className="setup-service-action">
      <small>{service.safeOperatorAction}</small>
      {evidenceHref ? (
        <AdminFormControlLink className="button-secondary button-compact" href={evidenceHref}>
          View evidence<ArrowUpRight aria-hidden="true" size={14} />
        </AdminFormControlLink>
      ) : relatedWorkspaceHref ? (
        <AdminFormControlLink className="button-secondary button-compact" href={relatedWorkspaceHref}>
          Open related workspace<ArrowUpRight aria-hidden="true" size={14} />
        </AdminFormControlLink>
      ) : null}
      {runbookHref ? <AdminFormControlLink className="button-compact" href={runbookHref}>Open runbook<ArrowUpRight aria-hidden="true" size={14} /></AdminFormControlLink> : null}
    </span>
  );
}

function SetupServiceDetails({ service }: { readonly service: AdminExternalServiceStatus }) {
  return (
    <details className="setup-service-details">
      <summary aria-label={`Show technical details for ${service.name}`}>Technical details</summary>
      <dl>
        <div><dt>Owner</dt><dd>{service.ownerTeam}</dd></div>
        <div><dt>Verification</dt><dd>{service.verificationMethod ?? probeLabel(service.probeType)}</dd></div>
        <div><dt>Configuration checked</dt><dd>{service.configurationCheckedAt ? <DateTimeText value={service.configurationCheckedAt} /> : 'Not recorded'}</dd></div>
        <div><dt>Last success</dt><dd>{service.lastSuccessAt ? <DateTimeText value={service.lastSuccessAt} /> : 'No runtime success recorded'}</dd></div>
        <div><dt>Failure since</dt><dd>{service.failureSince ? <DateTimeText value={service.failureSince} /> : 'No active failure recorded'}</dd></div>
        <div><dt>Technical ID</dt><dd><code>{service.id}</code></dd></div>
        {service.latencyMs !== null ? <div><dt>Probe latency</dt><dd>{service.latencyMs} ms</dd></div> : null}
      </dl>
    </details>
  );
}

function SetupTab({ active, children, href, icon: Icon }: { readonly active: boolean; readonly children: string; readonly href: string; readonly icon: typeof Activity }) {
  return <AdminFormControlLink aria-current={active ? 'page' : undefined} className={active ? 'setup-workspace-tab is-active' : 'setup-workspace-tab'} href={href}><Icon aria-hidden="true" size={17} />{children}</AdminFormControlLink>;
}

function SetupSavedView({ active, count, href, label }: { readonly active: boolean; readonly count: number; readonly href: string; readonly label: string }) {
  return <AdminFormControlLink aria-current={active ? 'page' : undefined} className={active ? 'setup-saved-view is-active' : 'setup-saved-view'} href={href}><span>{label}</span><strong>{count}</strong></AdminFormControlLink>;
}

function SetupStatusItem({ href, label, stateLabel, tone, value }: { readonly href?: string; readonly label: string; readonly stateLabel: string; readonly tone: StatusBadgeTone; readonly value: number }) {
  const content = <><span>{label}</span><strong>{value}</strong><StatusBadge tone={tone}>{stateLabel}</StatusBadge></>;
  return href ? <AdminFormControlLink className="setup-status-item" href={href}>{content}</AdminFormControlLink> : <div className="setup-status-item">{content}</div>;
}

function setupHref(mode: SetupWorkspaceMode, view: SetupWorkspaceView) {
  return `/setup?mode=${mode}&view=${view}`;
}

function deferredActionLabel(name: string) {
  if (name === 'MoMo payments') return 'Review MoMo checklist';
  if (name === 'VNPay payments') return 'Review VNPay checklist';
  if (name === 'Referral app links') return 'Review link readiness';
  return 'Review re-entry checklist';
}

function futureReadinessLabel(status: AdminExternalServiceStatus['futureReadiness']) {
  if (status === 'READY_FOR_REENTRY') return 'Ready for re-entry';
  if (status === 'PARTIAL') return 'Partially prepared';
  return 'Not started';
}

function futureReadinessTone(status: AdminExternalServiceStatus['futureReadiness']): StatusBadgeTone {
  if (status === 'READY_FOR_REENTRY') return 'success';
  if (status === 'PARTIAL') return 'warning';
  return 'neutral';
}

function runtimePresentation(status: AdminExternalServiceStatus['runtimeStatus']): { label: string; tone: StatusBadgeTone } {
  if (status === 'HEALTHY') return { label: 'Healthy', tone: 'success' };
  if (status === 'DEGRADED') return { label: 'Degraded', tone: 'warning' };
  if (status === 'DOWN') return { label: 'Down', tone: 'danger' };
  if (status === 'UNKNOWN') return { label: 'Unknown', tone: 'warning' };
  return { label: 'Not monitored', tone: 'neutral' };
}

function configurationPresentation(service: Pick<AdminExternalServiceStatus, 'configurationStatus' | 'requiredForCurrentLaunch'>): { label: string; tone: StatusBadgeTone } {
  if (service.configurationStatus === 'CONFIGURED') return { label: 'Configuration ready', tone: 'success' };
  if (service.configurationStatus === 'INCOMPLETE') {
    return service.requiredForCurrentLaunch
      ? { label: 'Launch blocker', tone: 'danger' }
      : { label: 'Incomplete · outside launch scope', tone: 'warning' };
  }
  if (service.configurationStatus === 'DEFERRED') return { label: 'Deferred · intentionally disabled', tone: 'neutral' };
  if (service.configurationStatus === 'DISABLED') return { label: 'Disabled', tone: 'neutral' };
  return { label: 'Unknown', tone: 'warning' };
}

function configurationLabel(service: Pick<AdminExternalServiceStatus, 'configurationStatus' | 'requiredForCurrentLaunch'>) {
  return configurationPresentation(service).label;
}

function probeLabel(probeType: AdminExternalServiceStatus['probeType']) {
  if (probeType === 'CONNECTIVITY') return 'Connectivity probe';
  if (probeType === 'FUNCTIONAL_E2E') return 'Functional E2E';
  if (probeType === 'CONFIG') return 'Configuration check';
  return 'No validation';
}

function evidenceLevelLabel(service: AdminExternalServiceStatus) {
  if (service.evidenceLevel === 'FUNCTIONAL' || service.probeType === 'FUNCTIONAL_E2E') {
    return 'Functional verification';
  }
  if (service.evidenceLevel === 'CONNECTIVITY' || service.probeType === 'CONNECTIVITY') {
    return 'Connectivity verification';
  }
  return 'Configuration only';
}

function setupLoadError(status: number | null, errorCode: string | null, requestId: string | null) {
  const reference = requestId ? ` Reference ${requestId}.` : errorCode ? ` Code ${errorCode}.` : '';
  if (status === 401) return { title: 'Session expired', message: `Sign in again to refresh service status.${reference}`, actionLabel: 'Sign in again', actionHref: '/login?redirectTo=%2Fsetup' };
  if (status === 403) return { title: 'Access required', message: `Developer Setup access is required to view external service configuration.${reference}`, actionLabel: 'Review operator access', actionHref: '/admin-operators' };
  if (status === 429) return { title: 'Status checks temporarily limited', message: `The service status endpoint is rate limited. Wait briefly, then retry.${reference}`, actionLabel: 'Retry status', actionHref: '/setup' };
  return { title: 'Status check unavailable', message: `The service status endpoint did not respond. Existing services may still be operating.${reference}`, actionLabel: 'Retry status', actionHref: '/setup' };
}
