import { buildBookingMatchingEscalationBoard } from './booking-matching-escalation-board';

describe('buildBookingMatchingEscalationBoard', () => {
  it('prioritizes expired first-pick, no marketplace supply, customer choice, and chat repair', () => {
    const lanes = buildBookingMatchingEscalationBoard({
      chatReady: ['chat-ready'],
      customerFinalSelection: ['choice-a'],
      expiredWindow: ['expired-a'],
      firstPickWaiting: ['waiting-a', 'waiting-b'],
      marketplaceReady: ['market-a'],
      matchedWithoutChat: ['chat-missing'],
      noMarketplaceSupply: ['supply-a'],
    });

    expect(lanes.map((lane) => [lane.title, lane.status, lane.tone])).toEqual([
      ['First-pick response window', 'Expired window', 'danger'],
      ['Marketplace participant supply', 'Needs supply', 'warn'],
      ['Customer final selection', 'Customer decision', 'warn'],
      ['Chat handoff after match', 'Repair chat', 'danger'],
    ]);
    expect(lanes[0].bookings).toEqual(['waiting-a', 'waiting-b']);
    expect(lanes[1].bookings).toEqual(['supply-a']);
    expect(lanes[2].metrics).toEqual([
      { label: 'accepted options', value: '1' },
      { label: 'marketplace options', value: '1' },
    ]);
  });

  it('returns clear lanes when matching pressure is absent', () => {
    const lanes = buildBookingMatchingEscalationBoard({
      chatReady: [],
      customerFinalSelection: [],
      expiredWindow: [],
      firstPickWaiting: [],
      marketplaceReady: [],
      matchedWithoutChat: [],
      noMarketplaceSupply: [],
    });

    expect(lanes.map((lane) => [lane.title, lane.status, lane.tone, lane.bookings.length])).toEqual([
      ['First-pick response window', 'Clear', 'ok', 0],
      ['Marketplace participant supply', 'Clear', 'ok', 0],
      ['Customer final selection', 'Clear', 'ok', 0],
      ['Chat handoff after match', 'Clear', 'ok', 0],
    ]);
  });
});
