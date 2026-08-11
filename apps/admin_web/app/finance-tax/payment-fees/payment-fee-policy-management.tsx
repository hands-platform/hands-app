import {
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormDateTime,
  AdminFormGrid,
  AdminFormInput,
  AdminFormSelect,
  AdminFormTextarea,
} from '../../../components/admin-form-controls';
import { ConfirmDialog } from '../../../components/confirm-dialog';
import { AdminNoticeCard, AdminSection } from '../../../components/admin-surface';
import { DateTimeText } from '../../../components/date-time-text';
import { MoneyText } from '../../../components/money-text';
import { StatusBadge, StatusBadgeLink } from '../../../components/status-badge';
import type {
  AdminPaymentFeePolicyPreflight,
  AdminPaymentFeePolicyApproval,
  AdminPaymentFeePolicyVersion,
  AdminPaymentMethod,
  AdminOperatorAccess,
} from '../../../lib/admin-api';
import { FinanceDataTable } from '../finance-data-table';
import {
  activatePaymentFeePolicy,
  cancelPaymentFeePolicyApproval,
  createPaymentFeePolicyDraft,
  rejectPaymentFeePolicyApproval,
  requestPaymentFeePolicyApproval,
  updatePaymentFeePolicyDraft,
  upsertPaymentFeePolicyRule,
} from './actions';

const paymentMethods: AdminPaymentMethod[] = [
  'MOMO',
  'VNPAY',
  'CASH',
  'CARD',
  'BANK_TRANSFER',
  'CUSTOMER_WALLET',
  'MANUAL',
];

type PaymentFeePolicyManagementProps = {
  readonly approval: AdminPaymentFeePolicyApproval | null;
  readonly confirmationAction?: string | null;
  readonly currentOperator: AdminOperatorAccess | null;
  readonly notice?: string | null;
  readonly policies: readonly AdminPaymentFeePolicyVersion[];
  readonly preflight: AdminPaymentFeePolicyPreflight | null;
  readonly returnTo: string;
  readonly selectedMethod?: string | null;
  readonly selectedPolicyId?: string | null;
};

