const TAX_POLICY_VERSION_PAGE_SIZE = 20;
const TAX_POLICY_AUDIT_LOG_PAGE_SIZE = 8;
const TAX_POLICY_EARNING_SAMPLE_PAGE_SIZE = 8;

type TaxPolicyParams = Record<string, string | string[] | undefined>;

export type TaxPolicyLoadPlan = {
  readonly auditLogsHref: string;
  readonly recentEarningsHref: string;
  readonly taxPolicyVersionsHref: string;
};

export function buildTaxPolicyLoadPlan(params: TaxPolicyParams): TaxPolicyLoadPlan {
  // Legacy details=* links remain valid, but every mode now resolves to the same complete page.
  void params;
  return {
    auditLogsHref: `/admin/audit-logs?q=tax_&take=${TAX_POLICY_AUDIT_LOG_PAGE_SIZE}`,
    recentEarningsHref: `/admin/earnings?range=30d&take=${TAX_POLICY_EARNING_SAMPLE_PAGE_SIZE}`,
    taxPolicyVersionsHref: `/admin/tax-policy-versions?take=${TAX_POLICY_VERSION_PAGE_SIZE}`,
  };
}

export function buildTaxPolicyEditorHref(policyId: string) {
  return `/tax-policy?policyId=${encodeURIComponent(policyId)}#tax-policy-editor`;
}
