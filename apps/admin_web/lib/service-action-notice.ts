type ServiceActionNoticeMessage = {
  readonly detail: string;
  readonly title: string;
};

export type ServiceActionNotice = ServiceActionNoticeMessage & {
  readonly actionHref?: string;
  readonly actionLabel?: string;
  readonly tone: 'danger' | 'success';
};

type ServiceActionNoticeParams = Record<string, readonly string[] | string | undefined>;

const savedMessages: Record<string, ServiceActionNoticeMessage> = {
  'service-draft-saved': {
    title: 'Draft saved',
    detail: 'The draft is stored for operator review and has not changed the customer or Partner apps.',
  },
  'service-menu-published': {
    title: 'Service group published',
    detail: 'Localization, enabled durations, customer prices, and Partner payouts were published together.',
  },
  'service-menu-hidden': {
    title: 'Service group hidden',
    detail:
      'The group is no longer returned by the public service catalog API. Open its retained draft and publish again to restore it.',
  },
  'service-menu-archived': {
    title: 'Service group archived',
    detail:
      'The group is retained for historical records and removed from public catalog delivery. Review the retained draft and publish again to restore it.',
  },
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
    detail: 'The customer price now has a Partner payout rule for booking and finance checks.',
  },
  'payout-rule-updated': {
    title: 'Payout rule updated',
    detail: 'The payout rule was updated and pricing health has been recalculated.',
  },
  'bulk-payout-rules-saved': {
    title: 'Payout ladder saved',
    detail: 'The service now has the imported customer price and Partner payout rows.',
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
      'Every filled duration must follow the configured price step, and Partner payout cannot exceed the customer price.',
  },
  'invalid-service-pricing': {
    title: 'Service pricing is invalid',
    detail: 'Minimum prices must be positive and match the configured price step, usually 100,000 VND.',
  },
  'missing-payout-fields': {
    title: 'Payout fields are missing',
    detail: 'Enter both the customer price and Partner payout before saving a payout rule.',
  },
  'missing-bulk-payout-fields': {
    title: 'Bulk payout import is empty',
    detail: 'Paste at least one customer price and Partner payout row before importing.',
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
    const group = readSingleParam(params.group);
    return {
      tone: 'success',
      ...(savedMessages[reason] ?? savedMessages['service-updated']),
      ...(group
        ? {
            actionHref: `/audit-log?target=${encodeURIComponent(`service_group:${group}`)}`,
            actionLabel: 'Open audit change set',
          }
        : {}),
    };
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
