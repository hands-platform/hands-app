import type {
  AdminExternalReadiness,
  AdminExternalServiceStatus,
} from '../../lib/admin-api';
import type { SetupGroupDetail } from './setup-group-detail-section';
import { setupReadinessDisplayText } from './setup-readiness-copy';

export type SetupOrderItem = {
  readonly id: string;
  readonly title: string;
  readonly phase: string;
  readonly operatorAction: string;
  readonly exitCriteria: string;
  readonly purpose: string;
  readonly env: readonly string[];
  readonly notes: readonly string[];
  readonly commands: readonly string[];
};

export type ExternalRegistrationPlanItem = {
  readonly id: string;
  readonly groupId: string;
  readonly title: string;
  readonly provider: string;
  readonly owner: string;
  readonly status?: string;
  readonly statusClass?: string;
  readonly detail: string;
  readonly env: readonly string[];
};

export type ExternalRegistrationPlanDisplayItem = Omit<
  ExternalRegistrationPlanItem,
  'status' | 'statusClass'
> & {
  readonly status: string;
  readonly statusClass: string;
};

export type SetupOperationalHealthRow = {
  readonly affectedWork: string;
  readonly id: string;
  readonly lastCheckedAt: string | null;
  readonly name: string;
  readonly nextAction: string;
  readonly owner: string;
  readonly status: 'Blocked' | 'Limited' | 'Operational' | 'Unavailable';
  readonly tone: 'danger' | 'info' | 'success' | 'warning';
};

export type SetupWorkspaceMode = 'runtime' | 'readiness';
export type SetupWorkspaceView = 'needs-action' | 'active' | 'evidence-gaps' | 'deferred';

export function parseSetupWorkspaceQuery(
  params: Record<string, string | string[] | undefined>,
): { mode: SetupWorkspaceMode; view: SetupWorkspaceView } {
  const rawMode = singleSetupParam(params.mode);
  const rawView = singleSetupParam(params.view);
  let mode: SetupWorkspaceMode = rawMode === 'readiness' ? 'readiness' : 'runtime';
  if (rawView === 'deferred') mode = 'readiness';
  if (rawView === 'evidence-gaps') mode = 'runtime';

  const allowedViews = mode === 'runtime'
    ? ['needs-action', 'active', 'evidence-gaps']
    : ['needs-action', 'active', 'deferred'];
  const view: SetupWorkspaceView = allowedViews.includes(rawView)
    ? (rawView as SetupWorkspaceView)
    : mode === 'runtime'
      ? 'active'
      : 'needs-action';
  return { mode, view };
}

export function setupWorkspaceCanonicalHref(
  params: Record<string, string | string[] | undefined>,
) {
  const rawMode = singleSetupParam(params.mode);
  const rawView = singleSetupParam(params.view);
  const modeIsValid = rawMode === '' || rawMode === 'runtime' || rawMode === 'readiness';
  const globalViewIsValid = rawView === '' || ['needs-action', 'active', 'evidence-gaps', 'deferred'].includes(rawView);
  const requestedMode = rawMode === 'readiness' ? 'readiness' : 'runtime';
  const viewIsValidForMode = rawView === '' || (
    requestedMode === 'runtime'
      ? ['needs-action', 'active', 'evidence-gaps'].includes(rawView)
      : ['needs-action', 'active', 'deferred'].includes(rawView)
  );

  if (modeIsValid && globalViewIsValid && viewIsValidForMode) return null;

  const workspace = parseSetupWorkspaceQuery(params);
  return `/setup?mode=${workspace.mode}&view=${workspace.view}`;
}

