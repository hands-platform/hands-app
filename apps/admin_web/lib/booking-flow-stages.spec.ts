import { bookingFlowStages } from './booking-flow-stages';

const baseInput = {
  createdAtLabel: '07 Jun 2026 10:00',
  openedAtLabel: null,
  hasOpened: false,
  hasPreferredPartner: false,
  partnerDecisionLabel: 'Waiting',
  partnerHint: 'No partner response yet.',
  participantCount: 0,
  bookingStatus: 'CREATED',
  selectedPartnerLabel: 'Not selected',
  hasSelectedPartner: false,
  hasChatRoom: false,
  paymentStatus: 'NONE',
  paymentHint: 'Payment pending.',
};

describe('bookingFlowStages', () => {
  it('returns the five booking timeline stages in order', () => {
    const stages = bookingFlowStages(baseInput);

    expect(stages.map((stage) => stage.label)).toEqual([
      'Created',
      'Opened',
      'Partner reply',
      'Matched',
      'Payment',
    ]);
    expect(stages[0]).toMatchObject({
      value: '07 Jun 2026 10:00',
      hint: 'Customer selected service and address.',
      done: true,
    });
  });

  it('uses direct request copy when a preferred partner exists', () => {
    const stages = bookingFlowStages({
      ...baseInput,
      openedAtLabel: '07 Jun 2026 10:05',
      hasOpened: true,
      hasPreferredPartner: true,
    });

    expect(stages[1]).toMatchObject({
      value: '07 Jun 2026 10:05',
      hint: 'Direct request sent to preferred partner.',
      done: true,
    });
  });

  it('uses open matching copy when no preferred partner exists', () => {
    const stages = bookingFlowStages({
      ...baseInput,
      hasOpened: true,
      openedAtLabel: '07 Jun 2026 10:05',
    });

    expect(stages[1].hint).toBe('Open matching started.');
  });

  it('marks partner reply done when participants exist or booking is matched onward', () => {
    expect(bookingFlowStages({ ...baseInput, participantCount: 1 })[2].done).toBe(true);
    expect(bookingFlowStages({ ...baseInput, bookingStatus: 'MATCHED' })[2].done).toBe(true);
    expect(bookingFlowStages({ ...baseInput, bookingStatus: 'OPEN_MATCHING' })[2].done).toBe(false);
  });

  it('marks matched and payment stages from selected partner, chat, and terminal payment state', () => {
    const stages = bookingFlowStages({
      ...baseInput,
      selectedPartnerLabel: 'Linh Wellness',
      hasSelectedPartner: true,
      hasChatRoom: true,
      paymentStatus: 'CAPTURED',
      paymentHint: 'Payment captured.',
    });

    expect(stages[3]).toMatchObject({
      value: 'Linh Wellness',
      hint: 'Chat room is ready.',
      done: true,
    });
    expect(stages[4]).toMatchObject({
      value: 'CAPTURED',
      hint: 'Payment captured.',
      done: true,
    });
  });
});
