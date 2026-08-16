import { revalidatePath } from 'next/cache';
import { vi } from 'vitest';

import { AdminApiRequestError, adminPostOrThrow } from '../../../lib/admin-api';
import {
  createFinanceApproverAccessRequest,
  decideFinanceApproverAccessRequest,
} from './actions';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('../../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/admin-api')>('../../../lib/admin-api');
  return { ...actual, adminPostOrThrow: vi.fn() };
});

const mockedAdminPostOrThrow = vi.mocked(adminPostOrThrow);
const mockedRevalidatePath = vi.mocked(revalidatePath);

describe('finance approval access actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAdminPostOrThrow.mockResolvedValue(financeApproverReceipt('PENDING'));
  });

  it('creates a durable request without directly changing the operator role', async () => {
    const formData = financeApproverRequestFormData();
    const state = await createFinanceApproverAccessRequest({ status: 'idle' }, formData);

    expect(mockedAdminPostOrThrow).toHaveBeenCalledWith(
      '/admin/finance-approver-governance/requests',
      {
        idempotencyKey: 'finance-access:test-request-1',
        operatorReason: 'Independent treasury backup coverage',
        requestedEnabled: true,
        targetUserId: 'admin-eligible-1',
      },
    );
    expect(mockedAdminPostOrThrow.mock.calls[0]?.[0]).not.toContain('/admin/users/');
    expect(state.status).toBe('success');
    expect(state.receipt).toMatchObject({ requestId: 'request-1', previousEnabled: false, status: 'PENDING' });
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/finance-tax/finance-approvers');
  });

  it.each([
    ['', 'Enter at least 12 characters'],
    ['a', 'Enter at least 12 characters'],
    ['12345678901', 'Enter at least 12 characters'],
    ['x'.repeat(501), '500 characters or fewer'],
  ])('rejects invalid request reason length before the API call', async (reason, expectedMessage) => {
    const formData = financeApproverRequestFormData(reason);
    const state = await createFinanceApproverAccessRequest({ status: 'idle' }, formData);

    expect(mockedAdminPostOrThrow).not.toHaveBeenCalled();
    expect(state.status).toBe('error');
    expect(state.fieldErrors?.operatorReason).toContain(expectedMessage);
  });

  it.each(['x'.repeat(12), 'x'.repeat(500)])('accepts request reason boundary length %s', async (reason) => {
    const formData = financeApproverRequestFormData(reason);
    const state = await createFinanceApproverAccessRequest({ status: 'idle' }, formData);

    expect(mockedAdminPostOrThrow).toHaveBeenCalledOnce();
    expect(state.status).toBe('success');
  });

  it('sends an independent decision to the request-specific endpoint', async () => {
    mockedAdminPostOrThrow.mockResolvedValue(financeApproverReceipt('APPROVED'));
    const formData = new FormData();
    formData.set('requestId', 'request-1');
    formData.set('decision', 'APPROVE');
    formData.set('decisionReason', 'Verified production owner and backup coverage');

    const state = await decideFinanceApproverAccessRequest({ status: 'idle' }, formData);

    expect(mockedAdminPostOrThrow).toHaveBeenCalledWith(
      '/admin/finance-approver-governance/requests/request-1/decision',
      { decision: 'APPROVE', decisionReason: 'Verified production owner and backup coverage' },
    );
    expect(state.receipt).toMatchObject({ requestId: 'request-1', status: 'APPROVED' });
  });

  it.each([
    ['missing', []],
    ['empty', ['']],
    ['typo', ['APPROVED']],
    ['ambiguous', ['APPROVE', 'REJECT']],
  ])('fails closed for a %s decision without calling the API', async (_label, values) => {
    const formData = new FormData();
    formData.set('requestId', 'request-1');
    for (const value of values) formData.append('decision', value);
    formData.set('decisionReason', 'Independent evidence was reviewed carefully');

    const state = await decideFinanceApproverAccessRequest({ status: 'idle' }, formData);

    expect(mockedAdminPostOrThrow).not.toHaveBeenCalled();
    expect(state.status).toBe('error');
    expect(state.fieldErrors?.decision).toContain('Select Approve or Reject');
  });

  it('submits REJECT exactly once', async () => {
    mockedAdminPostOrThrow.mockResolvedValue(financeApproverReceipt('APPROVED'));
    const formData = new FormData();
    formData.set('requestId', 'request-1');
    formData.set('decision', 'REJECT');
    formData.set('decisionReason', 'Independent evidence does not support this access');

    await decideFinanceApproverAccessRequest({ status: 'idle' }, formData);

    expect(mockedAdminPostOrThrow).toHaveBeenCalledOnce();
    expect(mockedAdminPostOrThrow).toHaveBeenCalledWith(
      '/admin/finance-approver-governance/requests/request-1/decision',
      { decision: 'REJECT', decisionReason: 'Independent evidence does not support this access' },
    );
  });

  it('returns a stable maker-checker recovery message without losing form state', async () => {
    mockedAdminPostOrThrow.mockRejectedValue(
      new AdminApiRequestError('POST', '/admin/finance-approver-governance/requests/request-1/decision', 403, {
        code: 'MAKER_CANNOT_APPROVE',
      }),
    );
    const formData = new FormData();
    formData.set('requestId', 'request-1');
    formData.set('decision', 'APPROVE');
    formData.set('decisionReason', 'I reviewed the request evidence carefully');

    const state = await decideFinanceApproverAccessRequest({ status: 'idle' }, formData);

    expect(state).toMatchObject({
      error: 'The requester cannot decide this access request. Ask a different verified role governor.',
      status: 'error',
    });
  });
});

function financeApproverRequestFormData(reason = 'Independent treasury backup coverage') {
  const formData = new FormData();
  formData.set('targetUserId', 'admin-eligible-1');
  formData.set('requestedEnabled', 'true');
  formData.set('operatorReason', reason);
  formData.set('idempotencyKey', 'finance-access:test-request-1');
  return formData;
}

function financeApproverReceipt(status: 'APPROVED' | 'PENDING') {
  return {
    request: {
      previousEnabled: false,
    },
    receipt: {
      auditHref: '/audit-log?range=all&sort=oldest&targetPrefix=finance_approver_request%3Arequest-1',
      decidedAt: status === 'APPROVED' ? '2026-08-11T05:05:00.000Z' : null,
      decisionMaker: status === 'APPROVED' ? { id: 'checker-1', email: 'checker@example.com', fullName: 'Checker' } : null,
      executedAt: status === 'APPROVED' ? '2026-08-11T05:05:00.000Z' : null,
      replayed: false,
      requestId: 'request-1',
      requestedAt: '2026-08-11T05:00:00.000Z',
      requestedEnabled: true,
      requester: { id: 'maker-1', email: 'maker@example.com', fullName: 'Maker' },
      status,
      target: { id: 'admin-eligible-1', email: 'candidate@example.com', fullName: 'Candidate' },
    },
  } as never;
}
