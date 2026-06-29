import type { AdminPayoutBatch } from '../../lib/admin-api';
import {
  buildPayoutActionConfirmation,
  payoutActionConfirmHref,
  readPayoutConfirmationAction,
} from './payout-action-confirmation';

const draftBatch = {
  id: 'payout-batch-123456',
  providerProfileId: 'partner-1',
  totalNetAmount: 240000,
  currency: 'VND',
  status: 'DRAFT',
  transferRef: 'BANK-REF-1',
  createdAt: '2026-06-01T00:00:00.000Z',
} as AdminPayoutBatch;

describe('payout action confirmation', () => {
  it('builds a processing confirmation with the current transfer reference', () => {
    const confirmation = buildPayoutActionConfirmation([draftBatch], 'processing', draftBatch.id);

    expect(confirmation).toEqual({
      action: 'processing',
      cancelHref: '/payouts',
      confirmLabel: 'Start processing',
      description:
        'Move payout batch payout-b into processing after finance review is complete. Accounting boundary: transfer preparation can begin, but bank/cash and Partner wallet liability move only when the batch is marked PAID.',
      disabled: false,
      payoutBatchId: draftBatch.id,
      title: 'Start payout payout-b processing?',
      tone: 'info',
      transferRef: 'BANK-REF-1',
    });
  });

  it('builds a paid confirmation with the wallet liability and bank accounting preview', () => {
    const confirmation = buildPayoutActionConfirmation([draftBatch], 'paid', draftBatch.id);

    expect(confirmation?.description).toBe(
      'Mark 240.000 VND payout batch payout-b as paid after transfer reference, tax, earnings, and Partner checks are clean. Accounting preview: Dr Partner wallet liability 240.000 VND / Cr Bank 240.000 VND.',
    );
  });

  it('builds a failed confirmation without implying bank or wallet movement', () => {
    const confirmation = buildPayoutActionConfirmation([draftBatch], 'failed', draftBatch.id);

    expect(confirmation?.description).toBe(
      'Mark payout batch payout-b as failed so finance can preserve the transfer failure before retry or rebuild. Accounting boundary: no bank/cash or wallet liability movement is recorded; Partner wallet liability remains for retry or rebuild.',
    );
  });

  it('uses disabled reason and neutral tone when a payout action is blocked', () => {
    const confirmation = buildPayoutActionConfirmation([draftBatch], 'paid', draftBatch.id, {
      disabledReason: 'Resolve transfer reference before marking paid.',
    });

    expect(confirmation?.disabled).toBe(true);
    expect(confirmation?.description).toBe('Resolve transfer reference before marking paid.');
    expect(confirmation?.tone).toBe('neutral');
  });

  it('returns null for unknown action or payout batch id', () => {
    expect(buildPayoutActionConfirmation([draftBatch], null, draftBatch.id)).toBeNull();
    expect(buildPayoutActionConfirmation([draftBatch], 'failed', 'missing')).toBeNull();
  });

  it('reads only supported confirmation actions', () => {
    expect(readPayoutConfirmationAction('processing')).toBe('processing');
    expect(readPayoutConfirmationAction('paid')).toBe('paid');
    expect(readPayoutConfirmationAction('failed')).toBe('failed');
    expect(readPayoutConfirmationAction('delete')).toBeNull();
  });

  it('encodes the confirmation URL', () => {
    expect(payoutActionConfirmHref('batch 1', 'paid')).toBe('/payouts?confirm=paid&payoutBatchId=batch%201');
  });
});
