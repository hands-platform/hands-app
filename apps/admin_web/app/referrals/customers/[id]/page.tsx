import { notFound } from 'next/navigation';

import { canViewAdminDeveloperSystem } from '../../../../components/admin-developer-system-section';
import { AdminInlineNotice } from '../../../../components/admin-inline-notice';
import { AdminPageTemplate } from '../../../../components/admin-page-template';
import { AdminTextLink } from '../../../../components/admin-text-link';
import { type AdminCustomerReferralParent, type AdminUser, adminGetResult } from '../../../../lib/admin-api';
import { getCurrentAdminOperatorAccess } from '../../../../lib/admin-operator-access';
import { readSearchParam } from '../../../../lib/date-range';
import { buildFinanceApproverOptions } from '../../../finance-tax/finance-approver-options';
import { ReferralParentDetailPage, referralParentNeedsFinanceApprover } from '../../referral-detail';

type PageProps = {
  readonly params: Promise<{ id: string }>;
  readonly searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CustomerReferralDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const [operatorAccess, rowResult] = await Promise.all([
    getCurrentAdminOperatorAccess(),
    adminGetResult<AdminCustomerReferralParent | null>(`/admin/referrals/customers/${encodeURIComponent(id)}`, null),
  ]);
  if (!rowResult.ok && rowResult.status === 404) {
    notFound();
  }
  if (!rowResult.ok || !rowResult.data) {
    return (
      <AdminPageTemplate
        description="The referral record could not be loaded. No reward decision is available while evidence is unavailable."
        title="Customer referral unavailable"
      >
        <AdminInlineNotice className="admin-mt-16" role="alert" tone="danger">
          Customer referral evidence could not be loaded. Retry before making a reward decision.
        </AdminInlineNotice>
        <AdminTextLink className="admin-mt-8" href={`/referrals/customers/${encodeURIComponent(id)}`}>
          Retry
        </AdminTextLink>
      </AdminPageTemplate>
    );
  }
  const row = rowResult.data;
  const financeApproverResult = referralParentNeedsFinanceApprover(row)
    ? await adminGetResult<AdminUser[]>('/admin/users?take=50&role=ADMIN&view=finance-approver-directory', [])
    : { data: [] as AdminUser[], ok: true, status: 200 };
  const financeApproverUsers = financeApproverResult.data;
  const financeApproverOptions = buildFinanceApproverOptions(financeApproverUsers, operatorAccess?.id ?? null);
  const actionNotice = buildReferralActionNotice(
    readSearchParam(resolvedSearchParams.actionStatus),
    readSearchParam(resolvedSearchParams.actionCode),
    readSearchParam(resolvedSearchParams.actionMessage),
  );

  return (
    <ReferralParentDetailPage
      actionNotice={actionNotice}
      actionReason={readSearchParam(resolvedSearchParams.actionReason)}
      audience="customer"
      canViewDeveloperSetup={canViewAdminDeveloperSystem(operatorAccess)}
      financeApproverOptions={financeApproverOptions}
      highlightRewardId={readSearchParam(resolvedSearchParams.rewardId)}
      row={row}
    />
  );
}

function buildReferralActionNotice(status: string, code: string, message: string) {
  if (status === 'saved') {
    return {
      message: message.slice(0, 300) || 'Reward decision saved with audit evidence.',
      tone: 'success' as const,
    };
  }
  if (status !== 'blocked') return undefined;

  return {
    message: message.slice(0, 300) || referralActionFallbackMessage(code),
    tone: code === 'conflict' ? 'warning' as const : 'danger' as const,
  };
}

function referralActionFallbackMessage(code: string) {
  if (code === 'conflict') return 'This reward changed after the page loaded. Refresh before deciding again.';
  if (code === 'forbidden') return 'You do not have permission to perform this reward action.';
  if (code === 'validation') return 'Review the reason, confirmation, and reward evidence before submitting.';
  if (code === 'service') return 'The reward service failed. No successful action was recorded.';
  return 'The reward action could not be completed. Refresh the evidence and try again.';
}