export function externalServicesFromReadiness(
  readiness: AdminExternalReadiness,
): AdminExternalServiceStatus[] {
  if (readiness.services) {
    return readiness.services;
  }

  return readiness.checks
    .filter(isOperatorHealthCheck)
    .map((check, index) => {
      const deferred = check.scope === 'DEFERRED' || check.deferred === true;
      const deferredMetadata = deferred ? legacyDeferredMetadata(check.name) : null;
      return {
        id: `${check.category}-${index}`,
        name: setupReadinessDisplayText(check.name),
        category: legacyExternalCategory(check.category),
        launchScope: deferred ? 'DEFERRED' : 'CURRENT_STAGE',
        enabled: !deferred,
        requiredForCurrentLaunch: !deferred,
        configurationStatus: deferred
          ? 'DEFERRED'
          : check.status === 'READY'
            ? 'CONFIGURED'
            : 'INCOMPLETE',
        configurationCheckedAt: readiness.timestamp || null,
        runtimeStatus: 'NOT_MONITORED',
        probeType: 'CONFIG',
        evidenceLevel: 'CONFIGURATION_ONLY',
        lastVerifiedAt: readiness.timestamp || null,
        verificationMethod: 'Legacy configuration check; no safe runtime probe.',
        lastProbeAt: null,
        lastSuccessAt: null,
        failureSince: null,
        latencyMs: null,
        isStale: false,
        evidenceSummary: 'Configuration was checked. Runtime evidence is not available.',
        impactSummary: 'No confirmed impact.',
        ownerTeam: ownerTeamForCategory(check.category),
        evidenceHref: null,
        relatedWorkspaceHref: escalationRouteForCategory(check.category),
        runbookHref: null,
        escalationRoute: escalationRouteForCategory(check.category),
        runbookUrl: null,
        deferredReason: deferredMetadata?.deferredReason ?? null,
        futureReadiness: deferredMetadata ? 'NOT_STARTED' : null,
        reentryChecks: deferredMetadata?.reentryChecks ?? [],
        reviewTrigger: deferredMetadata?.reviewTrigger ?? null,
        reviewedAt: null,
        platformScope: deferredMetadata?.platformScope ?? null,
        safeOperatorAction: deferred
          ? deferredMetadata?.operatorAction ?? 'Review this capability when its launch trigger is reached.'
          : check.status === 'READY'
            ? 'Review recent operational evidence before relying on this service.'
            : setupReadinessDisplayText(check.operatorAction ?? check.detail),
        evidenceGap: !deferred,
      } satisfies AdminExternalServiceStatus;
    });
}

export function setupServiceNeedsAction(service: AdminExternalServiceStatus) {
  return (
    (service.requiredForCurrentLaunch && service.configurationStatus === 'INCOMPLETE') ||
    (service.enabled && ['DOWN', 'DEGRADED'].includes(service.runtimeStatus))
  );
}

export function setupServicesForView(
  services: readonly AdminExternalServiceStatus[],
  mode: SetupWorkspaceMode,
  view: SetupWorkspaceView,
) {
  return services
    .filter((service) => {
      if (view === 'deferred') return service.configurationStatus === 'DEFERRED';
      if (view === 'needs-action') {
        return mode === 'runtime'
          ? setupServiceNeedsAction(service)
          : service.requiredForCurrentLaunch && service.configurationStatus === 'INCOMPLETE';
      }
      if (view === 'evidence-gaps') return setupServiceHasEvidenceGap(service);
      return mode === 'runtime'
        ? service.enabled && service.configurationStatus !== 'DEFERRED'
        : service.requiredForCurrentLaunch && service.configurationStatus !== 'DEFERRED';
    })
    .sort((left, right) => setupServicePriority(left) - setupServicePriority(right) || left.name.localeCompare(right.name));
}

export function setupWorkspaceCounts(services: readonly AdminExternalServiceStatus[]) {
  return {
    needsAction: services.filter(setupServiceNeedsAction).length,
    launchBlockers: services.filter(
      (service) => service.requiredForCurrentLaunch && service.configurationStatus === 'INCOMPLETE',
    ).length,
    degraded: services.filter((service) => service.enabled && service.runtimeStatus === 'DEGRADED').length,
    unknown: services.filter((service) => service.enabled && service.runtimeStatus === 'UNKNOWN').length,
    notMonitored: services.filter((service) => service.enabled && service.runtimeStatus === 'NOT_MONITORED').length,
    evidenceGaps: services.filter(setupServiceHasEvidenceGap).length,
    deferred: services.filter((service) => service.configurationStatus === 'DEFERRED').length,
    required: services.filter((service) => service.requiredForCurrentLaunch).length,
    configurationReady: services.filter(
      (service) => service.requiredForCurrentLaunch && service.configurationStatus === 'CONFIGURED',
    ).length,
    runtimeVerified: services.filter(
      (service) =>
        service.requiredForCurrentLaunch &&
        (service.evidenceLevel ?? evidenceLevelFromProbe(service.probeType)) !== 'CONFIGURATION_ONLY' &&
        (service.lastVerifiedAt ?? service.lastProbeAt) !== null,
    ).length,
  };
}

