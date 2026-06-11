import { PayoutBatchStatus } from '@prisma/client';
import { EarningsService } from './earnings.service';

describe('EarningsService payout batches', () => {
  it('notifies the partner when a payout batch status changes', async () => {
    const existingBatch = {
      id: 'payout-batch-1',
      providerProfileId: 'provider-1',
      status: PayoutBatchStatus.PROCESSING,
      transferRef: 'BANK-001',
      paidAt: null,
      earnings: [],
    };
    const returnedBatch = {
      ...existingBatch,
      status: PayoutBatchStatus.FAILED,
      providerProfile: { user: { id: 'partner-user' } },
    };
    const tx = {
      providerPayoutBatch: {
        update: jest.fn().mockResolvedValue({ ...existingBatch, status: PayoutBatchStatus.FAILED }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(returnedBatch),
      },
    };
    const prisma = {
      providerPayoutBatch: {
        findUnique: jest.fn().mockResolvedValue(existingBatch),
      },
      $transaction: jest.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const notifications = { create: jest.fn().mockResolvedValue({ id: 'notification-1' }) };
    const service = new EarningsService(prisma as never, notifications as never);

    await expect(
      service.updatePayoutBatch('payout-batch-1', { status: PayoutBatchStatus.FAILED }),
    ).resolves.toEqual(returnedBatch);

    expect(notifications.create).toHaveBeenCalledWith({
      userId: 'partner-user',
      type: 'provider.payout_batch.updated',
      title: 'Payout batch updated',
      body: 'Your payout batch needs follow-up. Check the payout screen for details.',
      data: { payoutBatchId: 'payout-batch-1', providerProfileId: 'provider-1' },
    });
  });
});
