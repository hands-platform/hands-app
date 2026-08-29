import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { vi } from 'vitest';

import { adminPostOrThrow } from '../../../lib/admin-api';
import { addCustomerOpsNote, sendCustomerPushMessage } from './actions';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('../../../lib/admin-api', () => ({
  adminPostOrThrow: vi.fn(),
}));

describe('customer detail actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(adminPostOrThrow).mockResolvedValue({ id: 'campaign-1' });
  });

  it('sends a scoped push campaign to one customer and refreshes both histories', async () => {
    const formData = new FormData();
    formData.set('customerId', ' customer-1 ');
    formData.set('targetUserId', ' user-1 ');
    formData.set('title', ' Wallet update ');
    formData.set('body', ' Your wallet balance was updated. ');
    formData.set('returnTo', '/customers?view=all&page=2&q=mai');

    await sendCustomerPushMessage(formData);

    expect(adminPostOrThrow).toHaveBeenCalledWith('/admin/notifications/push-campaigns', {
      appDestination: 'notificationCenter',
      body: 'Your wallet balance was updated.',
      targetRole: 'CUSTOMER',
      targetUserId: 'user-1',
      title: 'Wallet update',
    });
    expect(revalidatePath).toHaveBeenCalledWith('/customers/customer-1');
    expect(revalidatePath).toHaveBeenCalledWith('/notifications');
    expect(redirect).toHaveBeenCalledWith(
      '/customers/customer-1?returnTo=%2Fcustomers%3Fview%3Dall%26page%3D2%26q%3Dmai&notificationNotice=sent#customer-app-notifications',
    );
  });

  it('returns to the customer with a visible failure notice', async () => {
    vi.mocked(adminPostOrThrow).mockRejectedValue(new Error('No active push recipient'));
    const formData = new FormData();
    formData.set('customerId', 'customer-1');
    formData.set('targetUserId', 'user-1');
    formData.set('title', 'Notice');
    formData.set('body', 'Please reopen the app.');
    formData.set('returnTo', '/customers?view=all&page=2&q=mai');

    await sendCustomerPushMessage(formData);

    expect(redirect).toHaveBeenCalledWith(
      '/customers/customer-1?returnTo=%2Fcustomers%3Fview%3Dall%26page%3D2%26q%3Dmai&notificationNotice=failed#customer-app-notifications',
    );
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('saves an operator note and returns to the same customer with an audit result', async () => {
    const formData = new FormData();
    formData.set('customerId', 'customer-1');
    formData.set('bookingId', 'booking-1');
    formData.set('preset', 'Customer contacted; waiting for reply.');
    formData.set('note', 'Called at 09:30.');
    formData.set('returnTo', '/customers?view=all&page=2&q=mai');

    await addCustomerOpsNote(formData);

    expect(adminPostOrThrow).toHaveBeenCalledWith('/admin/customers/customer-1/ops-note', {
      bookingId: 'booking-1',
      note: 'Called at 09:30.',
      preset: 'Customer contacted; waiting for reply.',
    });
    expect(revalidatePath).toHaveBeenCalledWith('/audit-log');
    expect(redirect).toHaveBeenCalledWith(
      '/customers/customer-1?returnTo=%2Fcustomers%3Fview%3Dall%26page%3D2%26q%3Dmai&noteNotice=saved#customer-operator-notes',
    );
  });

  it('returns to the open note panel when saving fails', async () => {
    vi.mocked(adminPostOrThrow).mockRejectedValue(new Error('Write failed'));
    const formData = new FormData();
    formData.set('customerId', 'customer-1');
    formData.set('preset', 'Payment record checked.');
    formData.set('returnTo', '/customers?view=all&page=2&q=mai');

    await addCustomerOpsNote(formData);

    expect(redirect).toHaveBeenCalledWith(
      '/customers/customer-1?returnTo=%2Fcustomers%3Fview%3Dall%26page%3D2%26q%3Dmai&noteNotice=failed#customer-operator-notes',
    );
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('shows a visible validation failure without calling the API for an empty note', async () => {
    const formData = new FormData();
    formData.set('customerId', 'customer-1');
    formData.set('returnTo', '/customers?view=all&page=2&q=mai');

    await addCustomerOpsNote(formData);

    expect(adminPostOrThrow).not.toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith(
      '/customers/customer-1?returnTo=%2Fcustomers%3Fview%3Dall%26page%3D2%26q%3Dmai&action=note&noteNotice=failed#customer-operator-notes',
    );
  });

  it.each([
    'https://evil.example/customers?view=all',
    '//evil.example/customers?view=all',
    '/customers\\?view=all',
  ])('falls back to the customer directory for an unsafe returnTo: %s', async (returnTo) => {
    const formData = new FormData();
    formData.set('customerId', 'customer-1');
    formData.set('note', 'Verified customer context.');
    formData.set('returnTo', returnTo);

    await addCustomerOpsNote(formData);

    expect(redirect).toHaveBeenCalledWith(
      '/customers/customer-1?returnTo=%2Fcustomers&noteNotice=saved#customer-operator-notes',
    );
  });
});