export function setupServiceHasEvidenceGap(service: AdminExternalServiceStatus) {
  return service.evidenceGap ?? (
    service.requiredForCurrentLaunch &&
    service.enabled &&
    ['UNKNOWN', 'NOT_MONITORED'].includes(service.runtimeStatus)
  );
}

function setupServicePriority(service: AdminExternalServiceStatus) {
  if (setupServiceNeedsAction(service)) return 0;
  if (service.runtimeStatus === 'DOWN') return 1;
  if (service.runtimeStatus === 'DEGRADED') return 2;
  if (service.runtimeStatus === 'UNKNOWN') return 3;
  if (service.runtimeStatus === 'NOT_MONITORED') return 4;
  if (service.runtimeStatus === 'HEALTHY') return 5;
  return 6;
}

function evidenceLevelFromProbe(probeType: AdminExternalServiceStatus['probeType']) {
  if (probeType === 'CONNECTIVITY') return 'CONNECTIVITY' as const;
  if (probeType === 'FUNCTIONAL_E2E') return 'FUNCTIONAL' as const;
  return 'CONFIGURATION_ONLY' as const;
}

function singleSetupParam(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim().toLowerCase() ?? '';
}

function legacyExternalCategory(category: string): AdminExternalServiceStatus['category'] {
  if (category === 'supabase') return 'core';
  if (category === 'supabase-auth') return 'auth';
  if (category === 'payments') return 'payments';
  if (category === 'storage') return 'storage';
  if (category === 'referrals') return 'referrals';
  if (category === 'push' || category === 'sms') return 'messaging';
  return 'maps';
}

function ownerTeamForCategory(category: string) {
  if (category === 'payments') return 'Finance operations';
  if (category === 'referrals') return 'Growth operations';
  if (category === 'supabase' || category === 'storage') return 'Platform operations';
  if (category === 'maps') return 'Marketplace operations';
  if (category === 'supabase-auth') return 'Identity operations';
  return 'Customer operations';
}

function escalationRouteForCategory(category: string) {
  if (category === 'payments') return '/payments';
  if (category === 'referrals') return '/referrals/customers#referral-link-readiness';
  if (category === 'push') return '/notifications';
  if (category === 'maps') return '/vietnam-overview';
  if (category === 'storage') return '/partners';
  return '/app-sessions';
}

function legacyDeferredMetadata(name: string) {
  if (name === 'MoMo payments') {
    return {
      deferredReason: 'Online payments are outside the current cash-only launch.',
      operatorAction: 'Review the MoMo re-entry checklist when online payments enter scope.',
      platformScope: null,
      reentryChecks: [
        { label: 'Merchant sandbox connection', status: 'PENDING' as const },
        { label: 'Public HTTPS callback and signed-flow smoke', status: 'PENDING' as const },
      ],
      reviewTrigger: 'When the online-payment phase is approved.',
    };
  }
  if (name === 'VNPay payments') {
    return {
      deferredReason: 'VNPay is intentionally disabled during the cash-only launch.',
      operatorAction: 'Review the VNPay re-entry checklist when online payments enter scope.',
      platformScope: null,
      reentryChecks: [
        { label: 'Merchant sandbox and signing configuration', status: 'PENDING' as const },
        { label: 'Public return route, IPN, query, and refund smoke', status: 'PENDING' as const },
      ],
      reviewTrigger: 'After the online-payment phase and public DNS/TLS are approved.',
    };
  }
  return {
    deferredReason: 'Public referral sharing and store routing are outside the current launch stage.',
    operatorAction: 'Review referral link readiness before public sharing is enabled.',
    platformScope: 'ANDROID_MVP' as const,
    reentryChecks: [
      { label: 'Public referral base and Android destinations', status: 'PENDING' as const },
      { label: 'Android device-routing smoke', status: 'PENDING' as const },
      { label: 'Customer and Partner iOS destinations', status: 'FUTURE' as const },
    ],
    reviewTrigger: 'Before public referral sharing or an Android store release begins.',
  };
}

