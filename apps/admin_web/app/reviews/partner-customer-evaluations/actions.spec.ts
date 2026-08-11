import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { vi } from 'vitest';

import { adminPatchOrThrow } from '../../../lib/admin-api';
import { moderatePartnerCustomerNote } from './actions';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('../../../lib/admin-api', () => ({ adminPatchOrThrow: vi.fn() }));

const mockedAdminPatch = vi.mocked(adminPatchOrThrow);
const mockedRedirect = vi.mocked(redirect);
const mockedRevalidatePath = vi.mocked(revalidatePath);

describe('Partner note server action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAdminPatch.mockResolvedValue(undefined);
  });

  it('changes only review metadata and preserves filtered return context', async () => {
    const formData = noteForm({
      noteId: ' note-1 ',
      reason: ' Booking context requires verification ',
      returnTo: '/reviews/partner-customer-evaluations?q=late&status=retained&page=2',
      status: ' REPORTED ',
    });
    formData.set('comment', 'This must never be sent');

    await moderatePartnerCustomerNote(formData);

    expect(mockedAdminPatch).toHaveBeenCalledWith(
      '/admin/partner-customer-reviews/note-1/moderate',
      { reason: 'Booking context requires verification', status: 'REPORTED' },
    );
    expect(mockedAdminPatch.mock.calls[0]?.[1]).not.toHaveProperty('comment');
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/reviews/partner-customer-evaluations');
    expect(mockedRedirect).toHaveBeenCalledWith(
      '/reviews/partner-customer-evaluations?q=late&status=retained&page=2&notice=needs-review',
    );
  });

  it('rejects Needs review and Restricted without a reason', async () => {
    await moderatePartnerCustomerNote(noteForm({ noteId: 'note-1', status: 'HIDDEN' }));

    expect(mockedAdminPatch).not.toHaveBeenCalled();
    expect(mockedRedirect).toHaveBeenCalledWith(
      '/reviews/partner-customer-evaluations?notice=failed',
    );
  });

  it('reports API failure without losing the list context', async () => {
    mockedAdminPatch.mockRejectedValueOnce(new Error('unavailable'));
    await moderatePartnerCustomerNote(noteForm({
      noteId: 'note-1',
      reason: 'Sensitive personal information',
      returnTo: '/reviews/partner-customer-evaluations?dateRange=30d&page=3',
      status: 'HIDDEN',
    }));

    expect(mockedRevalidatePath).not.toHaveBeenCalled();
    expect(mockedRedirect).toHaveBeenCalledWith(
      '/reviews/partner-customer-evaluations?dateRange=30d&page=3&notice=failed',
    );
  });
});

function noteForm(values: Record<string, string>) {
  const formData = new FormData();
  Object.entries(values).forEach(([key, value]) => formData.set(key, value));
  return formData;
}
