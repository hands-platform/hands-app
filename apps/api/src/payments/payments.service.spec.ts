import { BadRequestException, ConflictException } from '@nestjs/common';
import { PaymentMethod, PaymentStatus, Role } from '@prisma/client';

import { PaymentsService } from './payments.service';

describe('PaymentsService status check queue', () => {
  it('schedules payment status checks with the shared queue descriptor', async () => {
    const { queue, service } = createService({ existingPayment: null });

    await service.scheduleStatusCheck('payment-1');

    expect(queue.add).toHaveBeenCalledWith(
      'payment-status-check',
      { paymentId: 'payment-1' },
      {
        delay: 30_000,
        attempts: 5,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  });

  it('preserves coupon pricing metadata when payment authorization is refreshed', async () => {
    const existingPayment = {
      ...payment({ status: PaymentStatus.AUTHORIZED }),
      rawMeta: {
        couponCode: 'WELCOME10',
        couponId: 'coupon-1',
        discountAmount: 30000,
        originalAmount: 300000,
      },
    };
    const { prisma, service } = createService({
      existingPayment,
      updatedPayment: payment({ status: PaymentStatus.AUTHORIZED }),
    });
    prisma.payment.findUniqueOrThrow.mockResolvedValue(existingPayment);

    await service.refreshAuthorizationForBooking('payment-1', 'booking-1');

    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { id: 'payment-1' },
      data: expect.objectContaining({
        providerRef: 'cash-booking-1',
        rawMeta: expect.objectContaining({
          couponCode: 'WELCOME10',
          couponId: 'coupon-1',
          discountAmount: 30000,
          originalAmount: 300000,
          providerRef: 'cash-booking-1',
        }),
      }),
    });
  });
});

describe('PaymentsService callbacks', () => {
  it('accepts a non-terminal callback and records accepted evidence', async () => {
    const { prisma, service } = createService({
      existingPayment: payment({ status: PaymentStatus.AUTHORIZED }),
      updatedPayment: payment({ status: PaymentStatus.CAPTURED }),
    });

    const result = await service.handleCallback(PaymentMethod.CASH, {
      providerRef: 'cash-booking-1',
      signature: 'gateway-signature',
      status: 'CAPTURED',
      vnp_SecureHash: 'gateway-secure-hash',
    });

    expect(result).toEqual({ ok: true, replay: false, payment: payment({ status: PaymentStatus.CAPTURED }) });
    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rawMeta: expect.objectContaining({
            callbackSignatureVerified: true,
            callbackVerificationMode: 'cash-internal',
            providerRef: 'cash-booking-1',
            signature: '[REDACTED]',
            vnp_SecureHash: '[REDACTED]',
          }),
          status: PaymentStatus.CAPTURED,
        }),
        where: { id: 'payment-1' },
      }),
    );
    expect(prisma.paymentCallbackAttempt.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        method: PaymentMethod.CASH,
        outcome: 'ACCEPTED',
        paymentId: 'payment-1',
        providerRef: 'cash-booking-1',
        providerStatus: PaymentStatus.CAPTURED,
        rawPayload: {
          providerRef: 'cash-booking-1',
          signature: '[REDACTED]',
          status: 'CAPTURED',
          vnp_SecureHash: '[REDACTED]',
        },
        signatureVerified: true,
        verificationMode: 'cash-internal',
      }),
    });
  });

  it('notifies the booking customer after an accepted payment status update', async () => {
    const notifications = { create: vi.fn().mockResolvedValue({ id: 'notification-1' }) };
    const { service } = createService({
      existingPayment: payment({ status: PaymentStatus.AUTHORIZED }),
      notificationLookupPayment: {
        id: 'payment-1',
        bookingId: 'booking-1',
        booking: { customerProfile: { userId: 'customer-user' } },
      },
      notifications,
      updatedPayment: payment({ status: PaymentStatus.CAPTURED }),
    });

    await service.handleCallback(PaymentMethod.CASH, {
      providerRef: 'cash-booking-1',
      status: 'CAPTURED',
    });

    expect(notifications.create).toHaveBeenCalledWith({
      userId: 'customer-user',
      targetRole: Role.CUSTOMER,
      type: 'payment.updated',
      title: 'Payment updated',
      body: 'Your booking payment status was updated.',
      data: { paymentId: 'payment-1', bookingId: 'booking-1' },
    });
  });

  it('treats duplicate terminal callbacks with the same status as replay', async () => {
    const { prisma, service } = createService({
      existingPayment: payment({ status: PaymentStatus.CAPTURED }),
    });

    const result = await service.handleCallback(PaymentMethod.CASH, {
      providerRef: 'cash-booking-1',
      status: 'CAPTURED',
    });

    expect(result).toEqual({ ok: true, replay: true, payment: payment({ status: PaymentStatus.CAPTURED }) });
    expect(prisma.payment.update).not.toHaveBeenCalled();
    expect(prisma.paymentCallbackAttempt.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        outcome: 'REPLAY',
        paymentId: 'payment-1',
        providerStatus: PaymentStatus.CAPTURED,
      }),
    });
  });

  it('rejects terminal callbacks that conflict with stored payment status', async () => {
    const { prisma, service } = createService({
      existingPayment: payment({ status: PaymentStatus.RELEASED }),
    });

    await expect(
      service.handleCallback(PaymentMethod.CASH, {
        providerRef: 'cash-booking-1',
        status: 'CAPTURED',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.payment.update).not.toHaveBeenCalled();
    expect(prisma.paymentCallbackAttempt.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        errorCode: 'CONFLICT',
        outcome: 'CONFLICT',
        paymentId: 'payment-1',
        providerStatus: PaymentStatus.CAPTURED,
      }),
    });
  });

  it('records rejected evidence when the provider reference is unknown', async () => {
    const { prisma, service } = createService({ existingPayment: null });

    await expect(
      service.handleCallback(PaymentMethod.CASH, {
        providerRef: 'missing-payment',
        status: 'CAPTURED',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.payment.update).not.toHaveBeenCalled();
    expect(prisma.paymentCallbackAttempt.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        errorCode: 'BAD_REQUEST',
        outcome: 'REJECTED',
        paymentId: undefined,
        providerRef: 'missing-payment',
        providerStatus: PaymentStatus.CAPTURED,
      }),
    });
  });
});

