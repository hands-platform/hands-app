import { revalidatePath } from 'next/cache';
import { vi } from 'vitest';

import { AdminApiRequestError, adminPostOrThrow } from '../../lib/admin-api';
import { acknowledgeOperationsShiftHandoff, createOperationsShiftHandoff } from './actions';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/admin-api')>('../../lib/admin-api');
  return { ...actual, adminPostOrThrow: vi.fn() };
});

const mockedPost = vi.mocked(adminPostOrThrow);

describe('operations handoff server actions', () => {
  it('rejects send and acknowledgement before the Admin API when the launch gate is off', async () => {
    vi.stubEnv('SHIFT_HANDOFF_LAUNCH_ENABLED', 'false');
    try {
      await expect(createOperationsShiftHandoff(new FormData())).resolves.toEqual({
        message: 'Shift Handoff is not active for the current launch.',
        status: 'error',
      });
      await expect(acknowledgeOperationsShiftHandoff(new FormData())).resolves.toEqual({
        message: 'Shift Handoff is not active for the current launch.',
        status: 'error',
      });
      expect(mockedPost).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('sends structured open-case references and reports success', async () => {
    mockedPost.mockResolvedValueOnce({ handoffId: 'handoff-1', ok: true });
    const formData = new FormData();
    formData.set('expectedOpenCaseCount', '3');
    formData.set('incomingOperatorId', 'incoming-admin');
    formData.set('incomingOperatorLabel', 'Incoming Operator');
    formData.set('ownerId', 'finance-admin');
    formData.set('outgoingShift', 'Evening shift');
    formData.set('note', 'Continue refund review.');
    formData.append('unresolvedCases', 'refund-review:refund-17');
    formData.append('unresolvedCases', 'refund-review:refund-17');
    formData.append('unresolvedCases', 'matching-delays:booking-42');

    await expect(createOperationsShiftHandoff(formData)).resolves.toEqual({
      message: 'Handoff sent to Incoming Operator.',
      status: 'success',
    });
    expect(mockedPost).toHaveBeenCalledWith('/admin/operations-handoff/shift', {
      expectedOpenCaseCount: 3,
      incomingOperatorId: 'incoming-admin',
      note: 'Continue refund review.',
      outgoingShift: 'Evening shift',
      ownerId: 'finance-admin',
      unresolvedCases: [
        { caseId: 'refund-17', queueKey: 'refund-review' },
        { caseId: 'booking-42', queueKey: 'matching-delays' },
      ],
    });
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith('/operations-handoff');
  });

  it('preserves the server conflict message', async () => {
    mockedPost.mockRejectedValueOnce(
      new AdminApiRequestError('POST', '/admin/operations-handoff/shift', 409, {
        message: 'Some selected cases are no longer open. Review the list and try again.',
      }),
    );
    const formData = new FormData();

    await expect(createOperationsShiftHandoff(formData)).resolves.toEqual({
      message: 'Some selected cases are no longer open. Review the list and try again.',
      status: 'error',
    });
  });

  it('reports the acknowledgement timestamp', async () => {
    mockedPost.mockResolvedValueOnce({ acknowledgedAt: '2026-08-05T01:05:00.000Z' });
    const formData = new FormData();
    formData.set('handoffId', 'handoff-1');

    const result = await acknowledgeOperationsShiftHandoff(formData);
    expect(result.status).toBe('success');
    expect(result.message).toContain('Handoff acknowledged at');
  });
});
