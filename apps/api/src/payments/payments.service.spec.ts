import { BadRequestException, ConflictException } from '@nestjs/common';
import { PaymentMethod, PaymentStatus, Role } from '@prisma/client';

import { PaymentsService } from './payments.service';

describe('PaymentsService VNPay IPN protocol', () => {
  it.each([
    [{ ok: true, replay: false }, { RspCode: '00', Message: 'Confirm Success' }],
    [{ ok: true, replay: true }, { RspCode: '02', Message: 'Order already confirmed' }],
  ])('maps accepted callback result to the VNPay acknowledgement protocol', async (result, expected) => {
    const service = Object.create(PaymentsService.prototype) as PaymentsService;
    vi.spyOn(service, 'handleCallback').mockResolvedValue(result as never);

    await expect(service.handleVnpayIpn({ vnp_TxnRef: 'booking-1' })).resolves.toEqual(expected);
  });

  it.each([
    [new BadRequestException('Payment callback provider reference is unknown'), '01', 'Order not Found'],
    [new ConflictException('terminal payment status'), '02', 'Order already confirmed'],
    [new BadRequestException('Payment callback amount does not match the stored payment'), '04', 'Invalid Amount'],
    [new BadRequestException('VNPAY callback secret is not configured'), '97', 'Invalid Checksum'],
    [new BadRequestException('VNPay callback merchant code does not match'), '97', 'Invalid Checksum'],
    [new BadRequestException('Invalid VNPay callback secure hash'), '97', 'Invalid Checksum'],
    [new Error('database unavailable'), '99', 'Unknown error'],
  ])('maps callback failure to VNPay response %s', async (error, RspCode, Message) => {
    const service = Object.create(PaymentsService.prototype) as PaymentsService;
    vi.spyOn(service, 'handleCallback').mockRejectedValue(error);

    await expect(service.handleVnpayIpn({ vnp_TxnRef: 'booking-1' })).resolves.toEqual({
      RspCode,
      Message,
    });
  });
});