export function PaymentFeePolicyManagement({
  approval,
  confirmationAction,
  currentOperator,
  notice,
  policies,
  preflight,
  returnTo,
  selectedMethod,
  selectedPolicyId,
}: PaymentFeePolicyManagementProps) {
  const drafts = policies.filter((policy) => policy.status === 'DRAFT');
  const selectedPolicy =
    drafts.find((policy) => policy.id === selectedPolicyId) ?? drafts[0] ?? null;
  const missingMethods = selectedPolicy ? policyMissingMethods(selectedPolicy) : paymentMethods;
  const method = paymentMethods.includes(selectedMethod as AdminPaymentMethod)
    ? (selectedMethod as AdminPaymentMethod)
    : (missingMethods[0] ?? 'CARD');
  const rule = selectedPolicy ? activeRuleForMethod(selectedPolicy, method) : null;
  const policyReturnTo = selectedPolicy ? withPolicySelection(returnTo, selectedPolicy.id, method) : returnTo;
  const noticeContent = paymentFeePolicyNotice(notice);
  const preflightRules = new Map(preflight?.rules.map((item) => [item.method, item]) ?? []);
  const approvalRequested = approval?.status === 'REQUESTED';
  const approvalClosed = approval?.status === 'REJECTED' || approval?.status === 'CANCELLED';
  const canApprove = Boolean(
    approvalRequested &&
    currentOperator?.roles.includes('FINANCE_APPROVER') &&
    currentOperator.id !== approval?.requestedBy?.id,
  );
  const canCancel = Boolean(
    approvalRequested &&
    currentOperator?.id === approval?.requestedBy?.id,
  );
  const requestedConfirmationAction = Boolean(confirmationAction);
  const confirmation = selectedPolicy
    ? paymentFeePolicyConfirmation({
        action: confirmationAction,
        approvalAdminId: currentOperator?.id ?? null,
        canApprove,
        canCancel,
        policyId: selectedPolicy.id,
        policyName: selectedPolicy.name,
        readyForActivation: Boolean(preflight?.readyForActivation),
        returnTo: policyReturnTo,
      })
    : null;

  return (
    <>
      {noticeContent ? (
        <AdminNoticeCard className="admin-mb-16" role="status" tone={noticeContent.tone}>
          <div>
            <h2>{noticeContent.title}</h2>
            <p className="muted">{noticeContent.detail}</p>
          </div>
          <StatusBadge tone={noticeContent.tone}>{noticeContent.badge}</StatusBadge>
        </AdminNoticeCard>
      ) : null}

      {confirmation ? (
        <ConfirmDialog
          action={confirmation.action}
          cancelHref={policyReturnTo}
          confirmLabel={confirmation.confirmLabel}
          description={confirmation.description}
          hiddenInputs={confirmation.hiddenInputs}
          id={`payment-fee-policy-${confirmation.actionName}-${selectedPolicy?.id ?? 'missing'}`}
          textInputs={confirmation.textInputs}
          title={confirmation.title}
          tone={confirmation.tone}
        />
      ) : requestedConfirmationAction ? (
        <AdminNoticeCard className="admin-mb-16" role="alert" tone="danger">
          <div>
            <h2>Policy action is no longer available</h2>
            <p className="muted">Refresh the draft and its approval state before continuing. No settlement policy was changed.</p>
          </div>
          <StatusBadge tone="danger">Blocked</StatusBadge>
        </AdminNoticeCard>
      ) : null}

      <AdminSection
        className="admin-mb-16"
        description="Create a versioned draft. Draft values never affect booking settlement until a different Finance Approver activates the complete policy."
        statusLabel={`${drafts.length} draft(s)`}
        statusTone={drafts.length ? 'warning' : 'neutral'}
        title="Payment fee policy drafts"
      >
        <AdminFormGrid action={createPaymentFeePolicyDraft}>
          <input name="returnTo" type="hidden" value={returnTo} />
          <AdminFormInput label="Policy name" labelVisibility="visible" name="name" required />
          <AdminFormDateTime
            defaultValue={new Date().toISOString()}
            label="Effective from"
            labelVisibility="visible"
            name="effectiveFrom"
            required
          />
          <AdminFormDateTime
            label="Effective to"
            labelVisibility="visible"
            name="effectiveTo"
          />
          <AdminFormTextarea
            className="full-span"
            label="Contract and pricing evidence"
            labelVisibility="visible"
            name="notes"
            placeholder="Contract reference, pricing schedule, payment provider evidence, and review context"
            rows={2}
          />
          <AdminFormTextarea
            className="full-span"
            label="Draft reason"
            labelVisibility="visible"
            minLength={12}
            name="reason"
            placeholder="Why this policy draft is required"
            required
            rows={2}
          />
          <AdminFormControlButton className="button-primary" type="submit">
            Create draft
          </AdminFormControlButton>
        </AdminFormGrid>
      </AdminSection>

      {selectedPolicy ? (
        <AdminSection
          className="admin-mb-16"
          description="Only this DRAFT version can be edited. ACTIVE and INACTIVE versions remain immutable evidence."
          statusLabel={preflight
            ? `${preflight.coverage.configuredMethods}/${preflight.coverage.requiredMethods} rules ready`
            : `${paymentMethods.length - missingMethods.length}/${paymentMethods.length} rules ready`}
          statusTone={preflight?.readyForActivation ? 'success' : 'warning'}
          title="Draft policy editor"
        >
          <div className="admin-status-filter-row admin-mb-16" aria-label="Payment fee policy drafts">
            {drafts.map((policy) => (
              <StatusBadgeLink
                href={withPolicySelection(returnTo, policy.id, method)}
                key={policy.id}
                tone={policy.id === selectedPolicy.id ? 'primary' : 'neutral'}
              >
                {policy.name}
              </StatusBadgeLink>
            ))}
          </div>

          <AdminFormGrid action={updatePaymentFeePolicyDraft}>
            <input name="policyId" type="hidden" value={selectedPolicy.id} />
            <input name="returnTo" type="hidden" value={policyReturnTo} />
            <AdminFormInput
              defaultValue={selectedPolicy.name}
              label="Policy name"
              labelVisibility="visible"
              name="name"
              required
            />
            <AdminFormDateTime
              defaultValue={selectedPolicy.effectiveFrom}
              label="Effective from"
              labelVisibility="visible"
              name="effectiveFrom"
              required
            />
            <AdminFormDateTime
              defaultValue={selectedPolicy.effectiveTo ?? ''}
              label="Effective to"
              labelVisibility="visible"
              name="effectiveTo"
            />
            <AdminFormTextarea
              className="full-span"
              defaultValue={selectedPolicy.notes ?? ''}
              label="Contract and pricing evidence"
              labelVisibility="visible"
              name="notes"
              placeholder="Contract reference, pricing schedule, payment provider evidence, and review context"
              rows={2}
            />
            <AdminFormTextarea
              className="full-span"
              label="Update reason"
              labelVisibility="visible"
              minLength={12}
              name="reason"
              placeholder="Why these draft details are changing"
              required
              rows={2}
            />
            <AdminFormControlButton className="button-secondary" type="submit">
              Save draft details
            </AdminFormControlButton>
          </AdminFormGrid>

          <div className="admin-mt-16">
            <FinanceDataTable
              emptyMessage="No payment fee methods are configured."
              headers={['Method', 'Fee rule', 'Rate', 'Fixed amount', 'Fee at 100,000 VND', 'Payer', 'Treatment', 'Edit']}
              rowCount={paymentMethods.length}
            >
              {paymentMethods.map((paymentMethod) => {
                const methodRule = activeRuleForMethod(selectedPolicy, paymentMethod);
                const methodPreflight = preflightRules.get(paymentMethod);
                return (
                  <tr key={paymentMethod}>
                    <td><strong>{paymentMethod}</strong></td>
                    <td>{methodRule?.feeType ?? 'Missing'}</td>
                    <td>{methodRule ? `${formatBasisPoints(methodRule.rateBps)}%` : 'Not set'}</td>
                    <td>
                      {methodRule ? <MoneyText amount={methodRule.fixedAmount} currency="VND" /> : 'Not set'}
                    </td>
                    <td>
                      {methodPreflight?.estimatedFeeAmount === null || methodPreflight?.estimatedFeeAmount === undefined
                        ? <StatusBadge tone={methodPreflight?.status === 'INVALID' ? 'danger' : 'warning'}>{methodPreflight?.status ?? 'Unavailable'}</StatusBadge>
                        : <MoneyText amount={methodPreflight.estimatedFeeAmount} currency={preflight?.currency ?? 'VND'} />}
                    </td>
                    <td>{methodRule?.payer ?? 'Not set'}</td>
                    <td>{methodRule?.treatment ?? 'Not set'}</td>
                    <td>
                      <StatusBadgeLink
                        href={withPolicySelection(returnTo, selectedPolicy.id, paymentMethod)}
                        tone={methodRule ? 'info' : 'warning'}
                      >
                        {methodRule ? 'Edit rule' : 'Add rule'}
                      </StatusBadgeLink>
                    </td>
                  </tr>
                );
              })}
            </FinanceDataTable>
          </div>

          <AdminFormGrid action={upsertPaymentFeePolicyRule} className="admin-mt-16">
            <input name="policyId" type="hidden" value={selectedPolicy.id} />
            <input name="returnTo" type="hidden" value={policyReturnTo} />
            <AdminFormSelect
              defaultValue={method}
              label="Payment method"
              labelVisibility="visible"
              name="method"
              options={paymentMethods.map((paymentMethod) => ({ label: paymentMethod, value: paymentMethod }))}
            />
            <AdminFormSelect
              defaultValue={rule?.feeType ?? 'RATE'}
              label="Fee calculation"
              labelVisibility="visible"
              name="feeType"
              options={[
                { label: 'Rate', value: 'RATE' },
                { label: 'Fixed amount', value: 'FIXED' },
                { label: 'Rate + fixed', value: 'RATE_PLUS_FIXED' },
              ]}
            />
            <AdminFormTextarea
              className="full-span"
              label="Rule change reason"
              labelVisibility="visible"
              minLength={12}
              name="reason"
              placeholder={`Why the ${method} fee rule is changing`}
              required
              rows={2}
            />
            <AdminFormInput
              defaultValue={rule?.rateBps ?? 0}
              label="Rate (basis points)"
              labelVisibility="visible"
              max={10000}
              min={0}
              name="rateBps"
              required
              step={1}
              type="number"
            />
            <AdminFormInput
              defaultValue={rule?.fixedAmount ?? 0}
              label="Fixed amount (VND)"
              labelVisibility="visible"
              min={0}
              name="fixedAmount"
              required
              step={1}
              type="number"
            />
            <AdminFormSelect
              defaultValue={rule?.payer ?? 'HANDS'}
              label="Fee payer"
              labelVisibility="visible"
              name="payer"
              options={[
                { label: 'HANDS', value: 'HANDS' },
                { label: 'Customer', value: 'CUSTOMER' },
                { label: 'Partner', value: 'PARTNER' },
                { label: 'Shared', value: 'SHARED' },
              ]}
            />
            <AdminFormSelect
              defaultValue={rule?.treatment ?? 'OPERATING_EXPENSE'}
              label="Accounting treatment"
              labelVisibility="visible"
              name="treatment"
              options={[
                { label: 'Operating expense', value: 'OPERATING_EXPENSE' },
                { label: 'Pass through', value: 'PASS_THROUGH' },
                { label: 'Manual review', value: 'MANUAL_REVIEW' },
              ]}
            />
            <AdminFormControlButton className="button-primary" type="submit">
              Save {method} rule
            </AdminFormControlButton>
          </AdminFormGrid>

          {approvalClosed ? (
            <div className="admin-table-substack admin-mt-16" role="status">
              <StatusBadge tone={approval?.status === 'REJECTED' ? 'danger' : 'neutral'}>
                {approval?.status === 'REJECTED' ? 'Approval rejected' : 'Approval cancelled'}
              </StatusBadge>
              <span className="muted">
                {approval?.decidedBy?.fullName ?? approval?.decidedBy?.email ?? approval?.decidedBy?.id ?? 'Unknown operator'}
                {approval?.decisionAt ? <> on <DateTimeText value={approval.decisionAt} /></> : null}
                {approval?.reason ? <>: {approval.reason}</> : null}
              </span>
            </div>
          ) : null}

          {!approvalRequested ? (
            <div className="actions admin-mt-16">
              {preflight?.readyForActivation ? (
                <AdminFormControlLink
                  className="button-primary"
                  href={withPolicyConfirmation(policyReturnTo, 'request-approval')}
                >
                  Review approval request
                </AdminFormControlLink>
              ) : (
                <AdminFormControlButton className="button-primary" disabled type="button">
                  Request Finance approval
                </AdminFormControlButton>
              )}
            </div>
          ) : null}

          {approvalRequested ? (
            <div className="admin-table-substack admin-mt-16" role="status">
              <StatusBadge tone="warning">Approval requested</StatusBadge>
              <span className="muted">
                Requested by {approval?.requestedBy?.fullName ?? approval?.requestedBy?.email ?? approval?.requestedBy?.id ?? 'Unknown operator'}{approval?.requestedAt ? <> on <DateTimeText value={approval.requestedAt} /></> : null}.
              </span>
            </div>
          ) : null}

          {canApprove && currentOperator ? (
            <div className="actions admin-mt-16">
              {preflight?.readyForActivation ? (
                <AdminFormControlLink
                  className="button-primary"
                  href={withPolicyConfirmation(policyReturnTo, 'activate')}
                >
                  Review activation
                </AdminFormControlLink>
              ) : (
                <AdminFormControlButton className="button-primary" disabled type="button">
                  Approve and activate policy
                </AdminFormControlButton>
              )}
              <AdminFormControlLink
                className="button-danger"
                href={withPolicyConfirmation(policyReturnTo, 'reject')}
              >
                Review rejection
              </AdminFormControlLink>
            </div>
          ) : canCancel ? (
            <div className="actions admin-mt-16">
              <AdminFormControlLink
                className="button-secondary"
                href={withPolicyConfirmation(policyReturnTo, 'cancel')}
              >
                Review cancellation
              </AdminFormControlLink>
            </div>
          ) : approvalRequested ? (
            <p className="muted admin-mt-16">
              A different signed-in Finance Approver must review and activate this policy.
            </p>
          ) : null}
          <div className="admin-table-substack admin-mt-16" role="status">
            <StatusBadge tone={preflight?.readyForActivation ? 'success' : 'warning'}>
              {preflight?.readyForActivation
                ? 'Activation preflight ready'
                : `${preflight?.blockers.length ?? 1} activation blocker(s)`}
            </StatusBadge>
            {preflight?.readyForActivation ? (
              <span className="muted">
                All seven methods, rule values, and the effective window passed the server preflight. Separate approval is still required.
              </span>
            ) : (
              <span className="muted">
                {preflight?.blockers.map((blocker) => blocker.message).join(' ') ??
                  'Server preflight is unavailable. Refresh before attempting activation.'}
              </span>
            )}
          </div>
        </AdminSection>
      ) : null}

      <AdminSection
        description="Version history is immutable after activation. Corrections require a new DRAFT version."
        statusLabel={`${policies.length} version(s)`}
        statusTone="info"
        title="Payment fee policy history"
      >
        <FinanceDataTable
          emptyMessage="No payment fee policy versions exist. Create a draft to begin governed setup."
          headers={['Policy', 'Status', 'Effective window', 'Rule coverage', 'Created by', 'Updated']}
          rowCount={policies.length}
        >
          {policies.map((policy) => {
            const missing = policyMissingMethods(policy);
            return (
              <tr key={policy.id}>
                <td>
                  <strong>{policy.name}</strong>
                  <br />
                  <span className="muted">{policy.id}</span>
                </td>
                <td><StatusBadge tone={policyStatusTone(policy.status)}>{policy.status}</StatusBadge></td>
                <td>
                  <DateTimeText value={policy.effectiveFrom} />
                  <br />
                  <span className="muted">to <DateTimeText fallback="Open ended" value={policy.effectiveTo} /></span>
                </td>
                <td>
                  {paymentMethods.length - missing.length}/{paymentMethods.length}
                  {missing.length ? <p className="muted">Missing: {missing.join(', ')}</p> : null}
                </td>
                <td>{policy.createdBy?.fullName ?? policy.createdBy?.email ?? policy.createdById ?? 'Unknown'}</td>
                <td><DateTimeText value={policy.updatedAt} /></td>
              </tr>
            );
          })}
        </FinanceDataTable>
      </AdminSection>
    </>
  );
}