describe('PaymentsService refunds', () => {
  it('rejects admin refunds without approval from a different admin', async () => {
    const admin = { writeAudit: vi.fn() };
    const earnings = {
      cancelForRefund: vi.fn(),
    };
    const settlements = {
      reverseBookingSettlementSnapshotForRefund: vi.fn(),
    };
    const existingPayment = payment({ status: PaymentStatus.CAPTURED });
    const { prisma, service } = createService({
      admin,
      earnings,
      existingPayment,
      settlements,
    });
    prisma.payment.findUniqueOrThrow.mockResolvedValue(existingPayment);

    await expect(service.refund('admin-1', 'payment-1')).rejects.toThrow(
      'Payment refund requires approval from a different admin',
    );
    await expect(service.refund('admin-1', 'payment-1', { approvalAdminId: 'admin-1' })).rejects.toThrow(
      'Payment refund requires approval from a different admin',
    );

    expect(prisma.payment.update).not.toHaveBeenCalled();
    expect(settlements.reverseBookingSettlementSnapshotForRefund).not.toHaveBeenCalled();
    expect(earnings.cancelForRefund).not.toHaveBeenCalled();
    expect(admin.writeAudit).not.toHaveBeenCalled();
  });

  it('rejects admin refunds approved by a non-admin approver before finance writes', async () => {
    const admin = { writeAudit: vi.fn() };
    const earnings = {
      cancelForRefund: vi.fn(),
    };
    const settlements = {
      reverseBookingSettlementSnapshotForRefund: vi.fn(),
    };
    const existingPayment = payment({ status: PaymentStatus.CAPTURED });
    const { prisma, service } = createService({
      admin,
      earnings,
      existingPayment,
      settlements,
    });
    prisma.payment.findUniqueOrThrow.mockResolvedValue(existingPayment);
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(
      service.refund('admin-1', 'payment-1', { approvalAdminId: 'support-user-2' }),
    ).rejects.toThrow('Payment refund requires approval from an admin approver');

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { id: 'support-user-2', roles: { has: Role.ADMIN } },
      select: { id: true },
    });
    expect(prisma.payment.update).not.toHaveBeenCalled();
    expect(settlements.reverseBookingSettlementSnapshotForRefund).not.toHaveBeenCalled();
    expect(earnings.cancelForRefund).not.toHaveBeenCalled();
    expect(admin.writeAudit).not.toHaveBeenCalled();
  });

  it('reverses booking settlement snapshot when an admin refund is posted', async () => {
    const admin = { writeAudit: vi.fn() };
    const earnings = {
      cancelForRefund: vi.fn().mockResolvedValue({ skipped: false, earning: { id: 'earning-1' } }),
    };
    const settlements = {
      reverseBookingSettlementSnapshotForRefund: vi.fn().mockResolvedValue({
        id: 'settlement-1',
        settlementStatus: 'REVERSED',
      }),
    };
    const existingPayment = payment({ status: PaymentStatus.CAPTURED });
    const refundedPayment = {
      ...existingPayment,
      refunds: [{ id: 'refund-1', amount: existingPayment.amount }],
      status: PaymentStatus.REFUNDED,
    };
    const { prisma, service } = createService({
      admin,
      earnings,
      existingPayment,
      settlements,
      updatedPayment: refundedPayment,
    });
    prisma.payment.findUniqueOrThrow.mockResolvedValue(existingPayment);

    await expect(
      service.refund('admin-1', 'payment-1', { approvalAdminId: 'finance-admin-2' }),
    ).resolves.toEqual(refundedPayment);

    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          booking: { update: { status: 'REFUNDED' } },
          status: PaymentStatus.REFUNDED,
        }),
        include: { refunds: true },
        where: { id: 'payment-1' },
      }),
    );
    expect(settlements.reverseBookingSettlementSnapshotForRefund).toHaveBeenCalledWith({
      actorId: 'admin-1',
      bookingId: 'booking-1',
      occurredAt: expect.any(Date),
      reason: 'Admin manual refund',
    }, expect.objectContaining({ payment: expect.any(Object) }));
    expect(earnings.cancelForRefund).toHaveBeenCalledWith(
      'booking-1',
      expect.objectContaining({ payment: expect.any(Object) }),
    );
    expect(admin.writeAudit).toHaveBeenCalledWith(
      'admin-1',
      'payment.refund',
      'payment:payment-1',
      expect.objectContaining({
        approvalAdminId: 'finance-admin-2',
        earningCancellation: { skipped: false, earningId: 'earning-1' },
        settlementReversal: expect.objectContaining({ settlementStatus: 'REVERSED' }),
      }),
    );
  });
});

