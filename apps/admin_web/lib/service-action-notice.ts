type ServiceActionNoticeMessage = {
  readonly detail: string;
  readonly title: string;
};

type ServiceActionNotice = ServiceActionNoticeMessage & {
  readonly tone: 'danger' | 'success';
};

type ServiceActionNoticeParams = Record<string, readonly string[] | string | undefined>;

const savedMessages: Record<string, ServiceActionNoticeMessage> = {
  'service-created': {
    title: 'Service option created',
    detail: 'The new service duration option and any base payout rule have been saved.',
  },
  'duration-set-created': {
    title: 'Duration set created',
    detail: 'The service type was created with the valid duration options that passed pricing checks.',
  },
  'service-updated': {
    title: 'Service option updated',
    detail: 'The service duration option was updated and the catalog has been refreshed.',
  },
  'payout-rule-saved': {
    title: 'Payout rule saved',
    detail: 'The customer price now has a partner payout rule for booking and finance checks.',
  },
  'payout-rule-updated': {
    title: 'Payout rule updated',
    detail: 'The payout rule was updated and pricing health has been recalculated.',
  },
  'bulk-payout-rules-saved': {
    title: 'Payout ladder saved',
    detail: 'The service now has the imported customer price and partner payout rows.',
  },
};

const blockedMessages: Record<string, ServiceActionNoticeMessage> = {
  'missing-service-fields': {
    title: 'Required service fields are missing',
    detail: 'Enter a service name, duration, and minimum customer price before saving.',
  },
  'missing-duration-prices': {
    title: 'No duration price was entered',
    detail: 'Enter at least one duration price, such as 60, 90, or 120 minutes, before creating a set.',
  },
  'invalid-duration-set': {
    title: 'Duration set pricing is invalid',
    detail:
      'Every filled duration must follow the configured price step, and partner payout cannot exceed the customer price.',
  },
  'invalid-service-pricing': {
    title: 'Service pricing is invalid',
    detail: 'Minimum prices must be positive and match the configured price step, usually 100,000 VND.',
  },
  'missing-payout-fields': {
    title: 'Payout fields are missing',
    detail: 'Enter both the customer price and partner payout before saving a payout rule.',
  },
  'missing-bulk-payout-fields': {
    title: 'Bulk payout import is empty',
    detail: 'Paste at least one customer price and partner payout row before importing.',
  },
  'invalid-bulk-payout': {
    title: 'Bulk payout import is invalid',
    detail:
      'Each row must be customerPrice,providerPayoutAmount. Partner payout cannot exceed the customer price.',
  },
  'invalid-payout': {
    title: 'Partner payout is too high',
    detail: 'Partner payout cannot be greater than the customer price for the same service option.',
  },
  'api-rejected': {
    title: 'API rejected the service update',
    detail:
      'The backend did not save this change. Recheck the price step, payout rule, duplicate service values, or API connection.',
  },
};

export function serviceActionNotice(params: ServiceActionNoticeParams): ServiceActionNotice | null {
  const status = readSingleParam(params.status);
  const reason = readSingleParam(params.reason);
  if (!status || !reason) {
    return null;
  }

  if (status === 'saved') {
    return { tone: 'success', ...(savedMessages[reason] ?? savedMessages['service-updated']) };
  }
  if (status === 'blocked') {
    return {
      tone: 'danger',
      ...(blockedMessages[reason] ?? {
        title: 'Service action blocked',
        detail: 'Review the service pricing and payout values, then try again.',
      }),
    };
  }
  return null;
}

function readSingleParam(value: readonly string[] | string | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
