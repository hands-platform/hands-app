import {
  buildMarketplaceOperatingQueueBuckets,
  buildMarketplaceOperatingQueueItems,
} from './marketplace-operating-queue';

describe('marketplace operating queue', () => {
  it('prioritizes expired first-pick, supply gaps, chat repair, and wallet debt lanes', () => {
    const queue = buildMarketplaceOperatingQueueItems({
      cashDebtBookings: ['wallet-1'],
      customerChoiceWaiting: ['choice-1'],
      firstPickExpired: ['expired-1'],
      firstPickWaiting: ['expired-1', 'waiting-1'],
      marketplaceJoined: ['joined-1', 'joined-2'],
      matchedWithoutChat: ['chat-1'],
      noJoinedSupply: ['no-supply-1'],
    });

    expect(queue.map((item) => [item.title, item.status, item.tone, item.href, item.bookings])).toEqual([
      ['First-pick timer control', 'Timer review', 'danger', '/bookings?view=attention', ['expired-1']],
      ['Partner participation pool', 'Supply gap', 'warn', '/bookings?view=no-supply', ['no-supply-1']],
      ['Customer final selection lane', 'Customer decision', 'warn', '/bookings?view=customer-choice', ['choice-1']],
      ['Chat handoff lane', 'Repair needed', 'danger', '/bookings?view=chat-repair', ['chat-1']],
      ['Wallet unblock lane', 'Fee settlement', 'danger', '/cash-settlements', ['wallet-1']],
    ]);
  });

  it('returns clear states when no marketplace operating lane needs attention', () => {
    const queue = buildMarketplaceOperatingQueueItems({
      cashDebtBookings: [],
      customerChoiceWaiting: [],
      firstPickExpired: [],
      firstPickWaiting: [],
      marketplaceJoined: [],
      matchedWithoutChat: [],
      noJoinedSupply: [],
    });

    expect(queue.map((item) => [item.status, item.tone])).toEqual([
      ['Clear', 'ok'],
      ['Clear', 'ok'],
      ['Clear', 'ok'],
      ['Ready', 'ok'],
      ['Clear', 'ok'],
    ]);
  });

  it('groups booking facts into marketplace operating buckets', () => {
    const buckets = buildMarketplaceOperatingQueueBuckets([
      {
        booking: 'first-pick',
        cashDebtNeedsOps: false,
        chatRepairNeedsOps: false,
        hasCustomerSelectablePartner: false,
        hasPreferredPartner: true,
        marketplaceParticipantCount: 1,
        preferredAwaitingDecision: true,
        responseWindowExpired: false,
        status: 'OPEN_MATCHING',
      },
      {
        booking: 'expired',
        cashDebtNeedsOps: false,
        chatRepairNeedsOps: false,
        hasCustomerSelectablePartner: false,
        hasPreferredPartner: true,
        marketplaceParticipantCount: 0,
        preferredAwaitingDecision: true,
        responseWindowExpired: true,
        status: 'OPEN_MATCHING',
      },
      {
        booking: 'choice',
        cashDebtNeedsOps: false,
        chatRepairNeedsOps: false,
        hasCustomerSelectablePartner: true,
        hasPreferredPartner: false,
        marketplaceParticipantCount: 2,
        preferredAwaitingDecision: false,
        responseWindowExpired: false,
        status: 'OPEN_MATCHING',
      },
      {
        booking: 'chat',
        cashDebtNeedsOps: false,
        chatRepairNeedsOps: true,
        hasCustomerSelectablePartner: false,
        hasPreferredPartner: false,
        marketplaceParticipantCount: 0,
        preferredAwaitingDecision: false,
        responseWindowExpired: false,
        status: 'MATCHED',
      },
      {
        booking: 'wallet',
        cashDebtNeedsOps: true,
        chatRepairNeedsOps: false,
        hasCustomerSelectablePartner: false,
        hasPreferredPartner: false,
        marketplaceParticipantCount: 0,
        preferredAwaitingDecision: false,
        responseWindowExpired: false,
        status: 'COMPLETED',
      },
    ]);

    expect(buckets).toEqual({
      cashDebtBookings: ['wallet'],
      customerChoiceWaiting: ['choice'],
      firstPickExpired: ['expired'],
      firstPickWaiting: ['first-pick', 'expired'],
      marketplaceJoined: ['first-pick', 'choice'],
      matchedWithoutChat: ['chat'],
      noJoinedSupply: ['expired'],
    });
  });
});
