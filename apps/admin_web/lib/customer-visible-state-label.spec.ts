import {
  customerVisibleStateLabelFromFacts,
  type CustomerVisibleStateLabelInput,
} from './customer-visible-state-label';

const baseInput: CustomerVisibleStateLabelInput = {
  customerSelectablePartnerCount: 0,
  hasChatRoom: false,
  hasPreferredPartner: false,
  marketplacePartnerCount: 0,
  preferredAwaitingDecision: false,
  selectedPartnerLabel: null,
  status: 'OPEN_MATCHING',
};

describe('customerVisibleStateLabelFromFacts', () => {
  it.each(['CANCELLED', 'EXPIRED', 'REFUNDED', 'COMPLETED', 'NO_SHOW'])(
    'returns closed customer copy for terminal status %s',
    (status) => {
      expect(customerVisibleStateLabelFromFacts({ ...baseInput, status })).toBe(
        `Customer screen: closed as ${status}`,
      );
    },
  );

  it('returns final partner copy with chat readiness', () => {
    expect(
      customerVisibleStateLabelFromFacts({
        ...baseInput,
        hasChatRoom: true,
        selectedPartnerLabel: 'Linh Tran',
        status: 'MATCHED',
      }),
    ).toBe('Customer screen: final partner Linh Tran with chat ready');
  });

  it('returns final partner copy when chat is not ready', () => {
    expect(
      customerVisibleStateLabelFromFacts({
        ...baseInput,
        selectedPartnerLabel: 'Linh Tran',
        status: 'MATCHED',
      }),
    ).toBe('Customer screen: final partner Linh Tran but chat not ready');
  });

  it('returns customer final choice copy when participants are selectable', () => {
    expect(
      customerVisibleStateLabelFromFacts({
        ...baseInput,
        customerSelectablePartnerCount: 2,
      }),
    ).toBe('Customer screen: 2 participating/accepted partner(s) ready for final choice');
  });

  it('returns first-pick plus marketplace copy while both paths are visible', () => {
    expect(
      customerVisibleStateLabelFromFacts({
        ...baseInput,
        hasPreferredPartner: true,
        marketplacePartnerCount: 3,
        preferredAwaitingDecision: true,
      }),
    ).toBe('Customer screen: first-pick wait plus 3 marketplace option(s)');
  });

  it('returns first-pick only copy when no marketplace partner has joined yet', () => {
    expect(
      customerVisibleStateLabelFromFacts({
        ...baseInput,
        hasPreferredPartner: true,
        preferredAwaitingDecision: true,
      }),
    ).toBe('Customer screen: first-pick waiting only');
  });

  it('returns open marketplace waiting copy', () => {
    expect(customerVisibleStateLabelFromFacts({ ...baseInput, marketplacePartnerCount: 4 })).toBe(
      'Customer screen: 4 partner option(s) waiting',
    );
  });

  it('humanizes fallback statuses', () => {
    expect(customerVisibleStateLabelFromFacts({ ...baseInput, status: 'PROVIDER_ON_THE_WAY' })).toBe(
      'Customer screen: provider on the way',
    );
  });
});
