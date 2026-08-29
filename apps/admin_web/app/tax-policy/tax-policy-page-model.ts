const TAX_POLICY_PAGE_SIZE = 25;
const TAX_POLICY_AUDIT_PAGE_SIZE = 25;
const TAX_POLICY_INTEGRITY_SAMPLE_SIZE = 25;

export type TaxPolicyView = 'current' | 'drafts' | 'history' | 'integrity';
type TaxPolicyParams = Record<string, string | string[] | undefined>;

export type TaxPolicyLoadPlan = {
  readonly view: TaxPolicyView;
  readonly page: number;
  readonly issuePage: number;
  readonly currentPolicyHref: string;
  readonly workspacePoliciesHref?: string;
  readonly selectedPolicyHref?: string;
  readonly approvalRequestsHref?: string;
  readonly auditEventHref?: string;
  readonly auditLogsHref?: string;
  readonly capabilityHref: string;
  readonly integrityRecordsHref?: string;
  readonly integritySummaryHref?: string;
  readonly recentEarningsHref?: string;
  readonly workspaceSummaryHref: string;
};

export function buildTaxPolicyLoadPlan(params: TaxPolicyParams): TaxPolicyLoadPlan {
  const view = taxPolicyView(firstParam(params.view) ?? firstParam(params.details));
  const page = positivePage(firstParam(params.page));
  const skip = (page - 1) * TAX_POLICY_PAGE_SIZE;
  const issuePage = positivePage(firstParam(params.issuePage));
  const issueSkip = (issuePage - 1) * TAX_POLICY_INTEGRITY_SAMPLE_SIZE;
  const policyId = (firstParam(params.policyId) ?? firstParam(params.clonePolicyId))?.trim();
  const provenance = firstParam(params.provenance)?.trim();
  const filters = new URLSearchParams();
  if (provenance) filters.set('provenance', provenance);
  if (view === 'current' || view === 'drafts') {
    filters.set('source', firstParam(params.source) === 'test-legacy' ? 'test-legacy' : 'production');
  } else if (view === 'history') {
    filters.set('source', firstParam(params.source) === 'test-legacy' ? 'test-legacy' : 'production');
    for (const key of ['q', 'lifecycle', 'effectiveFrom', 'effectiveTo'] as const) {
      const value = firstParam(params[key])?.trim();
      if (value) filters.set(key, value);
    }
  }
  const workspaceView = view === 'current' ? 'drafts' : view;
  const workspacePoliciesHref = view === 'integrity'
    ? undefined
    : `/admin/tax-policy-versions?view=${workspaceView}&take=${TAX_POLICY_PAGE_SIZE}&skip=${skip}${filters.size ? `&${filters.toString()}` : ''}`;
  const issue = firstParam(params.issue)?.trim();
  const issueSource = integritySource(firstParam(params.issueSource));
  const issueSort = firstParam(params.issueSort) === 'newest' ? 'newest' : 'oldest';
  const audit = new URLSearchParams({
    source: auditSource(firstParam(params.auditSource)),
    take: String(TAX_POLICY_AUDIT_PAGE_SIZE),
    skip: String(skip),
  });
  for (const [queryKey, paramKey] of [
    ['action', 'auditAction'],
    ['actorId', 'auditActorId'],
    ['policyVersionId', 'auditPolicyId'],
    ['from', 'auditFrom'],
    ['to', 'auditTo'],
  ] as const) {
    const value = firstParam(params[paramKey])?.trim();
    if (value) audit.set(queryKey, value);
  }
  const auditEventId = firstParam(params.auditEventId)?.trim();
  const integrity = new URLSearchParams({
    issue: issue ?? '',
    source: issueSource,
    sort: issueSort,
    take: String(TAX_POLICY_INTEGRITY_SAMPLE_SIZE),
    skip: String(issueSkip),
  });
  for (const [queryKey, paramKey] of [['from', 'issueFrom'], ['to', 'issueTo']] as const) {
    const value = firstParam(params[paramKey])?.trim();
    if (value) integrity.set(queryKey, value);
  }

  return {
    view,
    page,
    issuePage,
    currentPolicyHref: '/admin/tax-policy-versions?view=current&take=2',
    workspacePoliciesHref,
    selectedPolicyHref: policyId
      ? `/admin/tax-policy-versions?id=${encodeURIComponent(policyId)}&take=1`
      : undefined,
    approvalRequestsHref: view === 'drafts' && policyId
      ? `/admin/tax-policy-approval-requests?policyVersionId=${encodeURIComponent(policyId)}&take=${TAX_POLICY_PAGE_SIZE}&skip=0`
      : undefined,
    capabilityHref: `/admin/tax-policy-capabilities${policyId ? `?policyVersionId=${encodeURIComponent(policyId)}` : ''}`,
    auditEventHref: view === 'integrity' && auditEventId
      ? `/admin/tax-policy-audit-logs?eventId=${encodeURIComponent(auditEventId)}&source=${encodeURIComponent(auditSource(firstParam(params.auditSource)))}&take=1&skip=0`
      : undefined,
    auditLogsHref: view === 'integrity'
      ? `/admin/tax-policy-audit-logs?${audit.toString()}`
      : undefined,
    integrityRecordsHref: view === 'integrity' && issue
      ? `/admin/tax-policy-integrity-records?${integrity.toString()}`
      : undefined,
    integritySummaryHref: view === 'integrity'
      ? `/admin/tax-policy-integrity-summary?source=${encodeURIComponent(issueSource)}`
      : undefined,
    recentEarningsHref: view === 'integrity'
      ? `/admin/earnings?range=30d&take=${TAX_POLICY_INTEGRITY_SAMPLE_SIZE}`
      : undefined,
    workspaceSummaryHref: '/admin/tax-policy-workspace-summary',
  };
}

export function buildTaxPolicyEditorHref(policyId: string, source = 'production') {
  return `/tax-policy?view=drafts&source=${encodeURIComponent(source)}&policyId=${encodeURIComponent(policyId)}#tax-policy-${encodeURIComponent(policyId)}`;
}

export function buildTaxPolicyPageHref(
  view: TaxPolicyView,
  page: number,
  queryState: Record<string, string | undefined> = {},
) {
  const query = new URLSearchParams({ view, page: String(page) });
  Object.entries(queryState).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  return `/tax-policy?${query.toString()}`;
}

function taxPolicyView(value?: string): TaxPolicyView {
  if (value === 'drafts' || value === 'editor') return 'drafts';
  if (value === 'history' || value === 'records') return 'history';
  if (value === 'integrity' || value === 'audit') return 'integrity';
  return 'current';
}

function positivePage(value?: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function auditSource(value?: string) {
  return value === 'test' || value === 'legacy' || value === 'unknown' || value === 'test-legacy'
    ? value
    : 'production';
}

function integritySource(value?: string) {
  return value === 'all' || value === 'production' || value === 'test' || value === 'legacy' || value === 'unknown'
    ? value
    : 'production';
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
