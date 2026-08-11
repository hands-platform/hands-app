import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { vi } from 'vitest';

import { adminPatch } from '../../lib/admin-api';
import { updateOperationalPolicy } from './actions';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('../../lib/admin-api', () => ({ adminPatch: vi.fn() }));

describe('operations policy actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(adminPatch).mockResolvedValue({ key: 'matching.provider_response_window_minutes' });
  });

  it('sends the reviewed current value with the new value and reason', async () => {
    const formData = policyChangeForm();

    await updateOperationalPolicy(formData);

    expect(adminPatch).toHaveBeenCalledWith(
      '/admin/operational-policy/matching.provider_response_window_minutes',
      {
        expectedValue: 10,
        reason: 'Increase after reviewing the matching queue',
        value: 12,
      },
      null,
    );
    expect(revalidatePath).toHaveBeenCalledWith('/operations-policy');
    expect(revalidatePath).toHaveBeenCalledWith('/audit-log');
    expect(redirect).toHaveBeenCalledWith(
      '/operations-policy?reason=matching.provider_response_window_minutes&status=saved',
    );
  });

  it('blocks submission when the operator did not confirm the impact review', async () => {
    const formData = policyChangeForm();
    formData.delete('confirmed');
    vi.mocked(redirect).mockImplementation(() => {
      throw new Error('redirected');
    });

    await expect(updateOperationalPolicy(formData)).rejects.toThrow('redirected');

    expect(adminPatch).not.toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith(
      '/operations-policy?reason=missing-confirmation&status=blocked&edit=matching.provider_response_window_minutes',
    );
  });
});

function policyChangeForm() {
  const formData = new FormData();
  formData.set('confirmed', 'yes');
  formData.set('expectedValue', '10');
  formData.set('key', 'matching.provider_response_window_minutes');
  formData.set('reason', 'Increase after reviewing the matching queue');
  formData.set('value', '12');
  formData.set('valueType', 'number');
  return formData;
}
