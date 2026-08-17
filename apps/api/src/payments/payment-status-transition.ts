import { ConflictException } from '@nestjs/common';
import { PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';

export type PaymentTransitionClient = Pick<Prisma.TransactionClient, 'payment'>;

type PaymentTransitionInput = {
  data: Prisma.PaymentUpdateManyMutationInput;
  fromStatuses: readonly PaymentStatus[];
  idempotentTarget?: boolean;
  paymentId: string;
  targetStatus: PaymentStatus;
  where?: Prisma.PaymentWhereInput;
};

export async function transitionPaymentStatus(
  client: PaymentTransitionClient,
  input: PaymentTransitionInput,
) {
  const result = await client.payment.updateMany({
    where: {
      ...input.where,
      id: input.paymentId,
      status: { in: [...input.fromStatuses] },
    },
    data: input.data,
  });
  const payment = await client.payment.findUniqueOrThrow({ where: { id: input.paymentId } });
  if (result.count === 1) {
    return { payment, transitioned: true };
  }
  if (input.idempotentTarget !== false && payment.status === input.targetStatus) {
    return { payment, transitioned: false };
  }
  throw paymentTransitionConflict(input.paymentId, payment.status, input.targetStatus);
}

export function paymentCaptureSourceStatuses(method: PaymentMethod): readonly PaymentStatus[] {
  return method === PaymentMethod.CASH
    ? [PaymentStatus.PENDING]
    : [PaymentStatus.AUTHORIZED];
}

export function paymentTransitionConflict(
  paymentId: string,
  actualStatus: PaymentStatus,
  targetStatus: PaymentStatus,
) {
  return new ConflictException(
    `Payment ${paymentId} cannot transition from ${actualStatus} to ${targetStatus}`,
  );
}