function createService({
  admin,
  earnings,
  existingPayment,
  notificationLookupPayment,
  notifications,
  settlements,
  updatedPayment,
}: {
  admin?: { writeAudit: ReturnType<typeof vi.fn> };
  earnings?: { cancelForRefund: ReturnType<typeof vi.fn> };
  existingPayment: ReturnType<typeof payment> | null;
  notificationLookupPayment?: unknown;
  notifications?: { create: ReturnType<typeof vi.fn> };
  settlements?: { reverseBookingSettlementSnapshotForRefund: ReturnType<typeof vi.fn> };
  updatedPayment?: ReturnType<typeof payment>;
}) {
  const findUnique = vi.fn();
  if (notificationLookupPayment) {
    findUnique.mockResolvedValueOnce(existingPayment).mockResolvedValueOnce(notificationLookupPayment);
  } else {
    findUnique.mockResolvedValue(existingPayment);
  }
  const prisma = {
    $transaction: vi.fn(async (callback: (client: unknown) => Promise<unknown>) => callback(prisma)),
    payment: {
      findUnique,
      findUniqueOrThrow: vi.fn(),
      update: vi.fn().mockResolvedValue(updatedPayment ?? existingPayment),
    },
    paymentCallbackAttempt: {
      create: vi.fn(),
    },
    user: {
      findFirst: vi.fn().mockResolvedValue({ id: 'finance-admin-2' }),
    },
  };
  const config = { get: vi.fn() };
  const queue = { add: vi.fn() };

  return {
    prisma,
    queue,
    service: new PaymentsService(
      prisma as never,
      config as never,
      (admin ?? { writeAudit: vi.fn() }) as never,
      (earnings ?? { cancelForRefund: vi.fn() }) as never,
      placeholderAdapter(PaymentMethod.MOMO) as never,
      placeholderAdapter(PaymentMethod.VNPAY) as never,
      cashAdapter() as never,
      queue as never,
      notifications as never,
      (settlements ?? { reverseBookingSettlementSnapshotForRefund: vi.fn() }) as never,
    ),
  };
}

function payment({ status }: { status: PaymentStatus }) {
  return {
    amount: 300000,
    bookingId: 'booking-1',
    currency: 'VND',
    id: 'payment-1',
    method: PaymentMethod.CASH,
    providerRef: 'cash-booking-1',
    rawMeta: {},
    status,
  };
}

function cashAdapter() {
  return {
    authorize: vi.fn(({ bookingId, amount }: { bookingId: string; amount: number }) => ({
      amount,
      method: PaymentMethod.CASH,
      providerRef: `cash-${bookingId}`,
      rawMeta: { providerRef: `cash-${bookingId}` },
      status: PaymentStatus.AUTHORIZED,
    })),
    checkStatus: vi.fn(),
    method: PaymentMethod.CASH,
    parseCallback: vi.fn((payload: unknown) => {
      const body = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
      return {
        providerRef: String(body.providerRef ?? ''),
        rawMeta: body,
        status: body.status === 'CAPTURED' ? PaymentStatus.CAPTURED : PaymentStatus.AUTHORIZED,
      };
    }),
    release: vi.fn(),
  };
}

function placeholderAdapter(method: PaymentMethod) {
  return {
    authorize: vi.fn(),
    checkStatus: vi.fn(),
    method,
    parseCallback: vi.fn(),
    release: vi.fn(),
  };
}
