import { ConfigService } from '@nestjs/config';
import { BookingStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import { buildAdminMatchingPreview } from './admin-matching-preview';

const ACTIVE_BOOKING = {
  addressSnapshot: {
    createdAt: new Date('2026-08-14T01:00:00.000Z'),
    latitude: 10.7769,
    longitude: 106.7009,
  },
  createdAt: new Date('2026-08-14T00:59:00.000Z'),
  customerProfile: { gender: 'female', nationality: 'VN' },
  expiresAt: new Date('2099-08-14T01:10:00.000Z'),
  id: 'booking-active',
  lat: 10.7769,
  lng: 106.7009,
  openedAt: new Date('2026-08-14T01:00:00.000Z'),
  preferredProviderId: 'preferred-partner',
  services: [{ serviceId: 'service-1' }],
  status: BookingStatus.OPEN_MATCHING,
};

function previewPrisma(booking: typeof ACTIVE_BOOKING | null) {
  const writes = {
    auditCreate: vi.fn(),
    bookingUpdate: vi.fn(),
    notificationCreate: vi.fn(),
    participantCreate: vi.fn(),
    walletCreate: vi.fn(),
  };
  const candidates = [
    {
      bookingAlertPreferences: { enabled: true },
      currentLat: 10.777,
      currentLng: 106.701,
      currentLocationUpdatedAt: new Date('2099-08-14T01:01:00.000Z'),
      displayName: 'Partner One',
      id: 'partner-1',
    },
  ];
  return {
    prisma: {
      adminAuditLog: { create: writes.auditCreate },
      booking: {
        findFirst: vi.fn().mockResolvedValue(booking),
        findUnique: vi.fn().mockResolvedValue(booking),
        update: writes.bookingUpdate,
      },
      notification: { create: writes.notificationCreate },
      operationalPolicySetting: { findMany: vi.fn().mockResolvedValue([]) },
      bookingParticipant: { create: writes.participantCreate },
      providerProfile: {
        aggregate: vi.fn().mockResolvedValue({
          _max: { currentLocationUpdatedAt: new Date('2099-08-14T01:01:00.000Z') },
          _min: { currentLocationUpdatedAt: new Date('2099-08-14T00:30:00.000Z') },
        }),
        count: vi
          .fn()
          .mockResolvedValueOnce(12)
          .mockResolvedValueOnce(6)
          .mockResolvedValueOnce(5)
          .mockResolvedValueOnce(4)
          .mockResolvedValueOnce(2)
          .mockResolvedValueOnce(1),
        findMany: vi.fn().mockResolvedValue(candidates),
      },
      providerWalletLedgerEntry: {
        create: writes.walletCreate,
        groupBy: vi.fn().mockResolvedValue([]),
      },
    },
    writes,
  };
}

describe('admin matching preview', () => {
  it('returns production evidence and performs no writes', async () => {
    const { prisma, writes } = previewPrisma(ACTIVE_BOOKING);

    const result = await buildAdminMatchingPreview(
      prisma as never,
      new ConfigService(),
    );

    expect(result.status).toBe('READY_WITH_PRODUCTION_EVIDENCE');
    expect(result.reference).toMatchObject({
      bookingId: 'booking-active',
      kind: 'BOOKING',
      serviceId: 'service-1',
    });
    expect(result.candidates.map((candidate) => candidate.partnerId)).toEqual(['partner-1']);
    expect(result.evidence).toMatchObject({
      newestAt: '2099-08-14T01:01:00.000Z',
      oldestAt: '2099-08-14T00:30:00.000Z',
      truncated: false,
    });
    expect(result.safety).toEqual({ dryRun: true, mutationsPerformed: false });
    expect(prisma.booking.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ openedAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        where: expect.objectContaining({
          expiresAt: { gt: expect.any(Date) },
          status: BookingStatus.OPEN_MATCHING,
        }),
      }),
    );
    Object.values(writes).forEach((write) => expect(write).not.toHaveBeenCalled());
  });

  it('never reports Demo evidence as production ready', async () => {
    const { prisma } = previewPrisma(null);

    const result = await buildAdminMatchingPreview(prisma as never, new ConfigService());

    expect(result.status).toBe('DEMO_PREVIEW_ONLY');
    expect(result.reference.kind).toBe('DEMO');
    expect(result.evidence.totalEvaluated).toBe(0);
    expect(result.stages).toEqual([]);
    expect(result.candidates).toEqual([]);
    expect(prisma.providerProfile.count).not.toHaveBeenCalled();
  });

  it('blocks an explicitly requested terminal booking', async () => {
    const terminalBooking = {
      ...ACTIVE_BOOKING,
      expiresAt: new Date('2026-08-14T01:10:00.000Z'),
      status: BookingStatus.COMPLETED,
    };
    const { prisma } = previewPrisma(terminalBooking);

    const result = await buildAdminMatchingPreview(
      prisma as never,
      new ConfigService(),
      terminalBooking.id,
    );

    expect(result.status).toBe('BLOCKED_NO_REFERENCE');
    expect(result.reference.kind).toBe('BOOKING');
    expect(prisma.providerProfile.findMany).not.toHaveBeenCalled();
  });

  it('treats missing coordinates as incomplete evidence instead of zero coordinates', async () => {
    const bookingWithoutCoordinates = {
      ...ACTIVE_BOOKING,
      addressSnapshot: null,
      lat: null,
      lng: null,
    };
    const { prisma } = previewPrisma(bookingWithoutCoordinates as never);

    const result = await buildAdminMatchingPreview(prisma as never, new ConfigService());

    expect(result.status).toBe('INCOMPLETE_EVIDENCE');
    expect(result.reference).toMatchObject({ lat: null, lng: null });
    expect(prisma.providerProfile.count).not.toHaveBeenCalled();
    expect(prisma.providerProfile.findMany).not.toHaveBeenCalled();
  });

  it('uses exact stage counts to identify the first production blocker', async () => {
    const { prisma } = previewPrisma(ACTIVE_BOOKING);
    prisma.providerProfile.count = vi
      .fn()
      .mockResolvedValueOnce(12)
      .mockResolvedValueOnce(6)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    prisma.providerProfile.findMany = vi.fn().mockResolvedValue([]);

    const result = await buildAdminMatchingPreview(prisma as never, new ConfigService());

    expect(result.status).toBe('BLOCKED_NO_ELIGIBLE_SUPPLY');
    expect(result.primaryBlocker).toMatchObject({
      actionHref: '/partners?review=approval-incomplete',
      code: 'identity',
    });
    expect(result.evidence.truncated).toBe(false);
  });
});
