import { BadRequestException, ConflictException } from '@nestjs/common';
import { PaymentMethod, PaymentStatus } from '@prisma/client';

import { PaymentsService } from './payments.service';

describe('PaymentsService callbacks', () => {
  it('accepts a non-terminal callback and records accepted evidence', async () => {
    const { prisma, service } = createService({
      existingPayment: payment({ status: PaymentStatus.AUTHORIZED }),
      updatedPayment: payment({ status: PaymentStatus.CAPTURED }),
    });

    const result = await service.handleCallback(PaymentMethod.CASH, {
      providerRef: 'cash-booking-1',
      status: 'CAPTURED',
    });

    expect(result).toEqual({ ok: true, replay: false, payment: payment({ status: PaymentStatus.CAPTURED }) });
    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rawMeta: expect.objectContaining({
            callbackSignatureVerified: true,
            callbackVerificationMode: 'cash-internal',
            providerRef: 'cash-booking-1',
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
        signatureVerified: true,
        verificationMode: 'cash-internal',
      }),
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

function createService({
  existingPayment,
  updatedPayment,
}: {
  existingPayment: ReturnType<typeof payment> | null;
  updatedPayment?: ReturnType<typeof payment>;
}) {
  const prisma = {
    payment: {
      findUnique: jest.fn().mockResolvedValue(existingPayment),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn().mockResolvedValue(updatedPayment ?? existingPayment),
    },
    paymentCallbackAttempt: {
      create: jest.fn(),
    },
  };
  const config = { get: jest.fn() };
  const queue = { add: jest.fn() };

  return {
    prisma,
    service: new PaymentsService(
      prisma as never,
      config as never,
      {} as never,
      {} as never,
      placeholderAdapter(PaymentMethod.MOMO) as never,
      placeholderAdapter(PaymentMethod.VNPAY) as never,
      cashAdapter() as never,
      queue as never,
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
    authorize: jest.fn(),
    checkStatus: jest.fn(),
    method: PaymentMethod.CASH,
    parseCallback: jest.fn((payload: unknown) => {
      const body = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
      return {
        providerRef: String(body.providerRef ?? ''),
        rawMeta: body,
        status: body.status === 'CAPTURED' ? PaymentStatus.CAPTURED : PaymentStatus.AUTHORIZED,
      };
    }),
    release: jest.fn(),
  };
}

function placeholderAdapter(method: PaymentMethod) {
  return {
    authorize: jest.fn(),
    checkStatus: jest.fn(),
    method,
    parseCallback: jest.fn(),
    release: jest.fn(),
  };
}
