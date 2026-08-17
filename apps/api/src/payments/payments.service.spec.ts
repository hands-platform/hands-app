import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  AdminOperatorPermissionCategory,
  AdminUserProvenance,
  BookingStatus,
  PaymentAdminOperationStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  Role,
} from '@prisma/client';

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
  it('returns checkout metadata only for a booking owned by the customer', async () => {
    const { prisma, service } = createService({ existingPayment: null });
    prisma.payment.findFirstOrThrow.mockResolvedValue({
      bookingId: 'booking-1',
      id: 'payment-1',
      method: PaymentMethod.MOMO,
      rawMeta: {
        authorizationState: 'READY',
        checkoutUrl: 'https://payments.example.test/checkout',
      },
      status: PaymentStatus.PENDING,
    });

    await expect(
      service.customerCheckoutAction('customer-user-1', 'booking-1'),
    ).resolves.toEqual({
      bookingId: 'booking-1',
      checkoutUrl: 'https://payments.example.test/checkout',
      method: PaymentMethod.MOMO,
      paymentId: 'payment-1',
      status: PaymentStatus.PENDING,
    });
    expect(prisma.payment.findFirstOrThrow).toHaveBeenCalledWith({
      where: {
        bookingId: 'booking-1',
        booking: { customerProfile: { userId: 'customer-user-1' } },
      },
      select: {
        bookingId: true,
        id: true,
        method: true,
        rawMeta: true,
        status: true,
      },
    });
  });

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
        removeOnFail: { count: 500 },
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
        removeOnFail: { count: 500 },
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
      where: {
        id: 'payment-1',
        rawMeta: { path: ['authorizationState'], equals: 'PENDING' },
        status: { in: [PaymentStatus.PENDING, PaymentStatus.AUTHORIZED] },
      },
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

  it('does not start a second gateway checkout after another caller claims authorization', async () => {
    const existingPayment = payment({
      method: PaymentMethod.MOMO,
      providerRef: null,
      status: PaymentStatus.PENDING,
    });
    const claimedPayment = {
      ...existingPayment,
      providerRef: 'booking-1',
      rawMeta: { authorizationState: 'INITIALIZING' },
    };
    const adapter = gatewayAdapter(PaymentMethod.MOMO);
    const { prisma, service } = createService({
      existingPayment,
      momoPaymentAdapter: adapter,
      updatedPayment: claimedPayment,
    });
    prisma.payment.updateMany.mockResolvedValueOnce({ count: 0 });
    prisma.payment.findUniqueOrThrow
      .mockReset()
      .mockResolvedValueOnce(existingPayment)
      .mockResolvedValueOnce(claimedPayment);

    await expect(service.refreshAuthorizationForBooking('payment-1', 'booking-1')).resolves.toEqual(
      claimedPayment,
    );

    expect(adapter.authorize).not.toHaveBeenCalled();
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
    const { prisma, service } = createMomoCallbackService({
      existingPayment: payment({ status: PaymentStatus.AUTHORIZED }),
      updatedPayment: payment({ status: PaymentStatus.CAPTURED }),
    });

    const result = await service.handleCallback(PaymentMethod.MOMO, {
      amount: 300000,
      orderId: 'momo-booking-1',
      signature: 'gateway-signature',
      status: 'CAPTURED',
      vnp_SecureHash: 'gateway-secure-hash',
    });

    expect(result).toEqual({ ok: true, replay: false });
    expect(prisma.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rawMeta: expect.objectContaining({
            amount: 300000,
            callbackSignatureVerified: false,
            callbackVerificationMode: 'dev-unverified',
            orderId: 'momo-booking-1',
          }),
          status: PaymentStatus.CAPTURED,
        }),
        where: { id: 'payment-1', status: { in: [PaymentStatus.AUTHORIZED] } },
      }),
    );
    expect(prisma.paymentCallbackAttempt.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        method: PaymentMethod.MOMO,
        outcome: 'ACCEPTED',
        paymentId: 'payment-1',
        providerRef: 'momo-booking-1',
        providerStatus: PaymentStatus.CAPTURED,
        rawPayload: {
          amount: 300000,
          orderId: 'momo-booking-1',
          status: 'CAPTURED',
        },
        signatureVerified: false,
        verificationMode: 'dev-unverified',
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
    const { service } = createMomoCallbackService({
      existingPayment: payment({ status: PaymentStatus.AUTHORIZED }),
      notificationLookupPayment: {
        id: 'payment-1',
        bookingId: 'booking-1',
        booking: { customerProfile: { userId: 'customer-user' } },
      },
      notifications,
      updatedPayment: payment({ status: PaymentStatus.CAPTURED }),
    });

    await service.handleCallback(PaymentMethod.MOMO, {
      amount: 300000,
      orderId: 'momo-booking-1',
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
    const { prisma, service } = createMomoCallbackService({
      existingPayment: payment({ status: PaymentStatus.CAPTURED }),
    });

    const result = await service.handleCallback(PaymentMethod.MOMO, {
      amount: 300000,
      orderId: 'momo-booking-1',
      status: 'CAPTURED',
    });

    expect(result).toEqual({ ok: true, replay: true });
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
    const { prisma, service } = createMomoCallbackService({
      existingPayment: payment({ status: PaymentStatus.RELEASED }),
    });

    await expect(
      service.handleCallback(PaymentMethod.MOMO, {
        amount: 300000,
        orderId: 'momo-booking-1',
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
    const { prisma, service } = createMomoCallbackService({ existingPayment: null });

    await expect(
      service.handleCallback(PaymentMethod.MOMO, {
        orderId: 'missing-payment',
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

  it('rejects a callback without a gateway amount before changing payment state', async () => {
    const { prisma, service } = createMomoCallbackService({
      existingPayment: payment({ status: PaymentStatus.AUTHORIZED }),
    });

    await expect(
      service.handleCallback(PaymentMethod.MOMO, {
        orderId: 'momo-booking-1',
        status: 'CAPTURED',
      }),
    ).rejects.toThrow('Payment callback amount is required');

    expect(prisma.payment.updateMany).not.toHaveBeenCalled();
  });

  it('does not notify when accepted callback evidence cannot be committed', async () => {
    const notifications = { create: vi.fn() };
    const { prisma, service } = createMomoCallbackService({
      existingPayment: payment({ status: PaymentStatus.AUTHORIZED }),
      notifications,
      updatedPayment: payment({ status: PaymentStatus.CAPTURED }),
    });
    prisma.paymentCallbackAttempt.create
      .mockRejectedValueOnce(new Error('audit storage unavailable'))
      .mockResolvedValueOnce({ id: 'rejected-attempt-1' });

    await expect(
      service.handleCallback(PaymentMethod.MOMO, {
        amount: 300000,
        orderId: 'momo-booking-1',
        status: 'CAPTURED',
      }),
    ).rejects.toThrow('audit storage unavailable');

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.paymentCallbackAttempt.create).toHaveBeenCalledTimes(2);
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('fails closed when neither accepted nor rejected callback evidence can be persisted', async () => {
    const notifications = { create: vi.fn() };
    const { prisma, service } = createMomoCallbackService({
      existingPayment: payment({ status: PaymentStatus.AUTHORIZED }),
      notifications,
      updatedPayment: payment({ status: PaymentStatus.CAPTURED }),
    });
    prisma.paymentCallbackAttempt.create.mockRejectedValue(new Error('audit storage unavailable'));

    await expect(
      service.handleCallback(PaymentMethod.MOMO, {
        amount: 300000,
        orderId: 'momo-booking-1',
        status: 'CAPTURED',
      }),
    ).rejects.toThrow('Payment callback evidence is temporarily unavailable');

    expect(prisma.paymentCallbackAttempt.create).toHaveBeenCalledTimes(2);
    expect(notifications.create).not.toHaveBeenCalled();
  });
});

describe('PaymentsService refunds', () => {
  it('creates a durable refund request without touching the gateway, payment, booking, or accounting', async () => {
    const admin = { writeAudit: vi.fn() };
    const earnings = { cancelForRefund: vi.fn() };
    const settlements = { reverseBookingSettlementSnapshotForRefund: vi.fn() };
    const adapter = gatewayAdapter(PaymentMethod.MOMO);
    const captured = payment({ method: PaymentMethod.MOMO, status: PaymentStatus.CAPTURED });
    const { prisma, service } = createService({
      admin,
      earnings,
      existingPayment: captured,
      existingRefund: null,
      momoPaymentAdapter: adapter,
      settlements,
      updatedPayment: { ...captured, refunds: [{ id: 'refund-1', status: 'REQUESTED' }] } as never,
    });

    await expect(
      service.requestRefund('admin-1', 'payment-1', { reason: 'Customer cancellation evidence reviewed' }),
    ).resolves.toEqual(expect.objectContaining({ status: PaymentStatus.CAPTURED }));

    expect(prisma.refund.upsert).toHaveBeenCalledWith({
      where: { paymentId: 'payment-1' },
      create: expect.objectContaining({
        paymentId: 'payment-1',
        reason: 'Customer cancellation evidence reviewed',
        status: 'REQUESTED',
        metadata: expect.objectContaining({
          requestedByAdminId: 'admin-1',
          source: 'ADMIN_MANUAL',
          requestedAt: expect.any(String),
        }),
      }),
      update: {},
    });
    expect(adapter.refund).not.toHaveBeenCalled();
    expect(prisma.payment.updateMany).not.toHaveBeenCalled();
    expect(prisma.booking.update).not.toHaveBeenCalled();
    expect(settlements.reverseBookingSettlementSnapshotForRefund).not.toHaveBeenCalled();
    expect(earnings.cancelForRefund).not.toHaveBeenCalled();
    expect(admin.writeAudit).toHaveBeenCalledWith(
      'admin-1',
      'payment.refund.request',
      'payment:payment-1',
      expect.objectContaining({ refundId: 'refund-1' }),
      undefined,
      prisma,
    );
  });

  it('rejects a refund request while the booking lifecycle is still active', async () => {
    const captured = payment({ method: PaymentMethod.MOMO, status: PaymentStatus.CAPTURED });
    const adapter = gatewayAdapter(PaymentMethod.MOMO);
    const { prisma, service } = createService({
      bookingStatus: BookingStatus.IN_SERVICE,
      existingPayment: captured,
      existingRefund: null,
      momoPaymentAdapter: adapter,
    });

    await expect(service.requestRefund('admin-1', captured.id)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'BOOKING_NOT_REFUNDABLE' }),
    });

    expect(prisma.refund.upsert).not.toHaveBeenCalled();
    expect(adapter.refund).not.toHaveBeenCalled();
    expect(prisma.payment.updateMany).not.toHaveBeenCalled();
  });

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
      service.refund('support-user-2', 'payment-1'),
    ).rejects.toThrow('Payment refund requires approval from a finance approver');

    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'support-user-2' } }),
    );
    expect(prisma.payment.updateMany).not.toHaveBeenCalled();
    expect(settlements.reverseBookingSettlementSnapshotForRefund).not.toHaveBeenCalled();
    expect(earnings.cancelForRefund).not.toHaveBeenCalled();
    expect(admin.writeAudit).not.toHaveBeenCalled();
  });

  it('rejects a requested refund through an independent finance approver without money side effects', async () => {
    const admin = { writeAudit: vi.fn() };
    const earnings = { cancelForRefund: vi.fn() };
    const settlements = { reverseBookingSettlementSnapshotForRefund: vi.fn() };
    const adapter = gatewayAdapter(PaymentMethod.MOMO);
    const captured = payment({ method: PaymentMethod.MOMO, status: PaymentStatus.CAPTURED });
    const { prisma, service } = createService({
      admin,
      earnings,
      existingPayment: captured,
      momoPaymentAdapter: adapter,
      settlements,
    });

    await expect(
      service.rejectRefund('finance-admin-2', 'refund-1', 'Chat evidence does not support a refund'),
    ).resolves.toEqual({
      id: 'refund-1',
      paymentId: 'payment-1',
      status: 'REJECTED',
    });

    expect(prisma.refund.updateMany).toHaveBeenCalledWith({
      where: { id: 'refund-1', status: 'REQUESTED' },
      data: {
        status: 'REJECTED',
        metadata: expect.objectContaining({
          rejectionAdminId: 'finance-admin-2',
          rejectionReason: 'Chat evidence does not support a refund',
          rejectedAt: expect.any(String),
          requestedByAdminId: 'admin-1',
        }),
      },
    });
    expect(adapter.refund).not.toHaveBeenCalled();
    expect(prisma.payment.updateMany).not.toHaveBeenCalled();
    expect(prisma.booking.update).not.toHaveBeenCalled();
    expect(settlements.reverseBookingSettlementSnapshotForRefund).not.toHaveBeenCalled();
    expect(earnings.cancelForRefund).not.toHaveBeenCalled();
    expect(admin.writeAudit).toHaveBeenCalledWith(
      'finance-admin-2',
      'payment.refund.reject',
      'payment:payment-1',
      expect.objectContaining({
        reason: 'Chat evidence does not support a refund',
        refundId: 'refund-1',
        requestedByAdminId: 'admin-1',
      }),
      undefined,
      prisma,
    );
  });

  it('blocks the refund maker from rejecting their own request', async () => {
    const admin = { writeAudit: vi.fn() };
    const { prisma, service } = createService({
      admin,
      existingPayment: payment({ status: PaymentStatus.CAPTURED }),
    });

    await expect(
      service.rejectRefund('admin-1', 'refund-1', 'Customer evidence is incomplete'),
    ).rejects.toThrow('Payment refund requires approval from a different admin');

    expect(prisma.refund.updateMany).not.toHaveBeenCalled();
    expect(admin.writeAudit).not.toHaveBeenCalled();
  });

  it('stops a concurrently claimed approval before calling the payment provider', async () => {
    const admin = { writeAudit: vi.fn() };
    const adapter = gatewayAdapter(PaymentMethod.MOMO);
    const { prisma, service } = createService({
      admin,
      existingPayment: payment({ method: PaymentMethod.MOMO, status: PaymentStatus.CAPTURED }),
      momoPaymentAdapter: adapter,
    });
    prisma.refund.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.refund('finance-admin-2', 'payment-1'),
    ).rejects.toThrow('Refund refund-1 approval was already claimed');

    expect(adapter.refund).not.toHaveBeenCalled();
    expect(prisma.payment.updateMany).not.toHaveBeenCalled();
    expect(prisma.booking.update).not.toHaveBeenCalled();
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
      service.refund('finance-admin-2', 'payment-1'),
    ).resolves.toEqual(refundedPayment);

    expect(prisma.payment.updateMany).toHaveBeenCalledWith({
      data: { status: PaymentStatus.REFUNDED },
      where: { id: 'payment-1', status: { in: [PaymentStatus.CAPTURED] } },
    });
    expect(prisma.booking.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'booking-1',
        status: {
          in: [
            BookingStatus.COMPLETED,
            BookingStatus.CANCELLED,
            BookingStatus.NO_SHOW,
            BookingStatus.EXPIRED,
            BookingStatus.REFUNDED,
          ],
        },
      },
      data: { status: BookingStatus.REFUNDED },
    });
    expect(prisma.$queryRaw).toHaveBeenCalledWith(
      expect.objectContaining({
        strings: expect.arrayContaining([expect.stringContaining('FROM "Booking"')]),
      }),
    );
    expect(prisma.refund.updateMany).toHaveBeenCalledWith({
      where: { id: 'refund-1', status: 'REQUESTED' },
      data: {
        status: 'APPROVAL_PROCESSING',
        metadata: expect.objectContaining({
          requestedByAdminId: 'admin-1',
          approvalAdminId: 'finance-admin-2',
          occurredAt: expect.any(String),
        }),
      },
    });
    expect(admin.writeAudit).toHaveBeenCalledWith(
      'finance-admin-2',
      'payment.refund.approval.claim',
      'payment:payment-1',
      expect.objectContaining({
        approvalAdminId: 'finance-admin-2',
        refundId: 'refund-1',
        requestedByAdminId: 'admin-1',
      }),
      undefined,
      prisma,
    );
    expect(prisma.refund.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'refund-1',
        status: { in: ['APPROVAL_PROCESSING', 'PROVIDER_PROCESSING'] },
      },
      data: expect.objectContaining({
        status: 'GATEWAY_CONFIRMED',
        metadata: expect.objectContaining({ gatewayConfirmedAt: expect.any(String) }),
      }),
    });
    expect(prisma.refund.updateMany).toHaveBeenCalledWith({
      where: { id: 'refund-1', status: 'GATEWAY_CONFIRMED' },
      data: expect.objectContaining({
        status: 'COMPLETED',
        metadata: expect.objectContaining({ completedAt: expect.any(String) }),
      }),
    });
    expect(settlements.reverseBookingSettlementSnapshotForRefund).toHaveBeenCalledWith({
      actorId: 'finance-admin-2',
      bookingId: 'booking-1',
      occurredAt: expect.any(Date),
      reason: 'Admin manual refund',
    }, expect.objectContaining({ payment: expect.any(Object) }));
    expect(earnings.cancelForRefund).toHaveBeenCalledWith(
      'booking-1',
      expect.objectContaining({ payment: expect.any(Object) }),
    );
    expect(admin.writeAudit).toHaveBeenCalledWith(
      'finance-admin-2',
      'payment.refund',
      'payment:payment-1',
      expect.objectContaining({
        approvalAdminId: 'finance-admin-2',
        requestedByAdminId: 'admin-1',
        earningCancellation: { skipped: false, earningId: 'earning-1' },
        settlementReversal: expect.objectContaining({ settlementStatus: 'REVERSED' }),
      }),
      undefined,
      expect.objectContaining({ payment: expect.any(Object) }),
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
    await service.refund('finance-admin-2', 'payment-1');

    expect(admin.writeAudit).toHaveBeenCalledWith(
      'finance-admin-2',
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
      undefined,
      expect.objectContaining({ payment: expect.any(Object) }),
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
      service.refund('finance-admin-2', 'payment-1'),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.refund.create).not.toHaveBeenCalled();
    expect(prisma.booking.update).not.toHaveBeenCalled();
    expect(settlements.reverseBookingSettlementSnapshotForRefund).not.toHaveBeenCalled();
    expect(earnings.cancelForRefund).not.toHaveBeenCalled();
    expect(admin.writeAudit).not.toHaveBeenCalled();
  });
});

