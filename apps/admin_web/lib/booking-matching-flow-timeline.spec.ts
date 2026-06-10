import { buildBookingMatchingFlowTimeline } from './booking-matching-flow-timeline';

describe('buildBookingMatchingFlowTimeline', () => {
  it('prioritizes expired first-pick, marketplace supply gaps, fallback choice, and chat repair', () => {
    const timeline = buildBookingMatchingFlowTimeline({
      backupAlerted: ['alerted-a'],
      customerChoice: ['choice-a'],
      firstPickExpired: ['expired-a'],
      firstPickWaiting: ['waiting-a', 'waiting-b'],
      liveHandoff: ['handoff-a'],
      locationChecks: ['location-a'],
      marketplaceVisible: ['market-a'],
      matched: ['matched-a'],
      matchedWithoutChat: ['chat-a'],
      noSupply: ['supply-a', 'supply-b'],
    });

    expect(timeline.map((step) => [step.stage, step.status, step.tone])).toEqual([
      ['Stage 1', 'Timer expired', 'danger'],
      ['Stage 2', 'Supply gap', 'warn'],
      ['Stage 3', 'Needs customer', 'warn'],
      ['Stage 4', 'Repair chat', 'danger'],
    ]);
    expect(timeline[0].bookings).toEqual(['expired-a']);
    expect(timeline[1].metrics).toEqual([
      { label: 'no marketplace', value: '2' },
      { label: 'visible', value: '1' },
      { label: 'alerted', value: '1' },
    ]);
  });

  it('returns clear states when no matching escalation is active', () => {
    const timeline = buildBookingMatchingFlowTimeline({
      backupAlerted: [],
      customerChoice: [],
      firstPickExpired: [],
      firstPickWaiting: [],
      liveHandoff: [],
      locationChecks: [],
      marketplaceVisible: [],
      matched: [],
      matchedWithoutChat: [],
      noSupply: [],
    });

    expect(timeline.map((step) => [step.stage, step.status, step.tone, step.bookings.length])).toEqual([
      ['Stage 1', 'Clear', 'ok', 0],
      ['Stage 2', 'Clear', 'ok', 0],
      ['Stage 3', 'Clear', 'ok', 0],
      ['Stage 4', 'Ready', 'ok', 0],
    ]);
  });
});
