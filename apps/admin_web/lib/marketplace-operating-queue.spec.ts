import { buildMarketplaceOperatingQueueItems } from './marketplace-operating-queue';

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
});
