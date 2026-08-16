export type TaxPolicyNotice = {
  readonly tone: 'success' | 'danger';
  readonly title: string;
  readonly detail: string;
  readonly badge: string;
};

export function taxPolicyNotice(params: Record<string, string | string[] | undefined>): TaxPolicyNotice | null {
  const notice = firstParam(params.taxPolicyNotice);
  const message = firstParam(params.message);
  const code = firstParam(params.code);

  if (notice === 'validation') {
    return {
      badge: 'Blocked',
      detail: message || 'Check the policy effective dates and try again.',
      title: 'Tax policy update blocked',
      tone: 'danger',
    };
  }

  if (notice === 'api-error') {
    return {
      badge: code || 'Request failed',
      detail: message || 'Reload current tax policy data before retrying.',
      title: 'Tax policy action was not applied',
      tone: 'danger',
    };
  }

  const success: Record<string, { title: string; detail: string }> = {
    'draft-created': {
      title: 'Draft policy created',
      detail: 'The draft and its optional default rule were saved in one transaction.',
    },
    'draft-saved': {
      title: 'Draft policy saved',
      detail: 'Only the editable draft changed. Approved and referenced versions remain immutable.',
    },
    'rule-created': {
      title: 'Draft rule created',
      detail: 'The rule is part of the draft and is not active until checker approval and activation.',
    },
    'rule-saved': {
      title: 'Draft rule saved',
      detail: 'The current draft rule was updated.',
    },
    'approval-requested': {
      title: 'Approval requested',
      detail: 'A different verified Finance approver must now review the immutable payload.',
    },
    'approval-approved': {
      title: 'Approval recorded',
      detail: 'The policy is scheduled for its Vietnam effective time. The current policy remains active until then.',
    },
    'approval-rejected': {
      title: 'Approval rejected',
      detail: 'The rejected version was not activated.',
    },
  };
  if (notice && success[notice]) {
    return {
      badge: 'Recorded',
      ...success[notice],
      tone: 'success',
    };
  }

  return null;
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
