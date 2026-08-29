import { vi } from 'vitest';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { AdminApiRequestError, adminPostOrThrow } from '../../lib/admin-api';
import {
  assignNotificationDeliveryIncident,
  openNotificationDeliveryIncident,
  reopenNotificationDeliveryIncident,
  resolveNotificationDeliveryIncident,
  retryNotification,
  reviewLegacyNotification,
} from './actions';
import { notificationActionReturnHref, sanitizeNotificationReturnHref } from './notification-action-return-href';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('../../lib/admin-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/admin-api')>()),
  adminPostOrThrow: vi.fn(),
}));

const mockedAdminPostOrThrow = vi.mocked(adminPostOrThrow);
const mockedRedirect = vi.mocked(redirect);
const mockedRevalidatePath = vi.mocked(revalidatePath);

describe('notification server actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAdminPostOrThrow.mockResolvedValue(undefined);
  });

  it('queues an audited retry and preserves the active delivery context', async () => {
    mockedAdminPostOrThrow.mockResolvedValue({ retryJob: { queuedJobId: 'job-123456789' } });
    const formData = retryForm('/notifications?issue=failed&page=2');

    await retryNotification(formData);

    expect(mockedAdminPostOrThrow).toHaveBeenCalledWith(
      '/admin/notifications/notification-1/retry',
      { reason: 'Confirmed unresolved FCM path.' },
    );
    expect(mockedRevalidatePath.mock.calls.map(([path]) => path)).toEqual([
      '/notifications',
      '/partners',
      '/partner-controls',
      '/audit-log',
    ]);
    expect(mockedRedirect).toHaveBeenCalledWith(
      '/notifications?issue=failed&page=2&retryNotice=queued&retryJob=job-123456789',
    );
  });

  it('keeps the queued job visible when only audit confirmation is pending', async () => {
    mockedAdminPostOrThrow.mockResolvedValue({
      auditStatus: 'PENDING',
      retryJob: { queuedJobId: 'job-pending-audit' },
    });

    await retryNotification(retryForm('/notifications?issue=failed&failureProvider=FCM&failureCode=messaging%2Finvalid-argument'));

    expect(mockedRedirect).toHaveBeenCalledWith(
      '/notifications?issue=failed&failureProvider=FCM&failureCode=messaging%2Finvalid-argument&retryNotice=queued-audit-pending&retryJob=job-pending-audit',
    );
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/notifications');
  });

  it.each([
    [new AdminApiRequestError('POST', '/retry', 403), 'permission-denied'],
    [new AdminApiRequestError('POST', '/retry', 409, { message: 'No eligible unresolved path' }), 'no-eligible-path'],
    [new AdminApiRequestError('POST', '/retry', 409, { message: 'State changed' }), 'state-changed'],
    [new AdminApiRequestError('POST', '/retry', 503), 'queue-unavailable'],
    [new Error('network'), 'unknown-failure'],
  ])('classifies retry failure without showing success or revalidating (%s)', async (error, notice) => {
    mockedAdminPostOrThrow.mockRejectedValue(error);

    await retryNotification(retryForm('/notifications?mode=records'));

    expect(mockedRedirect).toHaveBeenCalledWith(`/notifications?mode=records&retryNotice=${notice}`);
    expect(mockedRedirect).not.toHaveBeenCalledWith(expect.stringContaining('retryNotice=queued'));
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
  });

  it('requires identifiers and a reason before calling the API', async () => {
    await expect(retryNotification(new FormData())).rejects.toThrow('notificationId is required');
    const missingReason = new FormData();
    missingReason.set('notificationId', 'notification-1');
    await expect(retryNotification(missingReason)).rejects.toThrow('reason is required');
    expect(mockedAdminPostOrThrow).not.toHaveBeenCalled();
  });

  it('keeps legacy review on the throwing API path so write failure is not reported as success', async () => {
    const formData = new FormData();
    formData.set('notificationId', 'notification-legacy');
    formData.set('reason', 'Reviewed retained source evidence.');
    formData.set('returnHref', '/notifications');

    await reviewLegacyNotification(formData);

    expect(mockedAdminPostOrThrow).toHaveBeenCalledWith(
      '/admin/notifications/notification-legacy/review-legacy',
      { reason: 'Reviewed retained source evidence.' },
    );
  });

  it('sends incident lifecycle changes with exact revision and reason evidence', async () => {
    const openForm = incidentForm();
    openForm.set('dataScope', 'unknown');
    openForm.set('provider', 'FCM');
    openForm.set('failureCode', 'UNREGISTERED');
    await openNotificationDeliveryIncident(openForm);
    expect(mockedAdminPostOrThrow).toHaveBeenLastCalledWith('/admin/notification-delivery-incidents', {
      dataScope: 'unknown', failureCode: 'UNREGISTERED', provider: 'FCM',
      reason: 'Verified persistent delivery failure evidence.',
    });

    const assignForm = incidentForm();
    assignForm.set('incidentId', 'incident-1');
    assignForm.set('assigneeAdminId', 'admin-1');
    assignForm.set('expectedRevision', '3');
    await assignNotificationDeliveryIncident(assignForm);
    expect(mockedAdminPostOrThrow).toHaveBeenLastCalledWith(
      '/admin/notification-delivery-incidents/incident-1/assign',
      expect.objectContaining({ assigneeAdminId: 'admin-1', expectedRevision: 3 }),
    );

    const resolveForm = incidentForm();
    resolveForm.set('incidentId', 'incident-1');
    resolveForm.set('expectedRevision', '4');
    resolveForm.set('resolutionCode', 'CONFIGURATION_FIXED');
    await resolveNotificationDeliveryIncident(resolveForm);
    expect(mockedAdminPostOrThrow).toHaveBeenLastCalledWith(
      '/admin/notification-delivery-incidents/incident-1/resolve',
      expect.objectContaining({ expectedRevision: 4, resolutionCode: 'CONFIGURATION_FIXED' }),
    );

    const reopenForm = incidentForm();
    reopenForm.set('incidentId', 'incident-1');
    reopenForm.set('expectedRevision', '5');
    await reopenNotificationDeliveryIncident(reopenForm);
    expect(mockedAdminPostOrThrow).toHaveBeenLastCalledWith(
      '/admin/notification-delivery-incidents/incident-1/reopen',
      expect.objectContaining({ expectedRevision: 5 }),
    );
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/audit-log');
  });

  it('reads only safe notification return URLs', () => {
    const formData = new FormData();
    formData.set('returnHref', '/notifications?issue=failed&booking=booking-1');
    expect(notificationActionReturnHref(formData)).toBe('/notifications?issue=failed&booking=booking-1');
    expect(sanitizeNotificationReturnHref('https://example.com/notifications')).toBe('/notifications');
    expect(sanitizeNotificationReturnHref('/partners')).toBe('/notifications');
    expect(sanitizeNotificationReturnHref('/notifications/../partners')).toBe('/notifications');
  });
});

function retryForm(returnHref: string) {
  const formData = new FormData();
  formData.set('notificationId', ' notification-1 ');
  formData.set('reason', ' Confirmed unresolved FCM path. ');
  formData.set('returnHref', returnHref);
  return formData;
}

function incidentForm() {
  const formData = new FormData();
  formData.set('reason', 'Verified persistent delivery failure evidence.');
  formData.set(
    'returnHref',
    '/notifications?issue=groups&incidentProvider=FCM&incidentFailureCode=UNREGISTERED',
  );
  return formData;
}