describe('PaymentsService status check queue', () => {
  it('schedules payment status checks with the shared queue descriptor', async () => {
    const { queue, service } = createService({ existingPayment: null });

    await service.scheduleStatusCheck('payment-1');

    expect(queue.add).toHaveBeenCalledWith(
      'payment-status-check',
      { paymentId: 'payment-1' },
      {
        jobId: 'payment-status-check-payment-1',
        delay: 30_000,
        attempts: 5,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  });

  it('schedules provider refund checks with a deterministic retained job', async () => {
    const { refundQueue, service } = createService({ existingPayment: null });

    await service.scheduleRefundStatusCheck('refund-1');

    expect(refundQueue.add).toHaveBeenCalledWith(
      'payment-refund-status',
      { refundId: 'refund-1' },
      {
        jobId: 'payment-refund-status-refund-1',
        delay: 60_000,
        attempts: 30,
        backoff: { type: 'fixed', delay: 60_000 },
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
    prisma.payment.findUniqueOrThrow
      .mockResolvedValueOnce(existingPayment)
      .mockResolvedValueOnce(payment({ status: PaymentStatus.AUTHORIZED }));
    await service.refreshAuthorizationForBooking('payment-1', 'booking-1');

    expect(prisma.payment.updateMany).toHaveBeenCalledWith({
      where: { id: 'payment-1', status: { in: [PaymentStatus.PENDING, PaymentStatus.AUTHORIZED] } },
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

  it('persists a gateway reference before awaiting external authorization', async () => {
    const existingPayment = payment({
      method: PaymentMethod.MOMO,
      providerRef: null,
      status: PaymentStatus.PENDING,
    });
    const preparedPayment = {
      ...existingPayment,
      providerRef: 'booking-1',
      rawMeta: { authorizationState: 'INITIALIZING' },
    };
    const readyPayment = {
      ...preparedPayment,
      rawMeta: { authorizationState: 'READY', checkoutUrl: 'https://payments.example.test/checkout' },
    };
    const adapter = gatewayAdapter(PaymentMethod.MOMO);
    const { prisma, service } = createService({
      existingPayment,
      momoPaymentAdapter: adapter,
      updatedPayment: readyPayment,
    });
    prisma.payment.findUniqueOrThrow
      .mockReset()
      .mockResolvedValueOnce(existingPayment)
      .mockResolvedValueOnce(preparedPayment)
      .mockResolvedValueOnce(readyPayment);

    await expect(service.refreshAuthorizationForBooking('payment-1', 'booking-1')).resolves.toEqual(readyPayment);

    expect(prisma.payment.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: 'payment-1', status: { in: [PaymentStatus.PENDING, PaymentStatus.AUTHORIZED] } },
      data: expect.objectContaining({
        providerRef: 'booking-1',
        rawMeta: expect.objectContaining({ authorizationState: 'INITIALIZING' }),
      }),
    });
    expect(prisma.payment.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      adapter.authorize.mock.invocationCallOrder[0],
    );
    expect(prisma.payment.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: 'payment-1', status: { in: [PaymentStatus.PENDING, PaymentStatus.AUTHORIZED] } },
      data: expect.objectContaining({
        providerRef: 'booking-1',
        rawMeta: expect.objectContaining({ authorizationState: 'READY' }),
      }),
    });
  });

  it('keeps a timed-out gateway booking quarantined and schedules an idempotent status check', async () => {
    const existingPayment = payment({
      method: PaymentMethod.MOMO,
      providerRef: null,
      status: PaymentStatus.PENDING,
    });
    const preparedPayment = {
      ...existingPayment,
      providerRef: 'booking-1',
      rawMeta: { authorizationState: 'INITIALIZING', couponCode: 'SAVE10' },
    };
    const adapter = gatewayAdapter(PaymentMethod.MOMO);
    adapter.authorize.mockRejectedValueOnce(new Error('gateway timeout'));
    const { prisma, queue, service } = createService({
      existingPayment,
      momoPaymentAdapter: adapter,
      updatedPayment: preparedPayment,
    });
    prisma.payment.findUniqueOrThrow
      .mockReset()
      .mockResolvedValueOnce(existingPayment)
      .mockResolvedValueOnce(preparedPayment)
      .mockResolvedValueOnce(preparedPayment);

    await expect(service.refreshAuthorizationForBooking('payment-1', 'booking-1')).rejects.toThrow(
      'gateway timeout',
    );

    expect(prisma.payment.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: 'payment-1', status: { in: [PaymentStatus.PENDING, PaymentStatus.AUTHORIZED] } },
      data: {
        rawMeta: expect.objectContaining({
          authorizationState: 'RETRY_PENDING',
          authorizationLastError: 'gateway timeout',
          couponCode: 'SAVE10',
        }),
      },
    });
    expect(queue.add).toHaveBeenCalledWith(
      'payment-status-check',
      { paymentId: 'payment-1' },
      expect.objectContaining({ jobId: 'payment-status-check-payment-1' }),
    );
  });

  it('marks a gateway order verified by status query as ready for booking recovery', async () => {
    const existingPayment = {
      ...payment({
        method: PaymentMethod.MOMO,
        providerRef: 'booking-1',
        status: PaymentStatus.PENDING,
      }),
      rawMeta: { authorizationState: 'RETRY_PENDING', couponCode: 'SAVE10' },
    };
    const updatedPayment = {
      ...existingPayment,
      rawMeta: {
        authorizationState: 'READY',
        authorizationVerifiedBy: 'STATUS_QUERY',
        couponCode: 'SAVE10',
      },
    };
    const adapter = gatewayAdapter(PaymentMethod.MOMO);
    const { prisma, service } = createService({
      existingPayment,
      momoPaymentAdapter: adapter,
      updatedPayment,
    });

    await expect(service.checkAndSyncStatus('payment-1')).resolves.toEqual({
      paymentId: 'payment-1',
      bookingId: 'booking-1',
      status: PaymentStatus.PENDING,
      bookingRecoveryReady: true,
    });
    expect(prisma.payment.updateMany).toHaveBeenCalledWith({
      where: { id: 'payment-1', status: { in: [PaymentStatus.PENDING] } },
      data: {
        status: PaymentStatus.PENDING,
        rawMeta: expect.objectContaining({
          authorizationState: 'READY',
          authorizationVerifiedBy: 'STATUS_QUERY',
          couponCode: 'SAVE10',
        }),
      },
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
    expect(prisma.payment.updateMany).toHaveBeenCalledWith(
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
        where: { id: 'payment-1', status: { in: [PaymentStatus.AUTHORIZED] } },
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

  it('preserves booking pricing metadata when a verified gateway callback is accepted', async () => {
    const existingPayment = {
      ...payment({
        method: PaymentMethod.MOMO,
        providerRef: 'booking-1',
        status: PaymentStatus.PENDING,
      }),
      rawMeta: { couponCode: 'SAVE10', discountAmount: 50000, authorizationState: 'RETRY_PENDING' },
    };
    const capturedPayment = {
      ...existingPayment,
      status: PaymentStatus.CAPTURED,
      rawMeta: { couponCode: 'SAVE10', discountAmount: 50000, authorizationState: 'READY' },
    };
    const adapter = gatewayAdapter(PaymentMethod.MOMO);
    adapter.parseCallback.mockReturnValue({
      providerRef: 'booking-1',
      status: PaymentStatus.CAPTURED,
      rawMeta: { providerRef: 'booking-1', resultCode: 0 },
    });
    const { config, prisma, queue, service } = createService({
      existingPayment,
      momoPaymentAdapter: adapter,
      updatedPayment: capturedPayment,
    });
    config.get.mockImplementation((key: string) => {
      if (key === 'NODE_ENV') return 'test';
      if (key === 'ALLOW_UNVERIFIED_PAYMENT_CALLBACKS') return 'true';
      return undefined;
    });

    await service.handleCallback(PaymentMethod.MOMO, {
      providerRef: 'booking-1',
      amount: 300000,
      resultCode: 0,
    });

    expect(prisma.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rawMeta: expect.objectContaining({
            authorizationState: 'READY',
            authorizationVerifiedBy: 'CALLBACK',
            couponCode: 'SAVE10',
            discountAmount: 50000,
          }),
        }),
      }),
    );
    expect(queue.add).toHaveBeenCalledWith(
      'payment-status-check',
      { paymentId: 'payment-1' },
      expect.objectContaining({ jobId: 'payment-status-check-payment-1' }),
    );
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
    expect(prisma.payment.updateMany).not.toHaveBeenCalled();
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

    expect(prisma.payment.updateMany).not.toHaveBeenCalled();
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

    expect(prisma.payment.updateMany).not.toHaveBeenCalled();
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

    expect(prisma.payment.updateMany).not.toHaveBeenCalled();
    expect(settlements.reverseBookingSettlementSnapshotForRefund).not.toHaveBeenCalled();
    expect(earnings.cancelForRefund).not.toHaveBeenCalled();
    expect(admin.writeAudit).not.toHaveBeenCalled();
  });

  it('rejects admin refunds approved by an admin without finance approver authority before finance writes', async () => {
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
    ).rejects.toThrow('Payment refund requires approval from a finance approver');

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { id: 'support-user-2', roles: { has: Role.FINANCE_APPROVER } },
      select: { id: true },
    });
    expect(prisma.payment.updateMany).not.toHaveBeenCalled();
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
    await expect(
      service.refund('admin-1', 'payment-1', { approvalAdminId: 'finance-admin-2' }),
    ).resolves.toEqual(refundedPayment);

    expect(prisma.payment.updateMany).toHaveBeenCalledWith({
      data: { status: PaymentStatus.REFUNDED },
      where: { id: 'payment-1', status: { in: [PaymentStatus.CAPTURED] } },
    });
    expect(prisma.booking.update).toHaveBeenCalledWith({
      data: { status: 'REFUNDED' },
      where: { id: 'booking-1' },
    });
    expect(prisma.refund.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amount: 300000,
        bookingId: 'booking-1',
        currency: 'VND',
        metadata: expect.objectContaining({
          actorId: 'admin-1',
          approvalAdminId: 'finance-admin-2',
          occurredAt: expect.any(String),
        }),
        paymentId: 'payment-1',
        status: 'REQUESTED',
      }),
    });
    expect(prisma.refund.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'refund-1' },
      data: expect.objectContaining({
        status: 'GATEWAY_CONFIRMED',
        metadata: expect.objectContaining({ gatewayConfirmedAt: expect.any(String) }),
      }),
    });
    expect(prisma.refund.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'refund-1' },
      data: expect.objectContaining({
        status: 'COMPLETED',
        metadata: expect.objectContaining({ completedAt: expect.any(String) }),
      }),
    });
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

  it('keeps refund-after-payout receivable evidence in admin audit metadata', async () => {
    const admin = { writeAudit: vi.fn() };
    const earnings = {
      cancelForRefund: vi.fn().mockResolvedValue({
        skipped: false,
        reason: 'PAID_REFUND_RECEIVABLE_CREATED',
        earning: { id: 'earning-paid-1' },
        receivableAmount: 430000,
      }),
    };
    const settlements = {
      reverseBookingSettlementSnapshotForRefund: vi.fn().mockResolvedValue({
        id: 'settlement-paid-payout-1',
        settlementStatus: 'REVERSED',
      }),
    };
    const existingPayment = payment({ status: PaymentStatus.CAPTURED });
    const refundedPayment = {
      ...existingPayment,
      refunds: [{ id: 'refund-1', amount: existingPayment.amount }],
      status: PaymentStatus.REFUNDED,
    };
    const { service } = createService({
      admin,
      earnings,
      existingPayment,
      settlements,
      updatedPayment: refundedPayment,
    });
    await service.refund('admin-1', 'payment-1', { approvalAdminId: 'finance-admin-2' });

    expect(admin.writeAudit).toHaveBeenCalledWith(
      'admin-1',
      'payment.refund',
      'payment:payment-1',
      expect.objectContaining({
        earningCancellation: {
          skipped: false,
          earningId: 'earning-paid-1',
          reason: 'PAID_REFUND_RECEIVABLE_CREATED',
          receivableAmount: 430000,
        },
      }),
    );
  });

  it('rejects a concurrent duplicate refund before any refund side effects', async () => {
    const admin = { writeAudit: vi.fn() };
    const earnings = { cancelForRefund: vi.fn() };
    const settlements = { reverseBookingSettlementSnapshotForRefund: vi.fn() };
    const refundedPayment = payment({ status: PaymentStatus.REFUNDED });
    const { prisma, service } = createService({
      admin,
      earnings,
      existingPayment: refundedPayment,
      settlements,
      updatedPayment: refundedPayment,
      updateCount: 0,
    });

    await expect(
      service.refund('admin-1', 'payment-1', { approvalAdminId: 'finance-admin-2' }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.refund.create).not.toHaveBeenCalled();
    expect(prisma.booking.update).not.toHaveBeenCalled();
    expect(settlements.reverseBookingSettlementSnapshotForRefund).not.toHaveBeenCalled();
    expect(earnings.cancelForRefund).not.toHaveBeenCalled();
    expect(admin.writeAudit).not.toHaveBeenCalled();
  });
});

