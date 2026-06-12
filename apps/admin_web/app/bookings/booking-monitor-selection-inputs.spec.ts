import type { AdminBooking } from '../../lib/admin-api';
import { bookingMonitorSelectionFactsFromBooking } from './booking-monitor-selection-inputs';

function booking(input: Partial<AdminBooking>): AdminBooking {
  return input as AdminBooking;
}

describe('bookingMonitorSelectionFactsFromBooking', () => {
  it('builds selection facts from booking data and local selection state', () => {
    const item = booking({
      id: 'booking-1',
      matchingEvidence: {
        finalSelection: 'CUSTOMER_SELECTED_PARTNER',
      } as AdminBooking['matchingEvidence'],
      preferredProvider: { id: 'preferred', displayName: 'First Pick' } as AdminBooking['preferredProvider'],
      status: 'OPEN_MATCHING',
    });

    expect(
      bookingMonitorSelectionFactsFromBooking(item, {
        firstPickPending: true,
        isBackupSelected: true,
        isSelectedProviderParticipant: true,
        marketplaceCount: 2,
        preferredProviderState: 'confirmed',
      }),
    ).toEqual({
      finalSelectionCopy: {
        label: 'Customer selected final Partner',
        pathLabel: 'Customer reviewed participants and selected the final Partner',
        toneClass: 'pill-success',
      },
      firstPickPending: true,
      hasPreferredProvider: true,
      isBackupSelected: true,
      isMatched: false,
      isSelectedProviderParticipant: true,
      marketplaceCount: 2,
      preferredProviderState: 'confirmed',
    });
  });

  it('masks preferred-partner-only facts when the booking has no preferred provider', () => {
    const item = booking({
      id: 'booking-2',
      status: 'MATCHED',
    });

    expect(
      bookingMonitorSelectionFactsFromBooking(item, {
        firstPickPending: true,
        isBackupSelected: true,
        isSelectedProviderParticipant: true,
        marketplaceCount: 0,
        preferredProviderState: 'confirmed',
      }),
    ).toEqual({
      finalSelectionCopy: null,
      firstPickPending: false,
      hasPreferredProvider: false,
      isBackupSelected: false,
      isMatched: true,
      isSelectedProviderParticipant: false,
      marketplaceCount: 0,
      preferredProviderState: null,
    });
  });
});
