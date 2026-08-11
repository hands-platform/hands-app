import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { vi } from 'vitest';

import { adminPostOrThrow } from '../../lib/admin-api';
import { allocateApprovedDepositToCashDebt } from './actions';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('../../lib/admin-api', () => ({
  adminPostOrThrow: vi.fn(),
  AdminApiRequestError: class AdminApiRequestError extends Error {
    constructor(readonly method: string, readonly path: string, readonly status: number) {
      super(`Admin API ${method} ${path} failed with ${status}`);
    }
  },
}));

const mockedAdminPostOrThrow = vi.mocked(adminPostOrThrow);
const mockedRevalidatePath = vi.mocked(revalidatePath);
const mockedRedirect = vi.mocked(redirect);

describe('cash settlement server actions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('allocates approved evidence with structured reason and preserves return context', async () => {
    mockedAdminPostOrThrow.mockResolvedValueOnce({
      allocation: { id: 'allocation-1', amount: 125_000 },
      auditLogId: 'audit-1',
      cashDebtFullyAllocated: true,
      earning: { id: 'earning-1', status: 'PAID' },
    });
    const formData = allocationForm();

    await allocateApprovedDepositToCashDebt(formData);

    expect(mockedAdminPostOrThrow).toHaveBeenCalledWith(
      '/admin/cash-settlement-earnings/earning-1/allocations',
      {
        amount: 125_000,
        notes: 'Matched the executed bank receipt to the Partner deposit.',
        reasonCode: 'FINAL_RECOVERY',
        requestId: 'deposit-request-1',
      },
    );
    expect(mockedRedirect).toHaveBeenCalledWith(expect.stringContaining('allocationId=allocation-1'));
    expect(mockedRedirect).toHaveBeenCalledWith(expect.stringContaining('evidenceId=deposit-request-1'));
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/cash-settlements');
  });

  it('rejects an unsupported reason code before the API call', async () => {
    const formData = allocationForm();
    formData.set('reasonCode', 'FREE_TEXT');

    await allocateApprovedDepositToCashDebt(formData);

    expect(mockedAdminPostOrThrow).not.toHaveBeenCalled();
    expect(mockedRedirect).toHaveBeenCalledWith(expect.stringContaining('code=INVALID_INPUT'));
  });
});

function allocationForm() {
  const formData = new FormData();
  formData.set('requestId', 'deposit-request-1');
  formData.set('earningId', 'earning-1');
  formData.set('amount', '125000');
  formData.set('reasonCode', 'FINAL_RECOVERY');
  formData.set('notes', 'Matched the executed bank receipt to the Partner deposit.');
  formData.set('returnTo', '/cash-settlements?queue=missing-evidence&sort=oldest&page=2&review=earning-1');
  return formData;
}
