import {
  bookingOpsSignalState,
  type BookingOpsSignalStateInput,
} from './booking-ops-signal-state';

function input(overrides: Partial<BookingOpsSignalStateInput> = {}): BookingOpsSignalStateInput {
  return {
    backupSelected: vi.fn(() => false),
    cashDebtNeedsOps: vi.fn(() => false),
    firstPickPending: vi.fn(() => false),
    marketplaceParticipantCount: 1,
    matchingChatReady: vi.fn(() => true),
    payment: null,
    status: 'MATCHED',
    ...overrides,
  };
}

describe('bookingOpsSignalState', () => {
  it('summarizes terminal payment review states first', () => {
    expect(
      bookingOpsSignalState(input({ payment: { status: 'AUTHORIZED' }, status: 'NO_SHOW' })),
    ).toEqual({ label: 'No-show, check payment', tone: 'warn' });
    expect(
      bookingOpsSignalState(input({ payment: { status: 'RELEASED' }, status: 'EXPIRED' })),
    ).toEqual({ label: 'Expired and released', tone: 'ok' });
    expect(
      bookingOpsSignalState(input({ payment: { status: 'AUTHORIZED' }, status: 'CANCELLED' })),
    ).toEqual({ label: 'Cancelled, check payment', tone: 'warn' });
  });

  it('does not read lower-priority readers for terminal states', () => {
    const state = input({ payment: { status: 'RELEASED' }, status: 'NO_SHOW' });

    expect(bookingOpsSignalState(state)).toEqual({ label: 'No-show closed', tone: 'ok' });
    expect(state.cashDebtNeedsOps).not.toHaveBeenCalled();
    expect(state.firstPickPending).not.toHaveBeenCalled();
    expect(state.backupSelected).not.toHaveBeenCalled();
    expect(state.matchingChatReady).not.toHaveBeenCalled();
  });

  it('summarizes active matching supply states in operator order', () => {
    expect(bookingOpsSignalState(input({ cashDebtNeedsOps: () => true }))).toEqual({
      label: 'Cash fee debt',
      tone: 'warn',
    });
    expect(
      bookingOpsSignalState(input({ firstPickPending: () => true, status: 'OPEN_MATCHING' })),
    ).toEqual({ label: 'First-pick Partner pending', tone: 'warn' });
    expect(
      bookingOpsSignalState(input({ marketplaceParticipantCount: 0, status: 'OPEN_MATCHING' })),
    ).toEqual({ label: 'No marketplace Partners yet', tone: 'warn' });
    expect(
      bookingOpsSignalState(input({ marketplaceParticipantCount: 2, status: 'OPEN_MATCHING' })),
    ).toEqual({ label: 'Marketplace options ready', tone: 'info' });
  });

  it('summarizes matched handoff states and normal fallback', () => {
    expect(bookingOpsSignalState(input({ backupSelected: () => true, status: 'MATCHED' }))).toEqual({
      label: 'Marketplace Partner selected',
      tone: 'info',
    });
    expect(bookingOpsSignalState(input({ matchingChatReady: () => false, status: 'MATCHED' }))).toEqual({
      label: 'Chat missing',
      tone: 'warn',
    });
    expect(bookingOpsSignalState(input({ status: 'IN_SERVICE' }))).toEqual({
      label: 'Normal',
      tone: 'ok',
    });
  });
});