export function buildOperationalHealthRows(
  readiness: AdminExternalReadiness,
  registrationPlan: readonly ExternalRegistrationPlanItem[],
  readinessUnavailable = false,
): SetupOperationalHealthRow[] {
  if (readinessUnavailable) {
    return [
      {
        affectedWork: 'External service health cannot be confirmed from the Admin API.',
        id: 'system-health-unavailable',
        lastCheckedAt: null,
        name: 'System health data',
        nextAction: 'Restore API connectivity, then refresh this page before relying on service status.',
        owner: 'Owner unavailable',
        status: 'Unavailable',
        tone: 'danger',
      },
    ];
  }

  return readiness.checks.filter(isOperatorHealthCheck).map((check, index) => {
    const owners = registrationPlan
      .filter((item) => setupGroupMatches(item.groupId, check.category))
      .map((item) => item.owner)
      .filter((owner, ownerIndex, allOwners) => allOwners.indexOf(owner) === ownerIndex);
    const status = check.status === 'READY' ? 'Operational' : check.status === 'PARTIAL' ? 'Limited' : 'Blocked';

    return {
      affectedWork: operationalImpactForCheck(check.category, check.name),
      id: `${check.category}-${check.name}-${index}`,
      lastCheckedAt: readiness.timestamp || null,
      name: setupReadinessDisplayText(check.name),
      nextAction: status === 'Operational'
        ? 'No operator action required.'
        : operationalNextActionForCheck(check.category, check.name),
      owner: owners.join(', ') || 'Owner unavailable',
      status,
      tone: status === 'Operational' ? 'success' : status === 'Limited' ? 'warning' : 'danger',
    };
  });
}

function isOperatorHealthCheck(check: AdminExternalReadiness['checks'][number]) {
  return check.category !== 'mobile' && check.category !== 'mobile-release';
}

function operationalImpactForCheck(category: string, name: string) {
  if (name === 'Production SMS') {
    return 'Customer and Partner phone verification messages.';
  }
  if (name === 'MoMo payments') {
    return 'MoMo payment authorization, refund, and reconciliation.';
  }
  if (name === 'VNPay payments') {
    return 'VNPay payment authorization, refund, and reconciliation.';
  }

  switch (category) {
    case 'supabase':
      return 'Customer, Partner, booking, and retained service records.';
    case 'supabase-auth':
      return 'Customer and Partner phone sign-in.';
    case 'maps':
      return 'Address search, location confirmation, and nearby Partner discovery.';
    case 'referrals':
      return 'Referral sharing and opening the correct app destination.';
    case 'storage':
      return 'Partner documents, profile media, and support evidence.';
    case 'push':
      return 'Customer and Partner booking, chat, and payment notifications.';
    case 'payments':
      return 'Digital payment authorization, refund, and reconciliation.';
    case 'operations-policy':
      return 'Booking matching, wallet gates, and operational controls.';
    default:
      return 'Operational impact is not documented for this service.';
  }
}

function operationalNextActionForCheck(category: string, name: string) {
  if (name === 'Production SMS') {
    return 'Restore SMS delivery before directing customers or Partners to retry phone verification.';
  }
  if (name === 'MoMo payments') {
    return 'Restore MoMo merchant configuration before accepting MoMo payments.';
  }
  if (name === 'VNPay payments') {
    return 'Restore VNPay merchant configuration before accepting VNPay payments.';
  }

  switch (category) {
    case 'supabase':
      return 'Restore Supabase connectivity and confirm affected records are available.';
    case 'supabase-auth':
      return 'Restore phone sign-in before directing customers or Partners to retry.';
    case 'maps':
      return 'Restore maps and geocoding before relying on address or nearby Partner flows.';
    case 'referrals':
      return 'Configure public referral and app destinations before enabling referral sharing.';
    case 'storage':
      return 'Restore storage and media delivery before processing document or evidence work.';
    case 'push':
      return 'Restore push delivery; use in-app records for urgent follow-up until delivery is confirmed.';
    case 'payments':
      return 'Restore the affected payment method before accepting new digital payments.';
    case 'operations-policy':
      return 'Review blocked policy settings before relying on booking operations.';
    default:
      return 'Review this service with the owning team before relying on affected workflows.';
  }
}

export function buildSummary(readiness: AdminExternalReadiness, readinessUnavailable = false) {
  if (readinessUnavailable) {
    return { ready: 0, partial: 0, blocked: 1, missing: 1 };
  }

  return readiness.checks.reduce(
    (summary, check) => ({
      ready: summary.ready + (check.status === 'READY' ? 1 : 0),
      partial: summary.partial + (check.status === 'PARTIAL' ? 1 : 0),
      blocked: summary.blocked + (check.status === 'BLOCKED' ? 1 : 0),
      missing: summary.missing + check.missing.length + (check.invalid?.length ?? 0),
    }),
    { ready: 0, partial: 0, blocked: 0, missing: 0 },
  );
}

