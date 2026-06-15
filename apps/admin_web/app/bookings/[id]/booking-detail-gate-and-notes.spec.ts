import type { AdminBookingDetail, AdminLocationSnapshot } from '../../../lib/admin-api';
import { bookingDetailGateAndNotes } from './booking-detail-gate-and-notes';

function booking(input: Partial<AdminBookingDetail>): AdminBookingDetail {
  return {
    createdAt: '2026-06-14T01:00:00.000Z',
    id: 'booking-detail-gate-and-notes',
    participants: [],
    status: 'OPEN_MATCHING',
    ...input,
  } as AdminBookingDetail;
}

function location(input: Partial<AdminLocationSnapshot> = {}): AdminLocationSnapshot {
  return {
    id: 'location-1',
    lat: 10.7627,
    lng: 106.6603,
    providerProfileId: 'partner-selected',
    recordedAt: '2026-06-14T01:10:00.000Z',
    ...input,
  } as AdminLocationSnapshot;
}

function baseInput(input: AdminBookingDetail) {
  return {
    booking: input,
    closeoutOpenItemLabels: [],
    customerChoiceCandidates: 0,
    latestLocation: location(),
    marketplaceParticipants: 0,
    messageCount: 2,
    notificationCount: 1,
    operatorNoteCount: 1,
    refundRowCount: 0,
    walletLedgerLabel: 'Wallet clear',
  };
}

describe('bookingDetailGateAndNotes', () => {
  it('builds final gate and clear note presets from a matched booking', () => {
    const result = bookingDetailGateAndNotes(
      baseInput(
        booking({
          addressSnapshot: { addressText: 'District 1 address' } as AdminBookingDetail['addressSnapshot'],
          chatRoom: { id: 'chat-room-retained' } as AdminBookingDetail['chatRoom'],
          selectedProvider: {
            id: 'partner-selected',
            displayName: 'Selected Partner',
          } as AdminBookingDetail['selectedProvider'],
          selectedProviderId: 'partner-selected',
          status: 'MATCHED',
        }),
      ),
    );

    expect(result.finalGateReason).toMatchObject({
      className: 'ops-task-done',
      pillClass: 'pill-success',
      title: 'Final Partner locked',
    });
    expect(result.decisionNotePresets).toEqual([
      expect.objectContaining({
        id: 'evidence-reviewed-note',
        label: 'Clear',
      }),
    ]);
  });

  it('keeps cash debt and closeout gaps visible in both gate and note presets', () => {
    const result = bookingDetailGateAndNotes({
      ...baseInput(
        booking({
          addressSnapshot: { addressText: 'District 1 address' } as AdminBookingDetail['addressSnapshot'],
          earning: {
            netAmount: -120000,
            status: 'PENDING',
          } as AdminBookingDetail['earning'],
          payment: {
            method: 'CASH',
            status: 'PAID',
          } as AdminBookingDetail['payment'],
          status: 'COMPLETED',
        }),
      ),
      closeoutOpenItemLabels: ['Payment', 'Tax'],
      latestLocation: null,
      messageCount: 0,
      notificationCount: 0,
      operatorNoteCount: 0,
      walletLedgerLabel: 'Wallet -120.000 VND',
    });

    expect(result.finalGateReason).toMatchObject({
      className: 'ops-task-blocked',
      pillClass: 'pill-danger',
      title: 'Wallet debt gate',
    });
    expect(result.decisionNotePresets.map((preset) => preset.id)).toEqual([
      'chat-empty-note',
      'location-empty-note',
      'alert-empty-note',
      'operator-note-needed',
      'cash-debt-note',
      'closeout-open-items-note',
    ]);
  });
});
