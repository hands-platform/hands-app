import type { BookingMonitorEvidenceMatchReaders } from './booking-monitor-evidence-match';
import { bookingMatchesMonitorEvidenceFilter } from './booking-monitor-evidence-match';

const booleanReaderNames = [
  'activeStatus',
  'addressNeedsOps',
  'alertEvidenceNeedsOps',
  'cashDebtNeedsOps',
  'chatLive',
  'chatRepairNeedsOps',
  'closeoutNeedsOps',
  'hasFinalPartner',
  'hasProviderLocation',
  'locationNeedsOps',
  'paymentNeedsOps',
  'terminalStatus',
] as const;

function buildReaders(
  overrides: Partial<Record<(typeof booleanReaderNames)[number], boolean>> & {
    status?: string;
  } = {},
): BookingMonitorEvidenceMatchReaders {
  return {
    activeStatus: () => overrides.activeStatus ?? false,
    addressNeedsOps: () => overrides.addressNeedsOps ?? false,
    alertEvidenceNeedsOps: () => overrides.alertEvidenceNeedsOps ?? false,
    cashDebtNeedsOps: () => overrides.cashDebtNeedsOps ?? false,
    chatLive: () => overrides.chatLive ?? false,
    chatRepairNeedsOps: () => overrides.chatRepairNeedsOps ?? false,
    closeoutNeedsOps: () => overrides.closeoutNeedsOps ?? false,
    hasFinalPartner: () => overrides.hasFinalPartner ?? false,
    hasProviderLocation: () => overrides.hasProviderLocation ?? false,
    locationNeedsOps: () => overrides.locationNeedsOps ?? false,
    paymentNeedsOps: () => overrides.paymentNeedsOps ?? false,
    status: () => overrides.status ?? 'MATCHED',
    terminalStatus: () => overrides.terminalStatus ?? false,
  };
}

describe('bookingMatchesMonitorEvidenceFilter', () => {
  it('always matches the all filter', () => {
    expect(bookingMatchesMonitorEvidenceFilter('all', buildReaders())).toBe(true);
  });

  it.each([
    ['address', { addressNeedsOps: true }],
    ['alerts', { alertEvidenceNeedsOps: true }],
  ] as const)('matches %s from its dedicated reader', (filter, overrides) => {
    expect(bookingMatchesMonitorEvidenceFilter(filter, buildReaders(overrides))).toBe(true);
    expect(bookingMatchesMonitorEvidenceFilter(filter, buildReaders())).toBe(false);
  });

  it('matches partner evidence for open matching or active bookings missing a final partner', () => {
    expect(
      bookingMatchesMonitorEvidenceFilter(
        'partner',
        buildReaders({ status: 'OPEN_MATCHING', hasFinalPartner: true }),
      ),
    ).toBe(true);
    expect(
      bookingMatchesMonitorEvidenceFilter(
        'partner',
        buildReaders({ activeStatus: true, hasFinalPartner: false }),
      ),
    ).toBe(true);
    expect(
      bookingMatchesMonitorEvidenceFilter(
        'partner',
        buildReaders({ activeStatus: true, hasFinalPartner: true }),
      ),
    ).toBe(false);
  });

  it('matches chat evidence when chat is live or needs repair', () => {
    expect(bookingMatchesMonitorEvidenceFilter('chat', buildReaders({ chatLive: true }))).toBe(
      true,
    );
    expect(
      bookingMatchesMonitorEvidenceFilter('chat', buildReaders({ chatRepairNeedsOps: true })),
    ).toBe(true);
    expect(bookingMatchesMonitorEvidenceFilter('chat', buildReaders())).toBe(false);
  });

  it('matches money evidence from payment, cash debt, or closeout signals', () => {
    expect(
      bookingMatchesMonitorEvidenceFilter('money', buildReaders({ paymentNeedsOps: true })),
    ).toBe(true);
    expect(
      bookingMatchesMonitorEvidenceFilter('money', buildReaders({ cashDebtNeedsOps: true })),
    ).toBe(true);
    expect(
      bookingMatchesMonitorEvidenceFilter('money', buildReaders({ closeoutNeedsOps: true })),
    ).toBe(true);
    expect(bookingMatchesMonitorEvidenceFilter('money', buildReaders())).toBe(false);
  });

  it('matches location evidence when ops review or any provider location exists', () => {
    expect(
      bookingMatchesMonitorEvidenceFilter('location', buildReaders({ locationNeedsOps: true })),
    ).toBe(true);
    expect(
      bookingMatchesMonitorEvidenceFilter('location', buildReaders({ hasProviderLocation: true })),
    ).toBe(true);
    expect(bookingMatchesMonitorEvidenceFilter('location', buildReaders())).toBe(false);
  });

  it('matches closeout evidence for terminal, closeout, and no-show states', () => {
    expect(
      bookingMatchesMonitorEvidenceFilter('closeout', buildReaders({ terminalStatus: true })),
    ).toBe(true);
    expect(
      bookingMatchesMonitorEvidenceFilter('closeout', buildReaders({ closeoutNeedsOps: true })),
    ).toBe(true);
    expect(
      bookingMatchesMonitorEvidenceFilter('closeout', buildReaders({ status: 'NO_SHOW' })),
    ).toBe(true);
    expect(bookingMatchesMonitorEvidenceFilter('closeout', buildReaders())).toBe(false);
  });
});