export function buildExternalBacklog(
  readiness: AdminExternalReadiness,
  setupOrder: readonly SetupOrderItem[],
  readinessUnavailable = false,
) {
  if (readinessUnavailable) {
    return [
      {
        groupId: 'live-readiness',
        groupTitle: 'API runtime',
        name: 'API readiness endpoint',
        reason: 'Start the HANDS API or Docker services, then refresh this page before using setup status.',
        commands: [],
      },
    ];
  }

  return readiness.checks.flatMap((check) => {
    const group = setupOrder.find((setupGroup) => setupGroupMatches(setupGroup.id, check.category));
    const groupId = group?.id ?? 'setup';
    const groupTitle = group?.title ?? check.category;
    const missing = [...check.missing, ...(check.invalid ?? [])];
    return missing.map((name) => ({
      groupId,
      groupTitle,
      name: setupReadinessDisplayText(name),
      reason: setupReadinessDisplayText(check.operatorAction ?? check.detail),
      commands: check.commands ?? [],
    }));
  });
}

export function buildGroupStatuses(readiness: AdminExternalReadiness, setupOrder: readonly SetupOrderItem[]) {
  return setupOrder.map((group) => {
    const relatedChecks = readiness.checks.filter((check) => setupGroupMatches(group.id, check.category));
    return {
      id: group.id,
      title: group.title,
      phase: group.phase,
      status: setupGroupStatus(relatedChecks),
    };
  });
}

export function buildSetupGroupDetails(
  readiness: AdminExternalReadiness,
  setupOrder: readonly SetupOrderItem[],
): SetupGroupDetail[] {
  return setupOrder.map((group) => {
    const relatedChecks = readiness.checks.filter((check) => setupGroupMatches(group.id, check.category));
    return {
      id: group.id,
      title: group.title,
      phase: group.phase,
      operatorAction: group.operatorAction,
      purpose: group.purpose,
      status: setupGroupStatus(relatedChecks),
      statusClass: setupGroupSignalClass(relatedChecks),
      envPills: group.env.map((name) => ({
        name,
        className: envPillClass(name, relatedChecks),
      })),
      notes: group.notes,
      exitCriteria: group.exitCriteria,
      commands: group.commands,
    };
  });
}

export function buildNextOperatorActions(
  readiness: AdminExternalReadiness,
  setupOrder: readonly SetupOrderItem[],
  readinessUnavailable = false,
) {
  const backlog = buildExternalBacklog(readiness, setupOrder, readinessUnavailable);
  return backlog
    .filter((item) => !isDeferredSetupGroup(item.groupId))
    .map((item) => {
      if (item.groupId === 'live-readiness') {
        return {
          ...item,
          phase: 'Runtime check',
          action: 'Start the API/Docker services and rerun setup doctor before external E2E.',
          commands: item.commands ?? [],
          rank: -1,
        };
      }
      const groupIndex = setupOrder.findIndex((group) => group.id === item.groupId);
      const group = setupOrder[groupIndex] ?? setupOrder[0];
      return {
        ...item,
        phase: group.phase,
        action: group.operatorAction,
        commands: item.commands ?? [],
        rank: groupIndex === -1 ? setupOrder.length : groupIndex,
      };
    })
    .sort((left, right) => left.rank - right.rank || left.name.localeCompare(right.name));
}

export function buildDeferredOperatorActions(
  readiness: AdminExternalReadiness,
  setupOrder: readonly SetupOrderItem[],
  readinessUnavailable = false,
) {
  const backlog = buildExternalBacklog(readiness, setupOrder, readinessUnavailable);
  if (readinessUnavailable) {
    return [];
  }

  return backlog
    .filter((item) => isDeferredSetupGroup(item.groupId))
    .map((item) => {
      const groupIndex = setupOrder.findIndex((group) => group.id === item.groupId);
      const group = setupOrder[groupIndex] ?? setupOrder[0];
      return {
        ...item,
        phase: group.phase,
        action: group.operatorAction,
        commands: item.commands ?? [],
        rank: groupIndex === -1 ? setupOrder.length : groupIndex,
      };
    })
    .sort((left, right) => left.rank - right.rank || left.name.localeCompare(right.name));
}