describe('PaymentsService conditional transitions', () => {
  it('requires provider capture before a real VNPay booking can open matching', () => {
    const adapter = gatewayAdapter(PaymentMethod.VNPAY);
    const { service } = createService({
      existingPayment: payment({ method: PaymentMethod.VNPAY, status: PaymentStatus.PENDING }),
      vnpayPaymentAdapter: adapter,
    });

    expect(service.paymentCanOpenMatching(PaymentMethod.VNPAY, PaymentStatus.PENDING)).toBe(false);
    expect(service.paymentCanOpenMatching(PaymentMethod.VNPAY, PaymentStatus.AUTHORIZED)).toBe(false);
    expect(service.paymentCanOpenMatching(PaymentMethod.VNPAY, PaymentStatus.CAPTURED)).toBe(true);
    expect(service.paymentRequiresCaptureBeforeMatching(PaymentMethod.VNPAY)).toBe(true);
  });

  it('confirms gateway capture before committing the captured payment state', async () => {
    const adapter = gatewayAdapter(PaymentMethod.MOMO);
    adapter.capture.mockResolvedValueOnce({
      status: PaymentStatus.CAPTURED,
      rawMeta: { gatewayOperation: 'capture', gatewayTransactionId: 'momo-tx-1' },
    });
    const captured = payment({
      method: PaymentMethod.MOMO,
      providerRef: 'booking-1',
      status: PaymentStatus.CAPTURED,
    });
    const { prisma, service } = createService({
      existingPayment: payment({
        method: PaymentMethod.MOMO,
        providerRef: 'booking-1',
        status: PaymentStatus.AUTHORIZED,
      }),
      momoPaymentAdapter: adapter,
      updatedPayment: captured,
    });

    await expect(service.capture('admin-1', 'payment-1')).resolves.toEqual(captured);

    expect(adapter.capture).toHaveBeenCalledWith({
      amount: 300000,
      bookingId: 'booking-1',
      currency: 'VND',
      paymentId: 'payment-1',
      providerRef: 'booking-1',
    });
    expect(adapter.capture.mock.invocationCallOrder[0]).toBeLessThan(
      prisma.payment.updateMany.mock.invocationCallOrder[0],
    );
    expect(prisma.payment.updateMany).toHaveBeenCalledWith({
      data: {
        status: PaymentStatus.CAPTURED,
        rawMeta: {
          gatewayOperation: 'capture',
          gatewayTransactionId: 'momo-tx-1',
        },
      },
      where: { id: 'payment-1', status: { in: [PaymentStatus.AUTHORIZED] } },
    });
  });

  it('captures an internal cash payment from pending', async () => {
    const captured = payment({ method: PaymentMethod.CASH, status: PaymentStatus.CAPTURED });
    const first = createService({
      existingPayment: payment({ method: PaymentMethod.CASH, status: PaymentStatus.PENDING }),
      updatedPayment: captured,
    });

    await expect(first.service.capture('admin-1', 'payment-1')).resolves.toEqual(captured);
    expect(first.prisma.payment.updateMany).toHaveBeenCalledWith({
      data: { status: PaymentStatus.CAPTURED },
      where: { id: 'payment-1', status: { in: [PaymentStatus.PENDING] } },
    });
  });

  it('captures only an authorized payment and treats the same target as idempotent', async () => {
    const captured = payment({ method: PaymentMethod.MOMO, status: PaymentStatus.CAPTURED });
    const first = createService({
      existingPayment: payment({ method: PaymentMethod.MOMO, status: PaymentStatus.AUTHORIZED }),
      updatedPayment: captured,
    });

    await expect(first.service.capture('admin-1', 'payment-1')).resolves.toEqual(captured);
    expect(first.prisma.payment.updateMany).toHaveBeenCalledWith({
      data: { status: PaymentStatus.CAPTURED },
      where: { id: 'payment-1', status: { in: [PaymentStatus.AUTHORIZED] } },
    });

    const replay = createService({
      existingPayment: captured,
      updatedPayment: captured,
      updateCount: 0,
    });
    await expect(replay.service.capture('admin-1', 'payment-1')).resolves.toEqual(captured);
  });

  it('rejects capture from a conflicting terminal status', async () => {
    const released = payment({ status: PaymentStatus.RELEASED });
    const { service } = createService({ existingPayment: released, updatedPayment: released, updateCount: 0 });

    await expect(service.capture('admin-1', 'payment-1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('does not call the provider adapter when release is already complete', async () => {
    const released = payment({ status: PaymentStatus.RELEASED });
    const adapter = cashAdapter();
    const { service } = createService({ cashPaymentAdapter: adapter, existingPayment: released });

    await expect(service.release('payment-1')).resolves.toEqual(released);
    expect(adapter.release).not.toHaveBeenCalled();
  });

  it('queues captured unmatched payments for audited refund review without claiming release', async () => {
    const captured = payment({ method: PaymentMethod.VNPAY, status: PaymentStatus.CAPTURED });
    const adapter = gatewayAdapter(PaymentMethod.VNPAY);
    const { prisma, service } = createService({
      existingPayment: captured,
      vnpayPaymentAdapter: adapter,
    });

    await expect(
      service.closeUnmatchedBookingPayment('payment-1', 'Matching expired without a partner'),
    ).resolves.toMatchObject({
      payment: captured,
      refundRequested: true,
      released: false,
    });
    expect(prisma.refund.upsert).toHaveBeenCalledWith({
      where: { paymentId: 'payment-1' },
      create: expect.objectContaining({
        paymentId: 'payment-1',
        reason: 'Matching expired without a partner',
        status: 'REQUESTED',
      }),
      update: {},
    });
    expect(adapter.release).not.toHaveBeenCalled();
  });

  it('attaches maker and approver context when finance accepts an automatic refund request', async () => {
    const adapter = gatewayAdapter(PaymentMethod.VNPAY);
    adapter.refund.mockResolvedValueOnce({
      status: PaymentStatus.REFUNDED,
      providerFinalized: false,
      rawMeta: { gatewayTransactionStatus: '05' },
    });
    const captured = payment({ method: PaymentMethod.VNPAY, status: PaymentStatus.CAPTURED });
    const { prisma, service } = createService({
      existingPayment: captured,
      existingRefund: {
        id: 'refund-1',
        metadata: { source: 'UNMATCHED_BOOKING_CLOSE' },
        status: 'REQUESTED',
      },
      vnpayPaymentAdapter: adapter,
    });

    await service.refund('admin-1', 'payment-1', { approvalAdminId: 'finance-admin-2' });

    expect(prisma.refund.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'refund-1' },
      data: {
        metadata: expect.objectContaining({
          source: 'UNMATCHED_BOOKING_CLOSE',
          actorId: 'admin-1',
          approvalAdminId: 'finance-admin-2',
          occurredAt: expect.any(String),
        }),
      },
    });
    expect(prisma.refund.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'refund-1' },
      data: expect.objectContaining({ status: 'PROVIDER_PROCESSING' }),
    });
  });

  it('keeps a failed gateway refund requested without changing payment or booking state', async () => {
    const adapter = gatewayAdapter(PaymentMethod.MOMO);
    adapter.refund.mockRejectedValueOnce(new Error('gateway timeout'));
    const { prisma, service } = createService({
      existingPayment: payment({
        method: PaymentMethod.MOMO,
        providerRef: 'booking-1',
        status: PaymentStatus.CAPTURED,
      }),
      momoPaymentAdapter: adapter,
    });

    await expect(
      service.refund('admin-1', 'payment-1', { approvalAdminId: 'finance-admin-2' }),
    ).rejects.toThrow('gateway timeout');

    expect(prisma.refund.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ paymentId: 'payment-1', status: 'REQUESTED' }),
    });
    expect(prisma.refund.update).toHaveBeenCalledWith({
      where: { id: 'refund-1' },
      data: expect.objectContaining({
        status: 'REQUESTED',
        metadata: expect.objectContaining({
          gatewayLastError: 'gateway timeout',
          gatewayLastErrorAt: expect.any(String),
        }),
      }),
    });
    expect(prisma.payment.updateMany).not.toHaveBeenCalled();
    expect(prisma.booking.update).not.toHaveBeenCalled();
  });

  it('keeps an accepted provider-processing refund out of payment and ledger completion', async () => {
    const adapter = gatewayAdapter(PaymentMethod.MOMO);
    adapter.refund.mockResolvedValueOnce({
      status: PaymentStatus.PENDING,
      providerFinalized: false,
      rawMeta: { providerRefundState: 'PROCESSING' },
    });
    const captured = payment({
      method: PaymentMethod.MOMO,
      providerRef: 'booking-1',
      status: PaymentStatus.CAPTURED,
    });
    const admin = { writeAudit: vi.fn() };
    const earnings = { cancelForRefund: vi.fn() };
    const settlements = { reverseBookingSettlementSnapshotForRefund: vi.fn() };
    const { prisma, refundQueue, service } = createService({
      admin,
      earnings,
      existingPayment: captured,
      momoPaymentAdapter: adapter,
      settlements,
      updatedPayment: { ...captured, refunds: [{ id: 'refund-1', status: 'PROVIDER_PROCESSING' }] } as never,
    });

    await expect(
      service.refund('admin-1', 'payment-1', { approvalAdminId: 'finance-admin-2' }),
    ).resolves.toEqual(expect.objectContaining({ status: PaymentStatus.CAPTURED }));

    expect(prisma.refund.update).toHaveBeenCalledWith({
      where: { id: 'refund-1' },
      data: expect.objectContaining({
        status: 'PROVIDER_PROCESSING',
        metadata: expect.objectContaining({
          providerAcceptedAt: expect.any(String),
          providerRefundState: 'PROCESSING',
        }),
      }),
    });
    expect(refundQueue.add).toHaveBeenCalledWith(
      'payment-refund-status',
      { refundId: 'refund-1' },
      expect.objectContaining({ jobId: 'payment-refund-status-refund-1' }),
    );
    expect(prisma.payment.updateMany).not.toHaveBeenCalled();
    expect(prisma.booking.update).not.toHaveBeenCalled();
    expect(settlements.reverseBookingSettlementSnapshotForRefund).not.toHaveBeenCalled();
    expect(earnings.cancelForRefund).not.toHaveBeenCalled();
    expect(admin.writeAudit).toHaveBeenCalledWith(
      'admin-1',
      'payment.refund.provider-processing',
      'payment:payment-1',
      expect.objectContaining({ approvalAdminId: 'finance-admin-2', refundId: 'refund-1' }),
    );
  });

  it('leaves provider-processing recovery pending without financial side effects', async () => {
    const captured = payment({
      method: PaymentMethod.MOMO,
      providerRef: 'booking-1',
      status: PaymentStatus.CAPTURED,
    });
    const adapter = gatewayAdapter(PaymentMethod.MOMO);
    adapter.checkRefund.mockResolvedValueOnce({
      status: PaymentStatus.PENDING,
      providerFinalized: false,
      rawMeta: { providerRefundState: 'PROCESSING' },
    });
    const earnings = { cancelForRefund: vi.fn() };
    const settlements = { reverseBookingSettlementSnapshotForRefund: vi.fn() };
    const { prisma, service } = createService({
      earnings,
      existingPayment: captured,
      existingRefund: providerProcessingRefund(captured),
      momoPaymentAdapter: adapter,
      settlements,
    });

    await expect(service.checkAndFinalizeRefund('refund-1')).resolves.toEqual({
      completed: false,
      paymentId: 'payment-1',
      refundId: 'refund-1',
    });

    expect(prisma.refund.update).toHaveBeenCalledWith({
      where: { id: 'refund-1' },
      data: expect.objectContaining({
        status: 'PROVIDER_PROCESSING',
        metadata: expect.objectContaining({ providerLastCheckedAt: expect.any(String) }),
      }),
    });
    expect(prisma.payment.updateMany).not.toHaveBeenCalled();
    expect(settlements.reverseBookingSettlementSnapshotForRefund).not.toHaveBeenCalled();
    expect(earnings.cancelForRefund).not.toHaveBeenCalled();
  });

  it('finalizes payment and accounting only after provider refund confirmation', async () => {
    const captured = payment({
      method: PaymentMethod.MOMO,
      providerRef: 'booking-1',
      status: PaymentStatus.CAPTURED,
    });
    const refunded = { ...captured, status: PaymentStatus.REFUNDED, refunds: [{ id: 'refund-1' }] };
    const adapter = gatewayAdapter(PaymentMethod.MOMO);
    adapter.checkRefund.mockResolvedValueOnce({
      status: PaymentStatus.REFUNDED,
      providerFinalized: true,
      rawMeta: { providerRefundState: 'COMPLETED' },
    });
    const admin = { writeAudit: vi.fn() };
    const earnings = { cancelForRefund: vi.fn().mockResolvedValue({ skipped: true, reason: 'NO_EARNING' }) };
    const settlements = {
      reverseBookingSettlementSnapshotForRefund: vi.fn().mockResolvedValue({
        id: 'reversal-1',
        settlementStatus: 'REVERSED',
      }),
    };
    const { prisma, service } = createService({
      admin,
      earnings,
      existingPayment: captured,
      existingRefund: providerProcessingRefund(captured),
      momoPaymentAdapter: adapter,
      settlements,
      updatedPayment: refunded as never,
    });

    await expect(service.checkAndFinalizeRefund('refund-1')).resolves.toEqual({
      completed: true,
      paymentId: 'payment-1',
      refundId: 'refund-1',
    });

    expect(prisma.refund.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'refund-1' },
      data: expect.objectContaining({ status: 'GATEWAY_CONFIRMED' }),
    });
    expect(prisma.payment.updateMany).toHaveBeenCalledWith({
      data: { status: PaymentStatus.REFUNDED },
      where: { id: 'payment-1', status: { in: [PaymentStatus.CAPTURED] } },
    });
    expect(settlements.reverseBookingSettlementSnapshotForRefund).toHaveBeenCalledOnce();
    expect(earnings.cancelForRefund).toHaveBeenCalledOnce();
    expect(admin.writeAudit).toHaveBeenCalledWith(
      'admin-1',
      'payment.refund',
      'payment:payment-1',
      expect.objectContaining({ approvalAdminId: 'finance-admin-2' }),
    );
  });

  it('fails closed when queued recovery lacks immutable approval audit context', async () => {
    const captured = payment({ status: PaymentStatus.CAPTURED });
    const { prisma, service } = createService({
      existingPayment: captured,
      existingRefund: {
        ...providerProcessingRefund(captured),
        metadata: { actorId: 'admin-1' },
      },
    });

    await expect(service.checkAndFinalizeRefund('refund-1')).rejects.toThrow(
      'Refund refund-1 is missing immutable approval audit context',
    );
    expect(prisma.payment.updateMany).not.toHaveBeenCalled();
  });

  it('resumes a gateway-confirmed refund without submitting it to the gateway again', async () => {
    const adapter = gatewayAdapter(PaymentMethod.MOMO);
    const refunded = {
      ...payment({
        method: PaymentMethod.MOMO,
        providerRef: 'booking-1',
        status: PaymentStatus.REFUNDED,
      }),
      refunds: [{ id: 'refund-1', status: 'COMPLETED' }],
    };
    const { prisma, service } = createService({
      earnings: {
        cancelForRefund: vi.fn().mockResolvedValue({ skipped: true, reason: 'NO_EARNING' }),
      },
      existingPayment: payment({
        method: PaymentMethod.MOMO,
        providerRef: 'booking-1',
        status: PaymentStatus.CAPTURED,
      }),
      existingRefund: {
        id: 'refund-1',
        metadata: { gatewayTransactionId: 'momo-refund-tx-1' },
        status: 'GATEWAY_CONFIRMED',
      },
      momoPaymentAdapter: adapter,
      updatedPayment: refunded,
    });

    await expect(
      service.refund('admin-1', 'payment-1', { approvalAdminId: 'finance-admin-2' }),
    ).resolves.toEqual(refunded);

    expect(adapter.refund).not.toHaveBeenCalled();
    expect(prisma.refund.create).not.toHaveBeenCalled();
    expect(prisma.refund.update).toHaveBeenCalledWith({
      where: { id: 'refund-1' },
      data: expect.objectContaining({ status: 'COMPLETED' }),
    });
  });
});

