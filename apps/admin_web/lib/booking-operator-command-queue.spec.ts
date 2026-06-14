import { bookingOperatorCommandQueue } from './booking-operator-command-queue';

const baseInput = {
  bookingStatus: 'CREATED',
  participantCount: 0,
  customerChoiceCandidateCount: 0,
  partnerLabel: 'No final Partner',
  hasFinalPartner: false,
  hasChatRoom: false,
  messageCount: 0,
  hasLatestLocation: false,
  latestLocationFreshness: 'missing',
  providerLocationHelper: 'No Partner location yet.',
  paymentStatus: 'NONE',
  cashDebtNeedsSettlement: false,
  closeoutAvailable: false,
  canExpire: false,
  canMarkNoShow: false,
  attentionFlagCount: 0,
  pendingTask: null,
};

describe('bookingOperatorCommandQueue', () => {
  it('adds matching and supply commands for open matching with no participants', () => {
    const queue = bookingOperatorCommandQueue({
      ...baseInput,
      bookingStatus: 'OPEN_MATCHING',
      canExpire: true,
      canMarkNoShow: true,
    });

    expect(queue.commands.map((command) => command.id)).toEqual([
      'matching-watch',
      'partner-supply',
      'expire-matching',
      'no-show-option',
    ]);
    expect(queue.status).toBe('2 action(s)');
    expect(queue.tone).toBe('pill-warn');
    expect(queue.commands.find((command) => command.id === 'partner-supply')?.action).toMatchObject({
      type: 'link',
      href: '#marketplace-supply',
    });
  });

  it('separates participant evidence rows from customer-selectable partners', () => {
    const queue = bookingOperatorCommandQueue({
      ...baseInput,
      bookingStatus: 'OPEN_MATCHING',
      participantCount: 1,
      customerChoiceCandidateCount: 0,
    });

    expect(queue.commands.find((command) => command.id === 'matching-watch')?.detail).toContain(
      '0 customer-selectable partner(s)',
    );
    expect(queue.commands.find((command) => command.id === 'matching-watch')?.detail).toContain(
      '1 participant row(s)',
    );
  });

  it('adds a choice readiness command when participant rows are not customer-selectable', () => {
    const queue = bookingOperatorCommandQueue({
      ...baseInput,
      bookingStatus: 'OPEN_MATCHING',
      participantCount: 2,
      customerChoiceCandidateCount: 0,
    });

    expect(queue.commands.map((command) => command.id)).toContain('customer-choice-empty');
    expect(queue.commands.find((command) => command.id === 'customer-choice-empty')).toMatchObject({
      title: 'Check customer choice readiness',
      action: { type: 'link', href: '#participants' },
    });
  });

  it('adds chat repair and location request commands for active bookings missing both records', () => {
    const queue = bookingOperatorCommandQueue({
      ...baseInput,
      bookingStatus: 'MATCHED',
      hasFinalPartner: true,
      partnerLabel: 'Linh Wellness',
      canMarkNoShow: true,
    });

    expect(queue.commands.map((command) => command.id)).toEqual([
      'chat-repair',
      'location-request',
      'no-show-option',
    ]);
    expect(queue.labels[1]).toMatchObject({
      label: 'Partner',
      value: 'Linh Wellness',
      helper: 'Preferred/final partner context.',
    });
  });

  it('adds a first-contact watch when chat is ready but still quiet', () => {
    const queue = bookingOperatorCommandQueue({
      ...baseInput,
      bookingStatus: 'MATCHED',
      hasFinalPartner: true,
      hasChatRoom: true,
      hasLatestLocation: true,
      latestLocationFreshness: 'recent',
      messageCount: 0,
    });

    expect(queue.commands[0]).toMatchObject({
      id: 'chat-first-contact',
      tone: 'pill-info',
    });
  });

  it('uses stale location copy when a saved Partner location is old', () => {
    const queue = bookingOperatorCommandQueue({
      ...baseInput,
      bookingStatus: 'ARRIVED',
      hasFinalPartner: true,
      hasChatRoom: true,
      messageCount: 2,
      hasLatestLocation: true,
      latestLocationFreshness: 'stale',
      providerLocationHelper: 'Last shared 45 min ago.',
    });

    expect(queue.commands[0]).toMatchObject({
      id: 'location-stale',
      detail: 'Last shared 45 min ago.',
      tone: 'pill-warn',
    });
  });

  it('describes cash debt as a marketplace participation gate, not a general acceptance block', () => {
    const queue = bookingOperatorCommandQueue({
      ...baseInput,
      bookingStatus: 'COMPLETED',
      hasFinalPartner: true,
      hasChatRoom: true,
      hasLatestLocation: true,
      latestLocationFreshness: 'recent',
      paymentStatus: 'CAPTURED',
      cashDebtNeedsSettlement: true,
    });

    expect(queue.commands.find((command) => command.id === 'cash-debt')).toMatchObject({
      title: 'Settle partner cash fee debt',
      detail:
        'Cash service fee debt blocks marketplace alerts, participation, and payout release until the company fee is settled.',
      owner: 'Finance operator',
    });
  });

  it('falls back to normal monitoring when no command is active', () => {
    const queue = bookingOperatorCommandQueue({
      ...baseInput,
      bookingStatus: 'COMPLETED',
      hasFinalPartner: true,
      hasChatRoom: true,
      messageCount: 3,
      hasLatestLocation: true,
      latestLocationFreshness: 'recent',
      paymentStatus: 'CAPTURED',
    });

    expect(queue.status).toBe('Monitor');
    expect(queue.tone).toBe('pill-success');
    expect(queue.commands[0]).toMatchObject({
      id: 'normal-monitoring',
      tone: 'pill-success',
    });
  });
});
