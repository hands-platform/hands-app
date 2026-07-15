import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { vi } from 'vitest';

import { adminPostOrThrow } from '../../lib/admin-api';
import {
  acknowledgeBackgroundJobFailure,
  resolveBackgroundJobFailure,
} from './actions';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('../../lib/admin-api', () => ({ adminPostOrThrow: vi.fn() }));

const mockedAdminPostOrThrow = vi.mocked(adminPostOrThrow);
const mockedRedirect = vi.mocked(redirect);

describe('background job review actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAdminPostOrThrow.mockResolvedValue({ ok: true });
  });

  it('acknowledges the retained failure without calling a retry endpoint', async () => {
    const formData = form({ jobId: 'payment-failure-1', queueName: 'payment-status-check' });

    await acknowledgeBackgroundJobFailure(formData);

    expect(mockedAdminPostOrThrow).toHaveBeenCalledWith(
      '/admin/system/background-jobs/payment-status-check/payment-failure-1/acknowledge',
      {},
    );
    expect(mockedAdminPostOrThrow.mock.calls[0]?.[0]).not.toContain('retry');
    expect(revalidatePath).toHaveBeenCalledWith('/background-jobs');
    expect(mockedRedirect).toHaveBeenCalledWith('/background-jobs?notice=acknowledged');
  });

  it('sends the normalized resolution note to the dedicated resolve endpoint', async () => {
    const formData = form({
      jobId: 'notification-failure-1',
      queueName: 'notification-retry',
      reason: '  Provider credentials corrected  ',
    });

    await resolveBackgroundJobFailure(formData);

    expect(mockedAdminPostOrThrow).toHaveBeenCalledWith(
      '/admin/system/background-jobs/notification-retry/notification-failure-1/resolve',
      { reason: 'Provider credentials corrected' },
    );
    expect(mockedRedirect).toHaveBeenCalledWith('/background-jobs?notice=resolved');
  });
});

function form(values: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) formData.set(key, value);
  return formData;
}
