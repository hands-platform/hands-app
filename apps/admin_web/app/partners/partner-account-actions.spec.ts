import { vi } from 'vitest';

import { adminPostOrThrow } from '../../lib/admin-api';
import { unblockProviderAccount } from './actions';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/admin-api')>('../../lib/admin-api');
  return { ...actual, adminPostOrThrow: vi.fn() };
});

describe('partner account actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('submits normalized lift reason evidence when unblocking an account', async () => {
    const formData = new FormData();
    formData.set('providerId', 'partner-1');
    formData.set('reason', '  Identity issue resolved with verified evidence  ');

    await unblockProviderAccount(formData);

    expect(vi.mocked(adminPostOrThrow)).toHaveBeenCalledWith('/admin/partners/partner-1/unblock', {
      reason: 'Identity issue resolved with verified evidence',
    });
  });

  it.each([
    ['', 'reason is required'],
    ['x'.repeat(11), 'at least 12 characters'],
    ['x'.repeat(501), 'at most 500 characters'],
  ])('rejects invalid account unblock evidence before the API call', async (reason, message) => {
    const formData = new FormData();
    formData.set('providerId', 'partner-1');
    formData.set('reason', reason);

    await expect(unblockProviderAccount(formData)).rejects.toThrow(message);
    expect(vi.mocked(adminPostOrThrow)).not.toHaveBeenCalled();
  });

  it.each([12, 500])('accepts account unblock evidence with %i characters', async (length) => {
    const formData = new FormData();
    formData.set('providerId', 'partner-1');
    formData.set('reason', 'x'.repeat(length));

    await unblockProviderAccount(formData);

    expect(vi.mocked(adminPostOrThrow)).toHaveBeenCalledWith('/admin/partners/partner-1/unblock', {
      reason: 'x'.repeat(length),
    });
  });
});
