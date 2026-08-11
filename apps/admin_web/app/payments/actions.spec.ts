import { revalidatePath } from 'next/cache';
import { vi } from 'vitest';

import { adminPostOrThrow } from '../../lib/admin-api';
import { refundPayment } from './actions';

const { mockedRedirect } = vi.hoisted(() => ({
  mockedRedirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  }),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: mockedRedirect }));
vi.mock('../../lib/admin-api', () => ({
  AdminApiRequestError: class AdminApiRequestError extends Error {},
  adminPost: vi.fn(),
  adminPostOrThrow: vi.fn(),
}));

const mockedAdminPostOrThrow = vi.mocked(adminPostOrThrow);

describe('Payment actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAdminPostOrThrow.mockResolvedValue({
      action: 'REQUEST_REFUND',
      actorId: 'admin-1',
      after: { bookingStatus: 'COMPLETED', paymentStatus: 'CAPTURED' },
      auditId: 'audit-1',
      before: { bookingStatus: 'COMPLETED', paymentStatus: 'CAPTURED' },
      completedAt: '2026-08-09T02:00:00.000Z',
      idempotencyKey: 'refund-key-1',
      paymentId: 'payment-1',
      policyVersion: 'admin-payment-actions-v1',
      replayed: false,
    });
  });

  it('submits reason and idempotency, then returns an audit receipt notice', async () => {
    const formData = actionFormData();

    await expect(refundPayment(formData)).rejects.toThrow(
      'NEXT_REDIRECT:/payments?review=evidence-conflict&paymentNotice=success&paymentAction=refund&paymentId=payment-1&auditId=audit-1',
    );

    expect(mockedAdminPostOrThrow).toHaveBeenCalledWith(
      '/admin/payments/payment-1/refund-request',
      {
        idempotencyKey: 'refund-key-1',
        reason: 'Customer refund evidence reviewed.',
      },
    );
    expect(revalidatePath).toHaveBeenCalledWith('/finance-tax/approval-queue');
    expect(mockedAdminPostOrThrow.mock.calls[0]?.[1]).not.toHaveProperty('approvalAdminId');
  });

  it('fails closed before the API call when money-action evidence is incomplete', async () => {
    const formData = actionFormData();
    formData.set('reason', 'short');

    await expect(refundPayment(formData)).rejects.toThrow('PAYMENT_ACTION_INPUT_REQUIRED');
    expect(mockedAdminPostOrThrow).not.toHaveBeenCalled();
  });
});

function actionFormData() {
  const formData = new FormData();
  formData.set('paymentId', 'payment-1');
  formData.set('idempotencyKey', 'refund-key-1');
  formData.set('reason', 'Customer refund evidence reviewed.');
  formData.set('returnTo', '/payments?review=evidence-conflict');
  return formData;
}
