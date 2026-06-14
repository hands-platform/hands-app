export type CustomerVisibleStateLabelInput = {
  readonly customerSelectablePartnerCount: number;
  readonly hasChatRoom: boolean;
  readonly hasPreferredPartner: boolean;
  readonly marketplacePartnerCount: number;
  readonly preferredAwaitingDecision: boolean;
  readonly selectedPartnerLabel: string | null;
  readonly status: string;
};

const closedStatuses = ['CANCELLED', 'EXPIRED', 'REFUNDED', 'COMPLETED', 'NO_SHOW'] as const;

export function customerVisibleStateLabelFromFacts(input: CustomerVisibleStateLabelInput) {
  if (closedStatuses.some((status) => status === input.status)) {
    return `Customer screen: closed as ${input.status}`;
  }
  if (input.selectedPartnerLabel) {
    return `Customer screen: final Partner ${input.selectedPartnerLabel}${
      input.hasChatRoom ? ' with chat ready' : ' but chat not ready'
    }`;
  }
  if (input.customerSelectablePartnerCount > 0) {
    return `Customer screen: ${input.customerSelectablePartnerCount} participating/accepted Partner(s) ready for final choice`;
  }
  if (
    input.status === 'OPEN_MATCHING' &&
    input.hasPreferredPartner &&
    input.preferredAwaitingDecision
  ) {
    return input.marketplacePartnerCount > 0
      ? `Customer screen: first-pick wait plus ${input.marketplacePartnerCount} marketplace option(s)`
      : 'Customer screen: first-pick waiting only';
  }
  if (input.status === 'OPEN_MATCHING') {
    return input.marketplacePartnerCount > 0
      ? `Customer screen: ${input.marketplacePartnerCount} Partner option(s) waiting`
      : 'Customer screen: waiting for Partners';
  }
  return `Customer screen: ${input.status.toLowerCase().replaceAll('_', ' ').replaceAll('provider', 'Partner')}`;
}