describe('PaymentsService conditional transitions', () => {
  it.each([
    ['capture', (service: PaymentsService) => service.captureForAdmin('support-user-2', 'payment-1', {
      idempotencyKey: 'capture-payment-1',
      reason: 'Manual capture',
    })],
    ['release', (service: PaymentsService) => service.releaseForAdmin('support-user-2', 'payment-1', {
      idempotencyKey: 'release-payment-1',
      reason: 'Manual release',
    })],
  ])('rejects admin %s by an operator without finance approver authority', async (_action, execute) => {
    const authorized = payment({ status: PaymentStatus.AUTHORIZED });
    const { prisma, service } = createService({ existingPayment: authorized });
    prisma.user.findFirst.mockResolvedValueOnce({
      id: 'support-user-2',
      email: 'support-user-2@hands.test',
      fullName: 'Support User 2',
      roles: [Role.ADMIN],
      updatedAt: new Date('2026-08-14T00:00:00.000Z'),
      adminUserProvenance: AdminUserProvenance.PRODUCTION,
      fixtureKind: null,
      fixtureRunId: null,
      fixtureExpiresAt: null,
      adminOperatorCredential: {
        disabledAt: null,
        lastLoginAt: new Date('2026-08-14T00:00:00.000Z'),
        lockedUntil: null,
        mfaState: 'VERIFIED',
        setupCompletedAt: new Date('2026-08-01T00:00:00.000Z'),
      },
      adminOperatorPermission: {
        categories: [AdminOperatorPermissionCategory.FINANCE],
        updatedAt: new Date('2026-08-14T00:00:00.000Z'),
        version: 1,
      },
      financeApproverRequestsTargeted: [],
    });

    await expect(execute(service)).rejects.toThrow(
      `Payment ${_action} requires approval from a finance approver`,
    );
    expect(prisma.paymentAdminOperationClaim.create).not.toHaveBeenCalled();
  });

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

  it('confirms gateway capture before booking completion can commit the captured payment state', async () => {
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

    await expect(
      service.confirmGatewayCaptureForBookingCompletion('partner-user-1', 'booking-1'),
    ).resolves.toEqual(captured);

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

  it('leaves internal booking payments for the completion transaction to capture', async () => {
    const internal = payment({ method: PaymentMethod.CASH, status: PaymentStatus.PENDING });
    const adapter = cashAdapter();
    const { prisma, service } = createService({
      cashPaymentAdapter: adapter,
      existingPayment: internal,
    });

    await expect(
      service.confirmGatewayCaptureForBookingCompletion('partner-user-1', 'booking-1'),
    ).resolves.toEqual(internal);

    expect(adapter.capture).not.toHaveBeenCalled();
    expect(prisma.payment.updateMany).not.toHaveBeenCalled();
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

  it('calls the provider outside a database transaction and conditionally persists release', async () => {
    const authorized = payment({ method: PaymentMethod.CASH, status: PaymentStatus.AUTHORIZED });
    const released = payment({ method: PaymentMethod.CASH, status: PaymentStatus.RELEASED });
    const adapter = cashAdapter();
    const { prisma, service } = createService({
      cashPaymentAdapter: adapter,
      existingPayment: authorized,
      updatedPayment: released,
    });
    prisma.payment.findUniqueOrThrow.mockResolvedValueOnce(authorized).mockResolvedValue(released);

    await expect(service.release('payment-1')).resolves.toEqual(released);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(adapter.release).toHaveBeenCalledOnce();
    expect(adapter.release.mock.invocationCallOrder[0]).toBeLessThan(
      prisma.payment.updateMany.mock.invocationCallOrder[0],
    );
  });

  it('releases an unmatched customer wallet reservation with an exact compensating ledger entry', async () => {
    const authorized = payment({ method: PaymentMethod.CUSTOMER_WALLET, status: PaymentStatus.AUTHORIZED });
    const released = payment({ method: PaymentMethod.CUSTOMER_WALLET, status: PaymentStatus.RELEASED });
    const { prisma, service } = createService({ existingPayment: authorized, updatedPayment: released });
    prisma.payment.findUniqueOrThrow
      .mockResolvedValueOnce(authorized)
      .mockResolvedValueOnce(authorized)
      .mockResolvedValue(released);

    await expect(service.release('payment-1')).resolves.toEqual(released);

    expect(prisma.customerWalletLedgerEntry.upsert).toHaveBeenCalledWith({
      where: { sourceKey: 'customer-wallet-payment:booking-1:release' },
      update: {},
      create: expect.objectContaining({
        amount: 300_000,
        bookingId: 'booking-1',
        sourceKey: 'customer-wallet-payment:booking-1:release',
        type: 'REFUND',
      }),
    });
    expect(prisma.payment.updateMany).toHaveBeenCalledWith({
      data: { status: PaymentStatus.RELEASED },
      where: { id: 'payment-1', status: { in: [PaymentStatus.AUTHORIZED] } },
    });
  });

  it('uses a short internal transaction when closing an unmatched customer wallet payment', async () => {
    const authorized = payment({ method: PaymentMethod.CUSTOMER_WALLET, status: PaymentStatus.AUTHORIZED });
    const released = payment({ method: PaymentMethod.CUSTOMER_WALLET, status: PaymentStatus.RELEASED });
    const { prisma, service } = createService({ existingPayment: authorized, updatedPayment: released });
    prisma.payment.findUniqueOrThrow
      .mockResolvedValueOnce(authorized)
      .mockResolvedValueOnce(authorized)
      .mockResolvedValueOnce(authorized)
      .mockResolvedValue(released);

    await expect(
      service.closeUnmatchedBookingPayment(
        'payment-1',
        'Post-match cancellation approved',
        { source: 'ADMIN_POST_MATCH_CANCELLATION' },
      ),
    ).resolves.toMatchObject({
      payment: released,
      refundRequested: false,
      released: true,
    });

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(prisma.customerWalletLedgerEntry.upsert).toHaveBeenCalledTimes(1);
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

  it('treats terminal unmatched payment closure as idempotent', async () => {
    const refunded = payment({ method: PaymentMethod.CARD, status: PaymentStatus.REFUNDED });
    const { service } = createService({
      existingPayment: refunded,
    });

    await expect(
      service.closeUnmatchedBookingPayment('payment-1', 'Duplicate cancellation closure'),
    ).resolves.toEqual({
      payment: refunded,
      refundRequested: true,
      released: false,
    });
  });

  it('restores a completed customer wallet payment exactly once during the refund transaction', async () => {
    const captured = payment({ method: PaymentMethod.CUSTOMER_WALLET, status: PaymentStatus.CAPTURED });
    const refunded = payment({ method: PaymentMethod.CUSTOMER_WALLET, status: PaymentStatus.REFUNDED });
    const settlements = { reverseBookingSettlementSnapshotForRefund: vi.fn().mockResolvedValue({ id: 'reversal-1' }) };
    const earnings = { cancelForRefund: vi.fn().mockResolvedValue({ cancelled: true }) };
    const { prisma, service } = createService({
      earnings,
      existingPayment: captured,
      settlements,
      updatedPayment: refunded,
    });

    await expect(
      service.refund('finance-admin-2', 'payment-1'),
    ).resolves.toEqual(refunded);

    expect(settlements.reverseBookingSettlementSnapshotForRefund).toHaveBeenCalledWith(
      expect.objectContaining({ bookingId: 'booking-1', reason: 'Admin manual refund' }),
      prisma,
    );
    expect(prisma.customerWalletLedgerEntry.upsert).toHaveBeenCalledWith({
      where: { sourceKey: 'customer-wallet-payment:booking-1:refund' },
      update: {},
      create: expect.objectContaining({
        amount: 300_000,
        bookingId: 'booking-1',
        sourceKey: 'customer-wallet-payment:booking-1:refund',
        type: 'REFUND',
      }),
    });
    expect(earnings.cancelForRefund).toHaveBeenCalledWith('booking-1', prisma);
  });

  it('attaches the authenticated approver context when finance accepts an automatic system refund request', async () => {
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

    await service.refund('finance-admin-2', 'payment-1');

    expect(prisma.refund.updateMany).toHaveBeenCalledWith({
      where: { id: 'refund-1', status: 'REQUESTED' },
      data: {
        status: 'APPROVAL_PROCESSING',
        metadata: expect.objectContaining({
          source: 'UNMATCHED_BOOKING_CLOSE',
          approvalAdminId: 'finance-admin-2',
          occurredAt: expect.any(String),
        }),
      },
    });
    expect(prisma.refund.updateMany).toHaveBeenCalledWith({
      where: { id: 'refund-1', status: { in: ['APPROVAL_PROCESSING'] } },
      data: expect.objectContaining({ status: 'PROVIDER_PROCESSING' }),
    });
  });

  it('keeps an uncertain gateway refund in recovery state without changing payment or booking state', async () => {
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
      service.refund('finance-admin-2', 'payment-1'),
    ).rejects.toThrow('gateway timeout');

    expect(prisma.refund.updateMany).toHaveBeenCalledWith({
      where: { id: 'refund-1', status: 'REQUESTED' },
      data: expect.objectContaining({ status: 'APPROVAL_PROCESSING' }),
    });
    expect(prisma.refund.updateMany).toHaveBeenCalledWith({
      where: { id: 'refund-1', status: 'APPROVAL_PROCESSING' },
      data: expect.objectContaining({
        metadata: expect.objectContaining({
          gatewayLastError: 'gateway timeout',
          gatewayLastErrorAt: expect.any(String),
          gatewayRecoveryRequired: true,
          gatewayResultUncertain: true,
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
      service.refund('finance-admin-2', 'payment-1'),
    ).resolves.toEqual(expect.objectContaining({ status: PaymentStatus.CAPTURED }));

    expect(prisma.refund.updateMany).toHaveBeenCalledWith({
      where: { id: 'refund-1', status: { in: ['APPROVAL_PROCESSING'] } },
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
      'finance-admin-2',
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

    expect(prisma.refund.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'refund-1',
        status: { in: ['APPROVAL_PROCESSING', 'PROVIDER_PROCESSING'] },
      },
      data: expect.objectContaining({
        status: 'PROVIDER_PROCESSING',
        metadata: expect.objectContaining({ providerLastCheckedAt: expect.any(String) }),
      }),
    });
    expect(prisma.payment.updateMany).not.toHaveBeenCalled();
    expect(settlements.reverseBookingSettlementSnapshotForRefund).not.toHaveBeenCalled();
    expect(earnings.cancelForRefund).not.toHaveBeenCalled();
  });

  it('does not regress a concurrently completed refund when a stale provider check finishes later', async () => {
    const captured = payment({
      method: PaymentMethod.MOMO,
      providerRef: 'booking-1',
      status: PaymentStatus.CAPTURED,
    });
    const processing = providerProcessingRefund(captured);
    const completed = { ...processing, status: 'COMPLETED' };
    const adapter = gatewayAdapter(PaymentMethod.MOMO);
    adapter.checkRefund.mockResolvedValueOnce({
      status: PaymentStatus.PENDING,
      providerFinalized: false,
      rawMeta: { providerRefundState: 'PROCESSING' },
    });
    const { prisma, service } = createService({
      existingPayment: captured,
      existingRefund: processing,
      momoPaymentAdapter: adapter,
    });
    prisma.refund.updateMany.mockResolvedValueOnce({ count: 0 });
    prisma.refund.findUnique
      .mockResolvedValueOnce(processing)
      .mockResolvedValueOnce(completed);

    await expect(service.checkAndFinalizeRefund('refund-1')).resolves.toEqual({
      completed: true,
      paymentId: 'payment-1',
      refundId: 'refund-1',
    });

    expect(prisma.refund.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'refund-1',
        status: { in: ['APPROVAL_PROCESSING', 'PROVIDER_PROCESSING'] },
      },
      data: expect.objectContaining({ status: 'PROVIDER_PROCESSING' }),
    });
    expect(prisma.payment.updateMany).not.toHaveBeenCalled();
  });

  it('recovers an approval-processing refund by querying the provider without resending it', async () => {
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
    const approvalProcessing = {
      ...providerProcessingRefund(captured),
      status: 'APPROVAL_PROCESSING',
    };
    const { prisma, service } = createService({
      existingPayment: captured,
      existingRefund: approvalProcessing,
      momoPaymentAdapter: adapter,
    });

    await expect(service.checkAndFinalizeRefund('refund-1')).resolves.toEqual({
      completed: false,
      paymentId: 'payment-1',
      refundId: 'refund-1',
    });

    expect(adapter.checkRefund).toHaveBeenCalledOnce();
    expect(adapter.refund).not.toHaveBeenCalled();
    expect(prisma.refund.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'refund-1',
        status: { in: ['APPROVAL_PROCESSING', 'PROVIDER_PROCESSING'] },
      },
      data: expect.objectContaining({
        status: 'PROVIDER_PROCESSING',
        metadata: expect.objectContaining({ providerLastCheckedAt: expect.any(String) }),
      }),
    });
    expect(prisma.payment.updateMany).not.toHaveBeenCalled();
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

    expect(prisma.refund.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'refund-1',
        status: { in: ['APPROVAL_PROCESSING', 'PROVIDER_PROCESSING'] },
      },
      data: expect.objectContaining({ status: 'GATEWAY_CONFIRMED' }),
    });
    expect(prisma.payment.updateMany).toHaveBeenCalledWith({
      data: { status: PaymentStatus.REFUNDED },
      where: { id: 'payment-1', status: { in: [PaymentStatus.CAPTURED] } },
    });
    expect(settlements.reverseBookingSettlementSnapshotForRefund).toHaveBeenCalledOnce();
    const reversalOccurredAt = settlements.reverseBookingSettlementSnapshotForRefund.mock.calls[0]?.[0]
      ?.occurredAt as Date;
    expect(reversalOccurredAt).toBeInstanceOf(Date);
    expect(reversalOccurredAt.toISOString()).not.toBe('2026-07-14T07:00:00.000Z');
    expect(prisma.refund.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'refund-1', status: 'GATEWAY_CONFIRMED' },
        data: expect.objectContaining({
          metadata: expect.objectContaining({ completedAt: reversalOccurredAt.toISOString() }),
        }),
      }),
    );
    expect(earnings.cancelForRefund).toHaveBeenCalledOnce();
    expect(admin.writeAudit).toHaveBeenCalledWith(
      'finance-admin-2',
      'payment.refund',
      'payment:payment-1',
      expect.objectContaining({ approvalAdminId: 'finance-admin-2' }),
      undefined,
      expect.objectContaining({ payment: expect.any(Object) }),
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
        metadata: {
          actorId: 'admin-1',
          approvalAdminId: 'finance-admin-2',
          occurredAt: '2026-07-14T07:00:00.000Z',
          gatewayTransactionId: 'momo-refund-tx-1',
        },
        status: 'GATEWAY_CONFIRMED',
      },
      momoPaymentAdapter: adapter,
      updatedPayment: refunded,
    });

    await expect(
      service.refund('finance-admin-2', 'payment-1'),
    ).resolves.toEqual(refunded);

    expect(adapter.refund).not.toHaveBeenCalled();
    expect(prisma.refund.create).not.toHaveBeenCalled();
    expect(prisma.refund.updateMany).toHaveBeenCalledWith({
      where: { id: 'refund-1', status: 'GATEWAY_CONFIRMED' },
      data: expect.objectContaining({ status: 'COMPLETED' }),
    });
  });

  it('blocks admin capture when the booking is cancelled even if the payment is authorized', async () => {
    const adapter = gatewayAdapter(PaymentMethod.MOMO);
    const authorized = payment({
      method: PaymentMethod.MOMO,
      providerRef: 'gateway-payment-1',
      status: PaymentStatus.AUTHORIZED,
    });
    const { prisma, service } = createService({
      existingPayment: authorized,
      momoPaymentAdapter: adapter,
    });
    prisma.payment.findUnique.mockResolvedValueOnce(
      paymentActionRecord(authorized, BookingStatus.CANCELLED),
    );

    await expect(
      service.captureForAdmin('admin-1', authorized.id, {
        idempotencyKey: 'capture-cancelled-payment-1',
        reason: 'Operator reviewed booking and gateway evidence.',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'BOOKING_NOT_COMPLETED' }),
    });
    expect(adapter.capture).not.toHaveBeenCalled();
  });

  it('returns an auditable receipt and replays the same admin capture only once', async () => {
    const adapter = gatewayAdapter(PaymentMethod.MOMO);
    const authorized = payment({
      method: PaymentMethod.MOMO,
      providerRef: 'gateway-payment-1',
      status: PaymentStatus.AUTHORIZED,
    });
    const captured = { ...authorized, status: PaymentStatus.CAPTURED };
    const writeAudit = vi.fn().mockResolvedValue({ id: 'action-audit-1' });
    const { prisma, service } = createService({
      admin: { writeAudit },
      existingPayment: authorized,
      momoPaymentAdapter: adapter,
      updatedPayment: captured,
    });
    const before = paymentActionRecord(authorized, BookingStatus.COMPLETED);
    const after = paymentActionRecord(captured, BookingStatus.COMPLETED);
    prisma.payment.findUnique
      .mockResolvedValueOnce(before)
      .mockResolvedValueOnce(authorized)
      .mockResolvedValueOnce(after);

    const receipt = await service.captureForAdmin('admin-1', authorized.id, {
      idempotencyKey: 'capture-completed-payment-1',
      reason: 'Completion and signed gateway evidence were reviewed.',
    });
    prisma.adminAuditLog.findMany.mockResolvedValueOnce([
      {
        id: receipt.auditId,
        metadata: {
          idempotencyKey: receipt.idempotencyKey,
          receipt: {
            action: receipt.action,
            actorId: receipt.actorId,
            after: receipt.after,
            before: receipt.before,
            completedAt: receipt.completedAt,
            idempotencyKey: receipt.idempotencyKey,
            paymentId: receipt.paymentId,
          },
        },
      },
    ]);

    await expect(
      service.captureForAdmin('admin-1', authorized.id, {
        idempotencyKey: 'capture-completed-payment-1',
        reason: 'Completion and signed gateway evidence were reviewed.',
      }),
    ).resolves.toEqual(receipt);
    expect(adapter.capture).toHaveBeenCalledOnce();
    expect(writeAudit).toHaveBeenCalledWith(
      'admin-1',
      'payment.action_receipt',
      'payment:payment-1',
      expect.objectContaining({ idempotencyKey: 'capture-completed-payment-1' }),
    );
  });

  it('executes one provider operation when identical admin actions race', async () => {
    const adapter = gatewayAdapter(PaymentMethod.MOMO);
    const authorized = payment({
      method: PaymentMethod.MOMO,
      providerRef: 'gateway-payment-1',
      status: PaymentStatus.AUTHORIZED,
    });
    const captured = { ...authorized, status: PaymentStatus.CAPTURED };
    const { prisma, service } = createService({
      admin: { writeAudit: vi.fn().mockResolvedValue({ id: 'concurrent-action-audit-1' }) },
      existingPayment: authorized,
      momoPaymentAdapter: adapter,
      updatedPayment: captured,
    });
    prisma.payment.findUnique.mockResolvedValue(
      paymentActionRecord(authorized, BookingStatus.COMPLETED),
    );
    prisma.payment.findUniqueOrThrow
      .mockResolvedValueOnce(authorized)
      .mockResolvedValueOnce(captured);
    adapter.capture.mockImplementationOnce(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return captured;
    });

    const input = {
      idempotencyKey: 'capture-concurrent-payment-1',
      reason: 'Completion and signed gateway evidence were reviewed.',
    };
    const [first, second] = await Promise.all([
      service.captureForAdmin('admin-1', authorized.id, input),
      service.captureForAdmin('admin-1', authorized.id, input),
    ]);

    expect(first).toEqual(second);
    expect(adapter.capture).toHaveBeenCalledOnce();
    expect(prisma.paymentAdminOperationClaim.create).toHaveBeenCalledTimes(2);
  });

  it('allows admin release for a cancelled authorized gateway payment', async () => {
    const adapter = gatewayAdapter(PaymentMethod.MOMO);
    const authorized = payment({
      method: PaymentMethod.MOMO,
      providerRef: 'gateway-payment-1',
      status: PaymentStatus.AUTHORIZED,
    });
    const released = { ...authorized, status: PaymentStatus.RELEASED };
    const { prisma, service } = createService({
      admin: { writeAudit: vi.fn().mockResolvedValue({ id: 'release-audit-1' }) },
      existingPayment: authorized,
      momoPaymentAdapter: adapter,
      updatedPayment: released,
    });
    prisma.payment.findUnique
      .mockResolvedValueOnce(paymentActionRecord(authorized, BookingStatus.CANCELLED))
      .mockResolvedValueOnce(paymentActionRecord(released, BookingStatus.CANCELLED));
    prisma.payment.findUniqueOrThrow
      .mockResolvedValueOnce(authorized)
      .mockResolvedValueOnce(released);

    await expect(
      service.releaseForAdmin('admin-1', authorized.id, {
        idempotencyKey: 'release-cancelled-payment-1',
        reason: 'Cancelled booking must not retain customer authorization.',
      }),
    ).resolves.toMatchObject({
      action: 'RELEASE',
      after: { paymentStatus: PaymentStatus.RELEASED },
    });
    expect(adapter.release).toHaveBeenCalledOnce();
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
  bookingStatus = BookingStatus.COMPLETED,
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
  bookingStatus?: BookingStatus;
}) {
  const findUnique = vi.fn();
  if (notificationLookupPayment) {
    findUnique.mockResolvedValueOnce(existingPayment).mockResolvedValueOnce(notificationLookupPayment);
  } else {
    findUnique.mockResolvedValue(existingPayment);
  }
  const prisma = {
    $transaction: vi.fn(async (callback: (client: unknown) => Promise<unknown>) => callback(prisma)),
    $queryRaw: vi.fn().mockResolvedValue([{ lockResult: null }]),
    payment: {
      findFirstOrThrow: vi.fn(),
      findUnique,
      findUniqueOrThrow: vi.fn().mockResolvedValue(updatedPayment ?? existingPayment),
      update: vi.fn().mockResolvedValue(updatedPayment ?? existingPayment),
      updateMany: vi.fn().mockResolvedValue({ count: updateCount }),
    },
    booking: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({ customerProfileId: 'customer-1', status: bookingStatus }),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    customerWalletLedgerEntry: {
      findUnique: vi.fn().mockResolvedValue({
        amount: -300_000,
        id: 'wallet-reservation-1',
      }),
      upsert: vi.fn().mockResolvedValue({ id: 'wallet-release-1' }),
    },
    refund: {
      findUnique: vi.fn().mockResolvedValue(
        existingRefund === undefined ? requestedRefund() : existingRefund,
      ),
      findUniqueOrThrow: vi.fn().mockResolvedValue(
        existingRefund === undefined ? requestedRefund() : existingRefund,
      ),
      create: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'refund-1',
        ...data,
      })),
      update: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'refund-1',
        ...data,
      })),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      upsert: vi.fn().mockImplementation(async ({ create }: { create: Record<string, unknown> }) => ({
        id: 'refund-1',
        ...create,
      })),
    },
    paymentCallbackAttempt: {
      create: vi.fn(),
    },
    paymentAdminOperationClaim: paymentAdminOperationClaimDelegate(),
    adminAuditLog: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    user: {
      findFirst: vi.fn().mockResolvedValue({
        id: 'finance-admin-2',
        email: 'finance-admin-2@hands.test',
        fullName: 'Finance Admin 2',
        roles: [Role.ADMIN, Role.FINANCE_APPROVER],
        updatedAt: new Date('2026-08-14T00:00:00.000Z'),
        adminUserProvenance: AdminUserProvenance.PRODUCTION,
        fixtureKind: null,
        fixtureRunId: null,
        fixtureExpiresAt: null,
        adminOperatorCredential: {
          disabledAt: null,
          lastLoginAt: new Date('2026-08-14T00:00:00.000Z'),
          lockedUntil: null,
          mfaState: 'VERIFIED',
          setupCompletedAt: new Date('2026-08-01T00:00:00.000Z'),
        },
        adminOperatorPermission: {
          categories: [AdminOperatorPermissionCategory.FINANCE],
          updatedAt: new Date('2026-08-14T00:00:00.000Z'),
          version: 1,
        },
        financeApproverRequestsTargeted: [
          { executedAt: new Date('2026-08-01T00:00:00.000Z'), id: 'grant-1', requestedEnabled: true },
        ],
      }),
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

function createMomoCallbackService(options: Parameters<typeof createService>[0]) {
  const adapter = gatewayAdapter(PaymentMethod.MOMO);
  adapter.parseCallback.mockImplementation((payload: unknown) => {
    const body = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
    return {
      providerRef: String(body.orderId ?? ''),
      rawMeta: body,
      status: body.status === 'CAPTURED' ? PaymentStatus.CAPTURED : PaymentStatus.AUTHORIZED,
    };
  });
  const asMomoPayment = (record: ReturnType<typeof payment> | null | undefined) =>
    record
      ? { ...record, method: PaymentMethod.MOMO, providerRef: 'momo-booking-1' }
      : record;
  const fixture = createService({
    ...options,
    existingPayment: asMomoPayment(options.existingPayment) ?? null,
    updatedPayment: asMomoPayment(options.updatedPayment) ?? undefined,
    momoPaymentAdapter: adapter,
  });
  fixture.config.get.mockImplementation((key: string) => {
    if (key === 'NODE_ENV') return 'test';
    if (key === 'ALLOW_UNVERIFIED_PAYMENT_CALLBACKS') return 'true';
    return undefined;
  });
  return fixture;
}

function paymentAdminOperationClaimDelegate() {
  let stored: Record<string, unknown> | null = null;
  const duplicate = () => new Prisma.PrismaClientKnownRequestError('Payment action claim exists', {
    clientVersion: 'test',
    code: 'P2002',
  });
  return {
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      if (stored) throw duplicate();
      stored = {
        ...data,
        errorCode: null,
        errorMessage: null,
        id: 'payment-action-claim-1',
        receipt: null,
        status: PaymentAdminOperationStatus.IN_PROGRESS,
      };
      return { id: stored.id };
    }),
    findFirst: vi.fn(async () => stored),
    findUnique: vi.fn(async () => stored),
    update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      stored = { ...(stored ?? {}), ...data };
      return stored;
    }),
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

function paymentActionRecord(
  paymentRecord: ReturnType<typeof payment>,
  bookingStatus: BookingStatus,
) {
  return {
    ...paymentRecord,
    booking: {
      customerWalletLedgerEntries: [],
      status: bookingStatus,
    },
    callbackAttempts: [
      {
        callbackAmount: paymentRecord.amount,
        createdAt: new Date('2026-08-09T03:00:00.000Z'),
        outcome: 'ACCEPTED',
        signatureVerified: true,
      },
    ],
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

function requestedRefund() {
  return {
    id: 'refund-1',
    paymentId: 'payment-1',
    status: 'REQUESTED',
    metadata: {
      requestedAt: '2026-07-14T06:55:00.000Z',
      requestedByAdminId: 'admin-1',
      source: 'ADMIN_MANUAL',
    },
  };
}
