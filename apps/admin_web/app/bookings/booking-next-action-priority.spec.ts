import {
  bookingCheckFlagSeverityWeight,
  bookingNextActionPriorityFromFacts,
  type BookingNextActionPriorityInput,
} from './booking-next-action-priority';

function buildInput(
  overrides: Partial<
    Omit<
      BookingNextActionPriorityInput,
      'completedCloseoutNeedsOps' | 'locationNeedsOps' | 'paymentNeedsOps'
    >
  > & {
    completedCloseoutNeedsOps?: boolean;
    locationNeedsOps?: boolean;
    paymentNeedsOps?: boolean;
  } = {},
): BookingNextActionPriorityInput {
  return {
    completedCloseoutNeedsOps: () => overrides.completedCloseoutNeedsOps ?? false,
    flagSeverity: overrides.flagSeverity,
    locationNeedsOps: () => overrides.locationNeedsOps ?? false,
    paymentNeedsOps: () => overrides.paymentNeedsOps ?? false,
    status: overrides.status,
  };
}

describe('bookingNextActionPriorityFromFacts', () => {
  it.each([
    ['high flag', { flagSeverity: 'high' }],
    ['p0 status', { status: 'NO_SHOW' }],
    ['payment ops', { paymentNeedsOps: true }],
    ['closeout ops', { completedCloseoutNeedsOps: true }],
  ] as const)('returns P0 for %s', (_label, overrides) => {
    expect(bookingNextActionPriorityFromFacts(buildInput(overrides))).toBe('P0');
  });

  it.each([
    ['medium flag', { flagSeverity: 'medium' }],
    ['p1 status', { status: 'MATCHED' }],
    ['location ops', { locationNeedsOps: true }],
  ] as const)('returns P1 for %s', (_label, overrides) => {
    expect(bookingNextActionPriorityFromFacts(buildInput(overrides))).toBe('P1');
  });

  it('returns P2 for active follow-up statuses and P3 otherwise', () => {
    expect(bookingNextActionPriorityFromFacts(buildInput({ status: 'OPEN_MATCHING' }))).toBe('P2');
    expect(bookingNextActionPriorityFromFacts(buildInput({ status: 'ARRIVED' }))).toBe('P2');
    expect(bookingNextActionPriorityFromFacts(buildInput({ status: 'COMPLETED' }))).toBe('P3');
  });

  it('does not read lower priority signals once a higher priority fact matches', () => {
    const input = {
      completedCloseoutNeedsOps: vi.fn(() => false),
      flagSeverity: 'high',
      locationNeedsOps: vi.fn(() => false),
      paymentNeedsOps: vi.fn(() => false),
      status: 'OPEN_MATCHING',
    } satisfies BookingNextActionPriorityInput;

    expect(bookingNextActionPriorityFromFacts(input)).toBe('P0');
    expect(input.paymentNeedsOps).not.toHaveBeenCalled();
    expect(input.completedCloseoutNeedsOps).not.toHaveBeenCalled();
    expect(input.locationNeedsOps).not.toHaveBeenCalled();
  });
});

describe('bookingCheckFlagSeverityWeight', () => {
  it('orders check flag severities from high to low', () => {
    expect([
      bookingCheckFlagSeverityWeight('low'),
      bookingCheckFlagSeverityWeight('high'),
      bookingCheckFlagSeverityWeight('medium'),
      bookingCheckFlagSeverityWeight(null),
    ]).toEqual([1, 3, 2, 0]);
  });
});