export function buildCurrentStageStatus(
  readiness: AdminExternalReadiness,
  setupOrder: readonly SetupOrderItem[],
  readinessUnavailable = false,
) {
  if (readinessUnavailable) {
    return {
      ok: false,
      blockers: 1,
      label: 'API unavailable',
      helper: 'Start local API/Docker services before using setup status.',
    };
  }

  const blockers = buildNextOperatorActions(readiness, setupOrder, false).length;
  const apiBlockingCount = readiness.blockingCategories?.length;
  const effectiveBlockers = typeof apiBlockingCount === 'number' ? apiBlockingCount : blockers;
  const currentStageOk = readiness.currentStageOk ?? effectiveBlockers === 0;
  return {
    ok: currentStageOk,
    blockers: effectiveBlockers,
    label: currentStageOk ? 'Current stage clear' : 'Current stage blocked',
    helper: currentStageOk
      ? 'Local MVP work can continue; deferred production integrations remain tracked separately.'
      : 'These are non-deferred setup gaps that can block current local/staging E2E work.',
  };
}

export function buildExternalRegistrationPlan(
  readiness: AdminExternalReadiness,
  externalRegistrationPlan: readonly ExternalRegistrationPlanItem[],
  readinessUnavailable = false,
): ExternalRegistrationPlanDisplayItem[] {
  return externalRegistrationPlan.map((item): ExternalRegistrationPlanDisplayItem => {
    if (item.status && item.statusClass) {
      return { ...item, status: item.status, statusClass: item.statusClass };
    }

    if (readinessUnavailable) {
      return { ...item, status: 'Not checked', statusClass: 'pill-warn' };
    }

    const checks = readiness.checks.filter((check) => setupGroupMatches(item.groupId, check.category));
    if (checks.length === 0) {
      return { ...item, status: 'Not checked', statusClass: 'pill-neutral' };
    }
    if (checks.some((check) => check.status === 'BLOCKED')) {
      return { ...item, status: 'Needs credential', statusClass: 'pill-warn' };
    }
    if (checks.some((check) => check.status === 'PARTIAL')) {
      return { ...item, status: 'Partial', statusClass: 'pill-info' };
    }
    return { ...item, status: 'Ready', statusClass: 'pill-success' };
  });
}

export function isReadinessUnavailable(readiness: AdminExternalReadiness) {
  return !readiness.ok && readiness.checks.length === 0;
}

function isDeferredSetupGroup(groupId: string) {
  return ['supabase-auth', 'notifications', 'payments', 'storage', 'mobile-release', 'referrals'].includes(
    groupId,
  );
}

function setupGroupMatches(groupId: string, category: string) {
  if (groupId === 'supabase') {
    return category === 'supabase';
  }
  if (groupId === 'supabase-auth') {
    return category === 'supabase-auth' || category === 'sms';
  }
  if (groupId === 'mobile') {
    return category === 'mobile';
  }
  if (groupId === 'mobile-release') {
    return category === 'mobile-release';
  }
  if (groupId === 'notifications') {
    return category === 'push';
  }
  if (groupId === 'payments') {
    return category === 'payments';
  }
  return groupId === category;
}

function setupGroupStatus(checks: AdminExternalReadiness['checks']) {
  if (checks.length === 0) {
    return 'Not checked';
  }
  if (checks.some((check) => check.status === 'BLOCKED')) {
    return 'Blocked';
  }
  if (checks.some((check) => check.status === 'PARTIAL')) {
    return 'Partial';
  }
  return 'Ready';
}

function setupGroupSignalClass(checks: AdminExternalReadiness['checks']) {
  const status = setupGroupStatus(checks);
  return `signal ${status === 'Ready' ? 'signal-ok' : status === 'Partial' ? 'signal-info' : 'signal-warn'}`;
}

function envPillClass(name: string, checks: AdminExternalReadiness['checks']) {
  const configured = checks.some((check) => check.configured.includes(name));
  const missing = checks.some(
    (check) => check.missing.includes(name) || (check.invalid ?? []).includes(name),
  );
  if (configured) {
    return 'pill pill-success';
  }
  if (missing) {
    return 'pill pill-warn';
  }
  return 'pill pill-neutral';
}
