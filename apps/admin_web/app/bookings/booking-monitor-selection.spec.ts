import {
  bookingMonitorSelectionFromFacts,
  type BookingMonitorSelectionFacts,
} from './booking-monitor-selection';

function facts(overrides: Partial<BookingMonitorSelectionFacts> = {}): BookingMonitorSelectionFacts {
  return {
    finalSelectionCopy: null,
    firstPickPending: false,
    hasPreferredProvider: true,
    isBackupSelected: false,
    isMatched: false,
    isSelectedProviderParticipant: false,
    marketplaceCount: 0,
    preferredProviderState: null,
    ...overrides,
  };
}

describe('bookingMonitorSelectionFromFacts', () => {
  it('uses final selection copy when the final selection is already decided', () => {
    expect(
      bookingMonitorSelectionFromFacts(
        facts({
          finalSelectionCopy: {
            label: 'Customer selected final Partner',
            pathLabel: 'Customer reviewed participants and selected the final Partner',
            toneClass: 'pill-success',
          },
          firstPickPending: true,
        }),
      ),
    ).toEqual({
      label: 'Customer selected final Partner',
      pathLabel: 'Customer reviewed participants and selected the final Partner',
      toneClass: 'pill-success',
    });
  });

  it('describes open pool and direct first-pick states', () => {
    expect(
      bookingMonitorSelectionFromFacts(facts({ hasPreferredProvider: false, marketplaceCount: 2 })),
    ).toEqual({
      label: 'No first-pick partner',
      pathLabel: 'Open pool request with marketplace supply',
      toneClass: 'pill-neutral',
    });

    expect(
      bookingMonitorSelectionFromFacts(facts({ firstPickPending: true, marketplaceCount: 1 })),
    ).toEqual({
      label: 'First-pick partner pending',
      pathLabel: 'Direct request first, with marketplace partners already waiting',
      toneClass: 'pill-warn',
    });
  });

  it('describes backup, matched, and declined selection states', () => {
    expect(bookingMonitorSelectionFromFacts(facts({ isBackupSelected: true }))).toEqual({
      label: 'Marketplace partner selected',
      pathLabel: 'Direct request escalated to marketplace participation, then the guest chose a marketplace partner',
      toneClass: 'pill-neutral',
    });

    expect(bookingMonitorSelectionFromFacts(facts({ isMatched: true }))).toEqual({
      label: 'Final partner selected',
      pathLabel: 'Direct request confirmed by the first-pick partner',
      toneClass: 'pill-success',
    });

    expect(
      bookingMonitorSelectionFromFacts(facts({ preferredProviderState: 'declined' })),
    ).toEqual({
      label: 'First-pick partner declined',
      pathLabel: 'Direct request remains the active path',
      toneClass: 'pill-info',
    });
  });
});
