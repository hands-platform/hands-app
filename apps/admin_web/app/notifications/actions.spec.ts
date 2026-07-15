import { vi } from 'vitest';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { adminPost, adminPostOrThrow } from '../../lib/admin-api';
import { assignFinanceReview, enablePushDevice, retryNotification, reviewLegacyNotification } from './actions';
import {
  notificationActionReturnHref,
  sanitizeNotificationReturnHref,
} from './notification-action-return-href';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

vi.mock('../../lib/admin-api', () => ({
  adminPost: vi.fn(),
  adminPostOrThrow: vi.fn(),
}));

const mockedAdminPost = vi.mocked(adminPost);
const mockedAdminPostOrThrow = vi.mocked(adminPostOrThrow);
const mockedRedirect = vi.mocked(redirect);
const mockedRevalidatePath = vi.mocked(revalidatePath);

describe('notification server actions', () => {
  beforeEach(() => {
    mockedAdminPost.mockResolvedValue(undefined);
    mockedAdminPostOrThrow.mockResolvedValue(undefined);
  });

  it('retries a notification, refreshes admin views, and returns to the active queue', async () => {
    const formData = new FormData();
    formData.set('notificationId', 'notification-1');
    formData.set('returnHref', '/notifications?review=failed');

    await retryNotification(formData);

    expect(mockedAdminPost).toHaveBeenCalledWith(
      '/admin/notifications/notification-1/retry',
      {},
      null,
    );
    expect(mockedRevalidatePath.mock.calls.map(([path]) => path)).toEqual([
      '/notifications',
      '/partners',
      '/partner-controls',
      '/audit-log',
    ]);
    expect(mockedRedirect).toHaveBeenCalledWith('/notifications?review=failed');
  });

  it('re-enables a push device, refreshes push health views, and returns to the active queue', async () => {
    const formData = new FormData();
    formData.set('pushDeviceId', 'push-device-1');
    formData.set('returnHref', '/notifications?review=disabled-device');

    await enablePushDevice(formData);

    expect(mockedAdminPost).toHaveBeenCalledWith('/admin/push-devices/push-device-1/enable', {}, null);
    expect(mockedRevalidatePath.mock.calls.map(([path]) => path)).toEqual([
      '/notifications',
      '/partners',
      '/partner-controls',
      '/audit-log',
    ]);
    expect(mockedRedirect).toHaveBeenCalledWith('/notifications?review=disabled-device');
  });

  it('records a legacy review reason and returns to the legacy queue', async () => {
    const formData = new FormData();
    formData.set('notificationId', 'notification-legacy');
    formData.set('reason', ' Reviewed retained queue evidence. ');
    formData.set('returnHref', '/notifications?review=system-incidents&incidentState=legacy');

    await reviewLegacyNotification(formData);

    expect(mockedAdminPost).toHaveBeenCalledWith(
      '/admin/notifications/notification-legacy/review-legacy',
      { reason: 'Reviewed retained queue evidence.' },
      null,
    );
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/notifications');
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/audit-log');
    expect(mockedRedirect).toHaveBeenCalledWith(
      '/notifications?review=system-incidents&incidentState=legacy',
    );
  });

  it.each([
    ['bank-transaction', 'bank-tx-1', '/admin/bank-reconciliation/bank-tx-1/review-assignment'],
    ['import-batch', 'batch-1', '/admin/bank-reconciliation/import-batches/batch-1/assignment'],
  ])('assigns a Finance %s review through the existing audited API', async (sourceKind, sourceId, path) => {
    const formData = new FormData();
    formData.set('assigneeAdminId', 'finance-owner-1');
    formData.set('assignmentSourceId', sourceId);
    formData.set('assignmentSourceKind', sourceKind);
    formData.set('reason', ' Taking ownership of overdue evidence. ');
    formData.set(
      'returnHref',
      '/notifications?range=all&review=finance-overdue&financeAge=72-plus&financeOwner=unassigned',
    );

    await assignFinanceReview(formData);

    expect(mockedAdminPostOrThrow).toHaveBeenCalledWith(path, {
      assigneeAdminId: 'finance-owner-1',
      reason: 'Taking ownership of overdue evidence.',
    });
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/finance-tax/bank-reconciliation');
    expect(mockedRedirect).toHaveBeenCalledWith(
      '/notifications?range=all&review=finance-overdue&financeAge=72-plus&financeOwner=unassigned&financeAssignmentNotice=assigned',
    );
  });

  it('requires form identifiers before calling admin APIs', async () => {
    await expect(retryNotification(new FormData())).rejects.toThrow('notificationId is required');
    await expect(enablePushDevice(new FormData())).rejects.toThrow('pushDeviceId is required');
    await expect(reviewLegacyNotification(new FormData())).rejects.toThrow('notificationId is required');
    await expect(assignFinanceReview(new FormData())).rejects.toThrow('assigneeAdminId is required');

    const missingReason = new FormData();
    missingReason.set('notificationId', 'notification-legacy');
    await expect(reviewLegacyNotification(missingReason)).rejects.toThrow('reason is required');

    expect(mockedAdminPost).not.toHaveBeenCalled();
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
    expect(mockedRedirect).not.toHaveBeenCalled();
  });

  it('trims form identifiers before posting admin actions', async () => {
    const retryFormData = new FormData();
    retryFormData.set('notificationId', ' notification-1 ');
    const enableFormData = new FormData();
    enableFormData.set('pushDeviceId', ' push-device-1 ');

    await retryNotification(retryFormData);
    await enablePushDevice(enableFormData);

    expect(mockedAdminPost).toHaveBeenNthCalledWith(
      1,
      '/admin/notifications/notification-1/retry',
      {},
      null,
    );
    expect(mockedAdminPost).toHaveBeenNthCalledWith(
      2,
      '/admin/push-devices/push-device-1/enable',
      {},
      null,
    );
    expect(mockedRedirect).toHaveBeenNthCalledWith(1, '/notifications');
    expect(mockedRedirect).toHaveBeenNthCalledWith(2, '/notifications');
  });

  it('reads a safe notifications return href from form data', () => {
    const formData = new FormData();
    formData.set('returnHref', '/notifications?review=failed&booking=booking-1');

    expect(notificationActionReturnHref(formData)).toBe(
      '/notifications?review=failed&booking=booking-1',
    );
  });

  it('falls back to notifications for unsafe return hrefs', () => {
    expect(sanitizeNotificationReturnHref(null)).toBe('/notifications');
    expect(sanitizeNotificationReturnHref('https://example.com/notifications')).toBe('/notifications');
    expect(sanitizeNotificationReturnHref('/partners')).toBe('/notifications');
    expect(sanitizeNotificationReturnHref('/notifications/../partners')).toBe('/notifications');
    expect(sanitizeNotificationReturnHref('http://[')).toBe('/notifications');
  });
});