function createService({
  admin,
  earnings,
  existingPayment,
  existingRefund,
  notificationLookupPayment,
  notifications,
  settlements,
  updatedPayment,
  updateCount = 1,
  cashPaymentAdapter,
  momoPaymentAdapter,
  vnpayPaymentAdapter,
}: {
  admin?: { writeAudit: ReturnType<typeof vi.fn> };
  earnings?: { cancelForRefund: ReturnType<typeof vi.fn> };
  existingPayment: ReturnType<typeof payment> | null;
  existingRefund?: { id: string; metadata: Record<string, unknown>; status: string } | null;
  notificationLookupPayment?: unknown;
  notifications?: { create: ReturnType<typeof vi.fn> };
  settlements?: { reverseBookingSettlementSnapshotForRefund: ReturnType<typeof vi.fn> };
  updatedPayment?: ReturnType<typeof payment>;
  updateCount?: number;
  cashPaymentAdapter?: ReturnType<typeof cashAdapter>;
  momoPaymentAdapter?: ReturnType<typeof gatewayAdapter>;
  vnpayPaymentAdapter?: ReturnType<typeof gatewayAdapter>;
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
      findUniqueOrThrow: vi.fn().mockResolvedValue(updatedPayment ?? existingPayment),
      update: vi.fn().mockResolvedValue(updatedPayment ?? existingPayment),
      updateMany: vi.fn().mockResolvedValue({ count: updateCount }),
    },
    booking: {
      update: vi.fn(),
    },
    refund: {
      findUnique: vi.fn().mockResolvedValue(existingRefund ?? null),
      create: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'refund-1',
        ...data,
      })),
      update: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'refund-1',
        ...data,
      })),
      upsert: vi.fn().mockImplementation(async ({ create }: { create: Record<string, unknown> }) => ({
        id: 'refund-1',
        ...create,
      })),
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
  const refundQueue = { add: vi.fn() };

  return {
    config,
    prisma,
    queue,
    refundQueue,
    service: new PaymentsService(
      prisma as never,
      config as never,
      (admin ?? { writeAudit: vi.fn() }) as never,
      (earnings ?? { cancelForRefund: vi.fn() }) as never,
      (momoPaymentAdapter ?? placeholderAdapter(PaymentMethod.MOMO)) as never,
      (vnpayPaymentAdapter ?? placeholderAdapter(PaymentMethod.VNPAY)) as never,
      placeholderAdapter(PaymentMethod.CARD) as never,
      (cashPaymentAdapter ?? cashAdapter()) as never,
      queue as never,
      refundQueue as never,
      notifications as never,
      (settlements ?? { reverseBookingSettlementSnapshotForRefund: vi.fn() }) as never,
    ),
  };
}

