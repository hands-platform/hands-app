import { bookingOperatorCommandQueue } from './booking-operator-command-queue';

const baseInput = {
  bookingStatus: 'CREATED',
  participantCount: 0,
  partnerLabel: 'No final partner',
  hasFinalPartner: false,
  hasChatRoom: false,
  messageCount: 0,
  hasLatestLocation: false,
  latestLocationFreshness: 'missing',
  providerLocationHelper: 'No partner location yet.',
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

  it('uses stale location copy when a saved partner location is old', () => {
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
