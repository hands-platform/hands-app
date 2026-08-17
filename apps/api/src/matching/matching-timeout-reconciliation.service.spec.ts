import { BookingStatus } from '@prisma/client';
import { BookingTimeoutReconciliationService } from './matching-timeout-reconciliation.service';

describe('BookingTimeoutReconciliationService', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('requeues expired open bookings and timeout payment-closure retries from durable DB state', async () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-08-17T01:00:00.000Z'));
    const now = new Date();
    const prisma = {
      booking: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'booking-open-expired',
            expiresAt: new Date(now.getTime() - 10_000),
            status: BookingStatus.OPEN_MATCHING,
          },
          {
            id: 'booking-expired-payment-pending',
            expiresAt: null,
            status: BookingStatus.EXPIRED,
          },
        ]),
      },
      adminAuditLog: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const queue = { add: vi.fn().mockResolvedValue({ id: 'job-1' }) };
    const service = new BookingTimeoutReconciliationService(prisma as never, queue as never);

    await expect(service.reconcileBatch(now)).resolves.toEqual({
      failed: 0,
      scheduled: 2,
      skipped: false,
    });

    expect(prisma.booking.findMany).toHaveBeenCalledWith({
      where: {
        AND: [
          {
            OR: [
              {
                status: BookingStatus.OPEN_MATCHING,
                selectedProviderId: null,
                expiresAt: { lte: now },
              },
              {
                status: BookingStatus.EXPIRED,
                closedReason: {
                  in: ['preferred_provider_no_response', 'matching_request_expired'],
                },
              },
              {
                status: BookingStatus.EXPIRED,
                closedReason: 'admin_expired',
                opsTasks: {
                  some: {
                    note: { startsWith: 'Booking closeout is pending' },
                    status: 'PENDING',
                    type: 'PAYMENT_REVIEWED',
                  },
                },
              },
            ],
          },
        ],
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true, expiresAt: true, status: true },
    });
    expect(prisma.adminAuditLog.findMany).toHaveBeenCalledWith({
      where: {
        action: 'booking.timeout.payment_closure_recorded',
        objectId: {
          in: ['booking-open-expired', 'booking-expired-payment-pending'],
        },
      },
      select: { objectId: true },
    });
    expect(queue.add).toHaveBeenCalledTimes(2);
    expect(queue.add).toHaveBeenCalledWith(
      'booking-timeout',
      { bookingId: 'booking-expired-payment-pending' },
      expect.objectContaining({ delay: 0, attempts: 3, removeOnFail: true }),
    );
  });

  it('keeps other bookings recoverable when one queue add fails', async () => {
    const prisma = {
      booking: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'booking-1', expiresAt: new Date(0), status: BookingStatus.OPEN_MATCHING },
          { id: 'booking-2', expiresAt: new Date(0), status: BookingStatus.OPEN_MATCHING },
        ]),
      },
      adminAuditLog: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const queue = {
      add: vi.fn().mockRejectedValueOnce(new Error('queue unavailable')).mockResolvedValueOnce({}),
    };
    const service = new BookingTimeoutReconciliationService(prisma as never, queue as never);

    await expect(service.reconcileBatch(new Date())).resolves.toEqual({
      failed: 1,
      scheduled: 1,
      skipped: false,
    });
  });

  it('does not requeue an expired timeout whose payment closure audit already exists', async () => {
    const prisma = {
      booking: {
        findMany: vi
          .fn()
          .mockResolvedValue([
          { id: 'booking-closed', expiresAt: new Date(0), status: BookingStatus.EXPIRED },
        ]),
      },
      adminAuditLog: {
        findMany: vi.fn().mockResolvedValue([{ objectId: 'booking-closed' }]),
      },
    };
    const queue = { add: vi.fn() };
    const service = new BookingTimeoutReconciliationService(prisma as never, queue as never);

    await expect(service.reconcileBatch(new Date())).resolves.toEqual({
      failed: 0,
      scheduled: 0,
      skipped: false,
    });
    expect(queue.add).not.toHaveBeenCalled();
  });
});
