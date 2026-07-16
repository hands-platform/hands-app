import { readSearchParam } from '../../lib/date-range';

export type TaxPolicyDetailsMode = 'summary' | 'all' | 'editor' | 'audit' | 'records';

const TAX_POLICY_VERSION_PAGE_SIZE = 20;
const TAX_POLICY_AUDIT_LOG_PAGE_SIZE = 8;
const TAX_POLICY_EARNING_SAMPLE_PAGE_SIZE = 8;

type TaxPolicyParams = Record<string, string | string[] | undefined>;

export type TaxPolicyLoadPlan = {
  readonly auditLogsHref: string | null;
  readonly detailsMode: TaxPolicyDetailsMode;
  readonly recentEarningsHref: string | null;
  readonly taxPolicyVersionsHref: string;
  readonly shouldRenderAudit: boolean;
  readonly shouldRenderEditor: boolean;
  readonly shouldRenderRecords: boolean;
  readonly shouldRenderSummary: boolean;
  readonly shouldRenderWorkspaceIndex: boolean;
};

export function buildTaxPolicyLoadPlan(params: TaxPolicyParams): TaxPolicyLoadPlan {
  const detailsMode = normalizeTaxPolicyDetailsMode(readSearchParam(params.details));
  const shouldRenderAudit = detailsMode === 'audit';
  const shouldRenderEditor = detailsMode === 'editor';
  const shouldRenderRecords = detailsMode === 'records';

  return {
    auditLogsHref: shouldRenderAudit
      ? `/admin/audit-logs?q=tax_&take=${TAX_POLICY_AUDIT_LOG_PAGE_SIZE}`
      : null,
    detailsMode,
    recentEarningsHref: shouldRenderRecords
      ? `/admin/earnings?range=30d&take=${TAX_POLICY_EARNING_SAMPLE_PAGE_SIZE}`
      : null,
    taxPolicyVersionsHref: `/admin/tax-policy-versions?take=${TAX_POLICY_VERSION_PAGE_SIZE}`,
    shouldRenderAudit,
    shouldRenderEditor,
    shouldRenderRecords,
    shouldRenderSummary: detailsMode === 'summary',
    shouldRenderWorkspaceIndex: detailsMode === 'summary' || detailsMode === 'all',
  };
}

export function buildTaxPolicyDetailsHref(detailsMode: TaxPolicyDetailsMode) {
  return detailsMode === 'summary' ? '/tax-policy' : `/tax-policy?details=${detailsMode}`;
}

export function buildTaxPolicyEditorHref(policyId: string) {
  return `/tax-policy?details=editor&policyId=${encodeURIComponent(policyId)}`;
}

function normalizeTaxPolicyDetailsMode(value: string): TaxPolicyDetailsMode {
  return value === 'all' || value === 'editor' || value === 'audit' || value === 'records'
    ? value
    : 'summary';
}
