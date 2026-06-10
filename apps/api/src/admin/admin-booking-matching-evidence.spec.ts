import {
  BookingMatchSource,
  BookingStatus,
  ParticipantStatus,
} from '@prisma/client';
import { buildAdminBookingMatchingEvidence } from './admin-booking-matching-evidence';

describe('Admin booking matching evidence', () => {
  it('maps every booking status to an Admin matching evidence stage', () => {
    const rows = [
      [BookingStatus.CREATED, 'CREATED'],
      [BookingStatus.OPEN_MATCHING, 'OPEN_MARKETPLACE_ACTIVE'],
      [BookingStatus.MATCHED, 'MATCHED'],
      [BookingStatus.PROVIDER_ON_THE_WAY, 'SERVICE_ACTIVE'],
      [BookingStatus.ARRIVED, 'SERVICE_ACTIVE'],
      [BookingStatus.IN_SERVICE, 'SERVICE_ACTIVE'],
      [BookingStatus.COMPLETED, 'CLOSED'],
      [BookingStatus.CANCELLED, 'CLOSED'],
      [BookingStatus.NO_SHOW, 'CLOSED'],
      [BookingStatus.EXPIRED, 'CLOSED'],
      [BookingStatus.REFUNDED, 'CLOSED'],
    ] as const;

    expect(
      rows.map(([status, stage]) => [
        status,
        buildAdminBookingMatchingEvidence({
          status,
          participants: [],
        }).stage,
        stage,
      ]),
    ).toEqual(rows.map(([status, stage]) => [status, stage, stage]));
  });

  it('identifies first-pick acceptance as the final Partner connection', () => {
    const matchedAt = new Date('2026-06-10T10:00:00.000Z');

    expect(
      buildAdminBookingMatchingEvidence({
        status: BookingStatus.MATCHED,
        preferredProviderId: 'first-pick',
        selectedProviderId: 'first-pick',
        matchedAt,
        matchSource: BookingMatchSource.FIRST_PICK_ACCEPTED_FIRST,
        chatRoom: { id: 'chat-1' },
        participants: [
          {
            providerProfileId: 'first-pick',
            status: ParticipantStatus.SELECTED,
          },
        ],
      }),
    ).toEqual({
      chatReady: true,
      finalSelection: 'FIRST_PICK_ACCEPTED',
      firstPickStatus: ParticipantStatus.SELECTED,
      marketplaceParticipantCount: 0,
      matchedAt,
      matchSource: BookingMatchSource.FIRST_PICK_ACCEPTED_FIRST,
      selectableParticipantCount: 0,
      stage: 'MATCHED',
    });
  });

  it('excludes rejected marketplace rows and counts selectable Partners', () => {
    expect(
      buildAdminBookingMatchingEvidence({
        status: BookingStatus.OPEN_MATCHING,
        preferredProviderId: 'first-pick',
        participants: [
          {
            providerProfileId: 'first-pick',
            status: ParticipantStatus.JOINED,
          },
          {
            providerProfileId: 'marketplace-joined',
            status: ParticipantStatus.JOINED,
          },
          {
            providerProfileId: 'marketplace-accepted',
            status: ParticipantStatus.ACCEPTED,
          },
          {
            providerProfileId: 'marketplace-rejected',
            status: ParticipantStatus.REJECTED,
          },
        ],
      }),
    ).toMatchObject({
      finalSelection: 'CUSTOMER_SELECTION_AVAILABLE',
      firstPickStatus: ParticipantStatus.JOINED,
      marketplaceParticipantCount: 2,
      selectableParticipantCount: 2,
      stage: 'OPEN_MARKETPLACE_ACTIVE',
    });
  });
});