function payment({
  status,
  method = PaymentMethod.CASH,
  providerRef = 'cash-booking-1',
}: {
  status: PaymentStatus;
  method?: PaymentMethod;
  providerRef?: string | null;
}) {
  return {
    amount: 300000,
    bookingId: 'booking-1',
    currency: 'VND',
    id: 'payment-1',
    method,
    providerRef,
    rawMeta: {},
    status,
  };
}

function cashAdapter() {
  return {
    authorize: vi.fn(async ({ bookingId, amount }: { bookingId: string; amount: number }) => ({
      amount,
      method: PaymentMethod.CASH,
      providerRef: `cash-${bookingId}`,
      rawMeta: { providerRef: `cash-${bookingId}` },
      status: PaymentStatus.AUTHORIZED,
    })),
    checkStatus: vi.fn(async () => ({ status: PaymentStatus.PENDING })),
    capture: vi.fn(async () => ({ status: PaymentStatus.CAPTURED })),
    initialAuthorization: vi.fn(() => ({
      method: PaymentMethod.CASH,
      providerRef: null,
      rawMeta: { provider: 'CASH' },
      status: PaymentStatus.PENDING,
    })),
    method: PaymentMethod.CASH,
    mode: 'INTERNAL',
    parseCallback: vi.fn((payload: unknown) => {
      const body = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
      return {
        providerRef: String(body.providerRef ?? ''),
        rawMeta: body,
        status: body.status === 'CAPTURED' ? PaymentStatus.CAPTURED : PaymentStatus.AUTHORIZED,
      };
    }),
    release: vi.fn(async () => ({ status: PaymentStatus.RELEASED })),
    refund: vi.fn(async () => ({ status: PaymentStatus.REFUNDED })),
    checkRefund: vi.fn(async () => ({ status: PaymentStatus.REFUNDED })),
  };
}

