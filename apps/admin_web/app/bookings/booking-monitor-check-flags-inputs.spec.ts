import type { AdminBooking } from '../../lib/admin-api';
import {
  bookingMonitorCheckFlagsInput,
  bookingMonitorCheckFlagsInputFromBooking,
} from './booking-monitor-check-flags-inputs';

const pricingPolicy = {
  label: 'Pricing ready',
  status: 'ready',
  tone: 'pill-success',
} as const;

function input(overrides: Partial<Parameters<typeof bookingMonitorCheckFlagsInput>[0]> = {}) {
  return bookingMonitorCheckFlagsInput({
    cashDebtNeedsOps: false,
    chatMessageCount: 0,
    completedCloseoutNeedsOps: false,
    firstPickAwaitingDecision: false,
    hasChatRoom: false,
    hasPayment: false,
    hasProviderLocation: false,
    participantCount: 0,
    paymentProviderRef: null,
    paymentStatus: null,
    pricingPolicy,
    providerLocationFreshness: 'missing',
    responseWindowExpired: false,
    status: 'OPEN_MATCHING',
    ...overrides,
  });
}

const nowMs = new Date('2026-06-07T10:00:00.000Z').getTime();

function booking(overrides: Partial<AdminBooking> = {}): AdminBooking {
  return {
    id: 'booking-1',
    status: 'OPEN_MATCHING',
    ...overrides,
  } as AdminBooking;
}

function bookingFacts(
  overrides: Partial<Parameters<typeof bookingMonitorCheckFlagsInputFromBooking>[2]> = {},
): Parameters<typeof bookingMonitorCheckFlagsInputFromBooking>[2] {
  return {
    cashDebtNeedsOps: false,
    completedCloseoutNeedsOps: false,
    firstPickPending: false,
    marketplaceParticipantCount: 0,
    pricingPolicy,
    responseWindowExpired: false,
    ...overrides,
  };
}

describe('bookingMonitorCheckFlagsInput', () => {
  it('enables matching timer facts only for open matching bookings', () => {
    expect(
      input({
        firstPickAwaitingDecision: true,
        responseWindowExpired: true,
        status: 'OPEN_MATCHING',
      }),
    ).toMatchObject({
      firstPickPending: true,
      matchingWindowExpired: true,
    });

    expect(
      input({
        firstPickAwaitingDecision: true,
        responseWindowExpired: true,
        status: 'MATCHED',
      }),
    ).toMatchObject({
      firstPickPending: false,
      matchingWindowExpired: false,
    });
  });

  it('requires chat readiness only for matched bookings', () => {
    expect(input({ hasChatRoom: false, status: 'MATCHED' })).toMatchObject({
      matchingChatReady: false,
    });
    expect(input({ hasChatRoom: false, status: 'OPEN_MATCHING' })).toMatchObject({
      matchingChatReady: true,
    });
  });

  it('maps booking fields and caller facts into check flag facts', () => {
    expect(
      bookingMonitorCheckFlagsInputFromBooking(
        booking({
          status: 'OPEN_MATCHING',
          payment: {
            amount: 150000,
            currency: 'VND',
            method: 'CARD',
            providerRef: null,
            status: 'AUTHORIZED',
          } as AdminBooking['payment'],
          selectedProvider: {
            currentLat: '10.7769',
            currentLng: '106.7009',
            currentLocationUpdatedAt: '2026-06-07T09:45:00.000Z',
          } as AdminBooking['selectedProvider'],
        }),
        nowMs,
        bookingFacts({
          firstPickPending: true,
          marketplaceParticipantCount: 3,
          responseWindowExpired: true,
        }),
      ),
    ).toMatchObject({
      chatMessageCount: 0,
      firstPickPending: true,
      hasPayment: true,
      hasProviderLocation: true,
      matchingWindowExpired: true,
      participantCount: 3,
      paymentProviderRef: null,
      paymentStatus: 'AUTHORIZED',
      providerLocationFreshness: 'recent',
    });
  });

  it('keeps first-pick and matching-window facts gated to open matching bookings', () => {
    expect(
      bookingMonitorCheckFlagsInputFromBooking(
        booking({ status: 'MATCHED' }),
        nowMs,
        bookingFacts({
          firstPickPending: true,
          responseWindowExpired: true,
        }),
      ),
    ).toMatchObject({
      firstPickPending: false,
      matchingWindowExpired: false,
      matchingChatReady: false,
    });
  });
});
