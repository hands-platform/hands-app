import { BookingStatus, ParticipantStatus, Prisma } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  adminBookingListCancellationReasonWhere,
  adminBookingListCustomDateBounds,
  adminBookingListDateBounds,
  adminBookingListDefaultSort,
  adminBookingListFreshnessWhere,
  adminBookingListStatusGroupWhere,
  adminBookingListWhere,
  adminBookingProductionDataWhere,
  adminBookingUnknownOriginSql,
  adminBookingVerifiedProductionSql,
  adminBookingVerifiedProductionWhere,
  endOfLocalDay,
  startOfLocalDay,
} from './admin-booking-list-query';

describe('admin booking list query', () => {
  it('uses explicit origin as the analysis authority and fails closed for unknown records', () => {
    expect(adminBookingVerifiedProductionWhere()).toEqual({
      AND: expect.arrayContaining([
        { metadata: { path: ['dataOrigin'], equals: 'PRODUCTION' } },
      ]),
    });
    const productionSql = adminBookingVerifiedProductionSql().strings.join(' ');
    const unknownSql = adminBookingUnknownOriginSql().strings.join(' ');
    expect(productionSql).toContain("= 'PRODUCTION'");
    expect(productionSql).not.toContain('booking.id');
    expect(productionSql).toContain("'{smoke}' IS NULL");
    expect(productionSql).toContain("'{fixture}' IS NULL");
    expect(productionSql).toContain('booking_customer_user."fixtureKind" IS NOT NULL');
    expect(unknownSql).toContain("<> 'SYNTHETIC'");
    expect(unknownSql).toContain('booking_partner_user."fixtureKind" IS NOT NULL');
  });
  it('hides marked audit, smoke, and seed bookings from operating queues by default', () => {
    expect(adminBookingListWhere({})).toEqual(adminBookingProductionDataWhere());
    expect(adminBookingProductionDataWhere()).toEqual({
      AND: expect.arrayContaining([
        {
          NOT: {
            OR: expect.arrayContaining([
              { id: { startsWith: 'smoke', mode: 'insensitive' } },
              { id: { startsWith: 'seed-', mode: 'insensitive' } },
              { customerProfileId: { startsWith: 'smoke', mode: 'insensitive' } },
            ]),
          },
        },
        {
          OR: [
            { preferredProviderId: null },
            expect.objectContaining({ NOT: expect.any(Object) }),
          ],
        },
        {
          OR: [
            { metadata: { path: ['smokeFixture'], equals: Prisma.AnyNull } },
            { NOT: { metadata: { path: ['smokeFixture'], equals: true } } },
          ],
        },
        { metadata: { path: ['auditFixture'], equals: Prisma.AnyNull } },
        {
          OR: [
            { metadata: { path: ['smoke'], equals: Prisma.AnyNull } },
            { NOT: { metadata: { path: ['smoke'], string_contains: 'smoke' } } },
          ],
        },
      ]),
    });
    expect(JSON.stringify(adminBookingProductionDataWhere())).not.toContain('string_contains":""');
  });

  it('filters queue age by the same booking creation time used for stable ordering', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-19T06:00:00.000Z'));

    expect(adminBookingListWhere({ age: 'over-24h' })).toMatchObject({
      AND: expect.arrayContaining([
        { createdAt: { lt: new Date('2026-07-18T06:00:00.000Z') } },
      ]),
    });

    vi.useRealTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps live booking statuses in the realtime group', () => {
    expect(adminBookingListStatusGroupWhere('realtime')).toEqual({
      status: {
        in: [
          BookingStatus.CREATED,
          BookingStatus.OPEN_MATCHING,
          BookingStatus.MATCHED,
          BookingStatus.PROVIDER_ON_THE_WAY,
          BookingStatus.ARRIVED,
          BookingStatus.IN_SERVICE,
        ],
      },
    });
  });

  it('splits live and anomalous active bookings at one 24-hour boundary', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-18T05:00:00.000Z'));
    const boundary = new Date('2026-07-17T05:00:00.000Z');

    expect(adminBookingListFreshnessWhere('realtime')).toEqual({ updatedAt: { gte: boundary } });
    expect(adminBookingListFreshnessWhere('needs-action')).toEqual({ updatedAt: { gte: boundary } });
    expect(adminBookingListFreshnessWhere('data-anomaly')).toEqual({ updatedAt: { lt: boundary } });
    expect(adminBookingListStatusGroupWhere('data-anomaly')).toEqual(
      adminBookingListStatusGroupWhere('realtime'),
    );
  });

  it('keeps closed records out of the realtime group', () => {
    expect(adminBookingListStatusGroupWhere('completed')).toEqual({
      status: {
        in: [BookingStatus.COMPLETED, BookingStatus.EXPIRED, BookingStatus.REFUNDED],
      },
    });
    expect(adminBookingListStatusGroupWhere('unknown')).toBeUndefined();
  });

  it('matches the usage unresolved cohort with created-at dates and explicit fixture markers', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-15T20:30:00.000Z'));

    expect(adminBookingListStatusGroupWhere('usage-unresolved')).toEqual({
      status: {
        notIn: [
          BookingStatus.COMPLETED,
          BookingStatus.CANCELLED,
          BookingStatus.NO_SHOW,
          BookingStatus.EXPIRED,
          BookingStatus.REFUNDED,
        ],
      },
    });
    const where = adminBookingListWhere({
      dateFrom: '2026-07-10',
      dateRange: 'custom',
      dateTo: '2026-07-15',
      statusGroup: 'usage-unresolved',
    });
    expect(where).toEqual({
      AND: [
        adminBookingVerifiedProductionWhere(),
        {
          createdAt: {
            gte: new Date('2026-07-09T17:00:00.000Z'),
            lte: new Date('2026-07-15T16:59:59.999Z'),
          },
        },
        adminBookingListStatusGroupWhere('usage-unresolved'),
      ],
    });
    expect(JSON.stringify(where)).not.toContain('startsWith');
  });

  it('keeps pre-match cancellations out of the post-match cancellation workspace', () => {
    expect(adminBookingListStatusGroupWhere('post-match-cancellations')).toEqual({
      AND: [
        {
          status: {
            in: [BookingStatus.CANCELLED, BookingStatus.NO_SHOW],
          },
        },
        {
          OR: [{ matchedAt: { not: null } }, { selectedProviderId: { not: null } }],
        },
      ],
    });
  });

  it('separates matching and needs-action queues from the full live set', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-18T05:00:00.000Z'));

    expect(adminBookingListStatusGroupWhere('matching')).toEqual({
      status: { in: [BookingStatus.CREATED, BookingStatus.OPEN_MATCHING] },
    });
    expect(adminBookingListStatusGroupWhere('in-service')).toEqual({
      status: BookingStatus.IN_SERVICE,
    });
    expect(adminBookingListStatusGroupWhere('matching-delays')).toEqual({
      status: BookingStatus.OPEN_MATCHING,
      OR: [
        { expiresAt: { lte: new Date('2026-07-18T05:00:00.000Z') } },
        {
          createdAt: { lte: new Date('2026-07-18T04:45:00.000Z') },
          participants: {
            none: { status: { in: [ParticipantStatus.JOINED, ParticipantStatus.ACCEPTED] } },
          },
        },
      ],
    });
    expect(adminBookingListStatusGroupWhere('needs-action')).toEqual({
      AND: [
        adminBookingListStatusGroupWhere('realtime'),
        {
          OR: [
            { updatedAt: { lt: new Date('2026-07-18T04:30:00.000Z') } },
            {
              expiresAt: { lt: new Date('2026-07-18T05:00:00.000Z') },
              status: { in: [BookingStatus.CREATED, BookingStatus.OPEN_MATCHING] },
            },
            { chatRoom: { is: null }, status: BookingStatus.MATCHED },
          ],
        },
      ],
    });
  });

  it('waits for the configured threshold before flagging supply intervention', () => {
    const matchingDelayBefore = new Date('2026-07-18T04:50:00.000Z');

    expect(adminBookingListStatusGroupWhere('no-supply', { matchingDelayBefore })).toEqual({
      status: BookingStatus.OPEN_MATCHING,
      createdAt: { lte: matchingDelayBefore },
      participants: {
        none: { status: { in: [ParticipantStatus.JOINED, ParticipantStatus.ACCEPTED] } },
      },
    });
    expect(adminBookingListStatusGroupWhere('matched')).toEqual({
      status: {
        in: [BookingStatus.MATCHED, BookingStatus.PROVIDER_ON_THE_WAY, BookingStatus.ARRIVED],
      },
      selectedProviderId: { not: null },
    });
  });

  it('defaults action queues to oldest and records or monitor queues to newest', () => {
    expect(adminBookingListDefaultSort('needs-action')).toBe('oldest');
    expect(adminBookingListDefaultSort('matching-delays')).toBe('oldest');
    expect(adminBookingListDefaultSort('no-supply')).toBe('oldest');
    expect(adminBookingListDefaultSort('realtime')).toBe('newest');
    expect(adminBookingListDefaultSort(undefined)).toBe('newest');
  });

  it('maps parallel matching queues and terminal pre-match outcomes exactly', () => {
    expect(adminBookingListStatusGroupWhere('preferred-pending')).toEqual({
      status: BookingStatus.OPEN_MATCHING,
      preferredProviderId: { not: null },
      providerRequestEvents: {
        none: {
          eventType: {
            in: ['PREFERRED_PROVIDER_REJECTED', 'PREFERRED_PROVIDER_NO_RESPONSE'],
          },
        },
      },
    });
    expect(adminBookingListStatusGroupWhere('marketplace-active')).toEqual({
      status: BookingStatus.OPEN_MATCHING,
    });
    expect(adminBookingListStatusGroupWhere('customer-choice')).toEqual({
      status: BookingStatus.OPEN_MATCHING,
      participants: {
        some: { status: { in: [ParticipantStatus.JOINED, ParticipantStatus.ACCEPTED] } },
      },
    });
    expect(adminBookingListStatusGroupWhere('pre-match-cancellations')).toEqual({
      status: BookingStatus.CANCELLED,
      matchedAt: null,
      selectedProviderId: null,
      closedReason: 'customer_cancelled',
    });
    expect(adminBookingListStatusGroupWhere('preferred-rejected')).toEqual({
      status: BookingStatus.CANCELLED,
      providerRequestEvents: { some: { eventType: 'PREFERRED_PROVIDER_REJECTED' } },
    });
    expect(adminBookingListStatusGroupWhere('preferred-no-response')).toEqual({
      status: BookingStatus.EXPIRED,
      providerRequestEvents: { some: { eventType: 'PREFERRED_PROVIDER_NO_RESPONSE' } },
    });
  });

  it('combines Vietnam date and status filters without changing the query shape', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-15T20:30:00.000Z'));

    const where = adminBookingListWhere({ dateRange: 'today', statusGroup: 'realtime' });

    const filters = (where as { AND: unknown[] }).AND;
    expect(filters).toHaveLength(4);
    expect(filters[1]).toMatchObject({
      OR: expect.arrayContaining([
        {
          openedAt: {
            gte: new Date('2026-07-15T17:00:00.000Z'),
            lte: new Date('2026-07-16T16:59:59.999Z'),
          },
        },
      ]),
    });
    expect(filters[2]).toEqual(adminBookingListFreshnessWhere('realtime'));
    expect(filters[3]).toEqual(adminBookingListStatusGroupWhere('realtime'));
  });

  it('filters structured Partner cancellation reasons at the database', () => {
    expect(adminBookingListCancellationReasonWhere('customer_not_found')).toEqual({
      metadata: {
        path: ['postMatchCancellation', 'reasonCode'],
        equals: 'CUSTOMER_NOT_FOUND',
      },
    });
    expect(adminBookingListCancellationReasonWhere('unknown')).toBeUndefined();

    expect(
      adminBookingListWhere({
        cancellationReason: 'SAFETY_CONCERN',
        statusGroup: 'post-match-cancellations',
      }),
    ).toEqual({
      AND: [
        adminBookingProductionDataWhere(),
        adminBookingListStatusGroupWhere('post-match-cancellations'),
        {
          metadata: {
            path: ['postMatchCancellation', 'reasonCode'],
            equals: 'SAFETY_CONCERN',
          },
        },
      ],
    });
  });

  it('searches booking, customer, Partner, and saved service address fields', () => {
    const where = adminBookingListWhere({ q: '  booking-123  ' });

    expect(where).toEqual({
      AND: [
        adminBookingProductionDataWhere(),
        {
          OR: expect.arrayContaining([
        { id: { contains: 'booking-123', mode: 'insensitive' } },
        { customerProfileId: { contains: 'booking-123', mode: 'insensitive' } },
        { preferredProviderId: { contains: 'booking-123', mode: 'insensitive' } },
        { selectedProviderId: { contains: 'booking-123', mode: 'insensitive' } },
        {
          customerProfile: {
            is: {
              user: {
                is: {
                  OR: [
                    { fullName: { contains: 'booking-123', mode: 'insensitive' } },
                    { phone: { contains: 'booking-123', mode: 'insensitive' } },
                  ],
                },
              },
            },
          },
        },
        {
          addressSnapshot: {
            is: { addressText: { contains: 'booking-123', mode: 'insensitive' } },
          },
        },
          ]),
        },
      ],
    });
  });

  it('builds Vietnam-day period bounds and validates bounded custom ranges', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-15T20:30:00.000Z'));

    const todayStartMs = startOfLocalDay(Date.now());
    expect(adminBookingListDateBounds({ dateRange: '7d' })).toEqual({
      startMs: new Date('2026-07-09T17:00:00.000Z').getTime(),
      endMs: endOfLocalDay(todayStartMs),
    });

    expect(adminBookingListCustomDateBounds('2026-07-10', '2026-07-15')).toEqual({
      startMs: new Date('2026-07-09T17:00:00.000Z').getTime(),
      endMs: new Date('2026-07-15T16:59:59.999Z').getTime(),
    });
    expect(() => adminBookingListCustomDateBounds(undefined, '2026-07-15')).toThrow(
      BadRequestException,
    );
    expect(() => adminBookingListCustomDateBounds(undefined, undefined)).toThrow(
      BadRequestException,
    );
    expect(() => adminBookingListCustomDateBounds('2026-02-30', '2026-03-01')).toThrow(
      BadRequestException,
    );
    expect(() => adminBookingListCustomDateBounds('2026-07-15', '2026-07-10')).toThrow(
      'Custom date from must be on or before date to',
    );
    expect(() => adminBookingListCustomDateBounds('2026-01-01', '2026-04-01')).toThrow(
      'Custom date range cannot exceed 90 days',
    );
    expect(adminBookingListCustomDateBounds('2026-01-01', '2026-03-31')).toEqual({
      startMs: new Date('2025-12-31T17:00:00.000Z').getTime(),
      endMs: new Date('2026-03-31T16:59:59.999Z').getTime(),
    });
  });
});