function activeRuleForMethod(policy: AdminPaymentFeePolicyVersion, method: AdminPaymentMethod) {
  return policy.rules.find((rule) => rule.active && rule.method === method) ?? null;
}

function policyMissingMethods(policy: AdminPaymentFeePolicyVersion) {
  return paymentMethods.filter((method) => !activeRuleForMethod(policy, method));
}

function formatBasisPoints(rateBps: number) {
  return (rateBps / 100).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function withPolicySelection(returnTo: string, policyId: string, method: AdminPaymentMethod) {
  const url = new URL(returnTo, 'http://admin.local');
  url.searchParams.set('policyId', policyId);
  url.searchParams.set('method', method);
  url.searchParams.delete('policyNotice');
  return `${url.pathname}${url.search}`;
}

function withPolicyConfirmation(returnTo: string, action: string) {
  const url = new URL(returnTo, 'http://admin.local');
  url.searchParams.delete('policyNotice');
  url.searchParams.set('confirm', action);
  return `${url.pathname}${url.search}`;
}

function paymentFeePolicyConfirmation(input: {
  readonly action?: string | null;
  readonly approvalAdminId: string | null;
  readonly canApprove: boolean;
  readonly canCancel: boolean;
  readonly policyId: string;
  readonly policyName: string;
  readonly readyForActivation: boolean;
  readonly returnTo: string;
}) {
  const hiddenInputs = [
    { name: 'policyId', value: input.policyId },
    { name: 'confirmationPolicyId', value: input.policyId },
    { name: 'returnTo', value: input.returnTo },
  ];
  const reasonInput = (label: string, placeholder: string) => [{
    label,
    minLength: 12,
    name: 'reason',
    placeholder,
    required: true,
  }];

  if (input.action === 'request-approval' && input.readyForActivation) {
    return {
      action: requestPaymentFeePolicyApproval,
      actionName: 'request-approval',
      confirmLabel: 'Request Finance approval',
      description: <>
        Send <strong>{input.policyName}</strong> for independent Finance approval. The draft remains inactive and does not change any booking settlement.
      </>,
      hiddenInputs,
      textInputs: reasonInput('Approval request evidence', 'Identify the contract revision and checks completed before approval'),
      title: 'Confirm approval request',
      tone: 'warning' as const,
    };
  }
  if (input.action === 'activate' && input.canApprove && input.approvalAdminId && input.readyForActivation) {
    return {
      action: activatePaymentFeePolicy,
      actionName: 'activate',
      confirmLabel: 'Approve and activate policy',
      description: <>
        Activate <strong>{input.policyName}</strong> for future booking settlements. Payment method, payer, and accounting treatment rules will apply prospectively; existing settlement snapshots are not rewritten.
      </>,
      hiddenInputs: [...hiddenInputs, { name: 'approvalAdminId', value: input.approvalAdminId }],
      textInputs: reasonInput('Approval decision evidence', 'Confirm independent review of the contract, rates, payer, and accounting treatment'),
      title: 'Confirm policy activation',
      tone: 'danger' as const,
    };
  }
  if (input.action === 'reject' && input.canApprove) {
    return {
      action: rejectPaymentFeePolicyApproval,
      actionName: 'reject',
      confirmLabel: 'Reject approval request',
      description: <>
        Reject the approval request for <strong>{input.policyName}</strong>. The policy stays inactive and the draft must be corrected before another review.
      </>,
      hiddenInputs,
      textInputs: reasonInput('Rejection reason', 'Identify the contract, fee, payer, or accounting issue that must be corrected'),
      title: 'Confirm policy rejection',
      tone: 'danger' as const,
    };
  }
  if (input.action === 'cancel' && input.canCancel) {
    return {
      action: cancelPaymentFeePolicyApproval,
      actionName: 'cancel',
      confirmLabel: 'Cancel approval request',
      description: <>
        Withdraw the pending review for <strong>{input.policyName}</strong>. The policy stays inactive and the draft remains available for correction.
      </>,
      hiddenInputs,
      textInputs: reasonInput('Cancellation reason', 'Explain why this approval request is being withdrawn'),
      title: 'Confirm approval cancellation',
      tone: 'warning' as const,
    };
  }
  return null;
}

function policyStatusTone(status: AdminPaymentFeePolicyVersion['status']) {
  if (status === 'ACTIVE') return 'success' as const;
  if (status === 'DRAFT') return 'warning' as const;
  return 'neutral' as const;
}

function paymentFeePolicyNotice(value?: string | null) {
  if (value === 'created') return { badge: 'Draft', detail: 'The policy exists only as a draft and is not used by settlement.', title: 'Draft created', tone: 'success' as const };
  if (value === 'updated') return { badge: 'Saved', detail: 'Draft metadata was saved without changing settlement behavior.', title: 'Draft updated', tone: 'success' as const };
  if (value === 'rule-saved') return { badge: 'Rule saved', detail: 'The payment method rule was saved to this draft.', title: 'Draft rule updated', tone: 'success' as const };
  if (value === 'approval-requested') return { badge: 'Waiting', detail: 'A different signed-in Finance Approver must review this exact draft revision.', title: 'Approval requested', tone: 'success' as const };
  if (value === 'approval-request-failed') return { badge: 'Not requested', detail: 'The draft must pass preflight and cannot already have a request for the same revision.', title: 'Approval request failed', tone: 'danger' as const };
  if (value === 'approval-rejected') return { badge: 'Rejected', detail: 'The request was rejected with Finance Approver evidence. Correct the draft before requesting review again.', title: 'Approval rejected', tone: 'danger' as const };
  if (value === 'approval-reject-failed') return { badge: 'Not rejected', detail: 'Only a different signed-in Finance Approver can reject the current request.', title: 'Approval rejection failed', tone: 'danger' as const };
  if (value === 'approval-cancelled') return { badge: 'Cancelled', detail: 'The requesting operator withdrew the pending review. The draft remains editable.', title: 'Approval request cancelled', tone: 'info' as const };
  if (value === 'approval-cancel-failed') return { badge: 'Not cancelled', detail: 'Only the operator who created the current request can cancel it.', title: 'Approval cancellation failed', tone: 'danger' as const };
  if (value === 'activated') return { badge: 'Active', detail: 'The complete policy was activated with separate Finance Approver evidence.', title: 'Policy activated', tone: 'success' as const };
  if (value === 'confirmation-required') return { badge: 'Blocked', detail: 'Open the current policy action review and provide at least 12 characters of decision evidence. No policy state changed.', title: 'Policy confirmation required', tone: 'danger' as const };
  if (value === 'validation') return { badge: 'Check form', detail: 'Required values, dates, or fee calculation fields are invalid.', title: 'Policy was not saved', tone: 'danger' as const };
  if (value === 'activation-failed') return { badge: 'Not active', detail: 'Activation requires all seven method rules and approval by a different Finance Approver.', title: 'Policy activation failed', tone: 'danger' as const };
  if (value === 'failed') return { badge: 'Not saved', detail: 'The API rejected the change. Refresh policy state and verify your write permission.', title: 'Policy change failed', tone: 'danger' as const };
  return null;
}