function placeholderAdapter(method: PaymentMethod) {
  return {
    authorize: vi.fn(async () => undefined),
    checkStatus: vi.fn(async () => ({ status: PaymentStatus.PENDING })),
    capture: vi.fn(async () => ({ status: PaymentStatus.CAPTURED })),
    initialAuthorization: vi.fn(),
    method,
    mode: 'PLACEHOLDER',
    parseCallback: vi.fn(),
    release: vi.fn(async () => ({ status: PaymentStatus.RELEASED })),
    refund: vi.fn(async () => ({ status: PaymentStatus.REFUNDED })),
    checkRefund: vi.fn(async () => ({ status: PaymentStatus.REFUNDED })),
  };
}

function gatewayAdapter(method: PaymentMethod) {
  return {
    authorize: vi.fn(async ({ bookingId }: { bookingId: string }) => ({
      method,
      providerRef: bookingId,
      rawMeta: { checkoutUrl: 'https://payments.example.test/checkout' },
      status: PaymentStatus.PENDING,
    })),
    checkStatus: vi.fn(async () => ({ status: PaymentStatus.PENDING })),
    capture: vi.fn(async () => ({ status: PaymentStatus.CAPTURED })),
    initialAuthorization: vi.fn(({ bookingId }: { bookingId: string }) => ({
      method,
      providerRef: bookingId,
      rawMeta: { provider: method },
      status: PaymentStatus.PENDING,
    })),
    method,
    mode: 'GATEWAY' as const,
    parseCallback: vi.fn(),
    release: vi.fn(async () => ({ status: PaymentStatus.RELEASED })),
    refund: vi.fn(async () => ({ status: PaymentStatus.REFUNDED })),
    checkRefund: vi.fn(async () => ({ status: PaymentStatus.REFUNDED })),
  };
}

function providerProcessingRefund(paymentRecord: ReturnType<typeof payment>) {
  return {
    id: 'refund-1',
    paymentId: paymentRecord.id,
    status: 'PROVIDER_PROCESSING',
    metadata: {
      actorId: 'admin-1',
      approvalAdminId: 'finance-admin-2',
      occurredAt: '2026-07-14T07:00:00.000Z',
    },
    payment: paymentRecord,
  };
}
