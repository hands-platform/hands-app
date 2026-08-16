import { revalidatePath } from 'next/cache';
import { vi } from 'vitest';

import {
  AdminApiRequestError,
  AdminOperatorAccessDeniedError,
  adminGetResult,
  adminPatchOrThrow,
} from '../../lib/admin-api';
import { initialOperationsPolicyActionState, updateOperationalPolicy } from './actions';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('../../lib/admin-api', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../lib/admin-api')>();
  return { ...original, adminGetResult: vi.fn(), adminPatchOrThrow: vi.fn() };
});

describe('operations policy actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(adminGetResult).mockResolvedValue({
      data: { items: [], nextCursor: null, source: 'operator' },
      ok: true,
      status: 200,
    });
    vi.mocked(adminPatchOrThrow).mockResolvedValue({
      auditId: 'audit-1',
      effectiveAt: '2026-08-11T02:00:00.000Z',
      key: 'matching.provider_response_window_minutes',
      label: 'First-pick response window',
      updatedBy: { fullName: 'Policy Admin' },
      value: 12,
    });
  });

  it('sends the reviewed current value and returns a verifiable success summary', async () => {
    const result = await updateOperationalPolicy(initialOperationsPolicyActionState, policyChangeForm());

    expect(adminPatchOrThrow).toHaveBeenCalledWith(
      '/admin/operational-policy/matching.provider_response_window_minutes',
      {
        expectedValue: 10,
        reason: 'Increase after reviewing the matching queue',
        value: 12,
      },
    );
    expect(revalidatePath).toHaveBeenCalledWith('/operations-policy');
    expect(result).toMatchObject({
      status: 'success',
      success: {
        after: '12',
        auditId: 'audit-1',
        auditHref: '/audit-log?bucket=Operations%2FPolicy&event=audit-1&range=all&sort=newest',
        before: '10',
        changedBy: 'Policy Admin',
      },
    });
  });

  it('reverts to the audited Before value with the latest value as the optimistic lock', async () => {
    vi.mocked(adminPatchOrThrow).mockResolvedValueOnce({
      auditId: 'audit-2',
      effectiveAt: '2026-08-11T02:05:00.000Z',
      key: 'matching.provider_response_window_minutes',
      label: 'First-pick response window',
      updatedBy: { fullName: 'Policy Admin' },
      value: 10,
    });
    const form = policyChangeForm();
    form.set('intent', 'rollback');

    const result = await updateOperationalPolicy(
      {
        status: 'success',
        success: {
          after: '12',
          auditHref: '/audit-log?bucket=Operations%2FPolicy&event=audit-1&range=all&sort=newest',
          auditId: 'audit-1',
          before: '10',
          changedBy: 'Policy Admin',
          effectiveAt: '2026-08-11T02:00:00.000Z',
          policy: 'First-pick response window',
          reason: 'Increase after reviewing the matching queue',
        },
      },
      form,
    );

    expect(adminPatchOrThrow).toHaveBeenCalledWith(
      '/admin/operational-policy/matching.provider_response_window_minutes',
      expect.objectContaining({
        expectedValue: 12,
        reason: expect.stringContaining('Revert First-pick response window'),
        value: 10,
      }),
    );
    expect(result).toMatchObject({ status: 'success', success: { after: '10', before: '12', auditId: 'audit-2' } });
  });

  it('does not attempt a rollback without a saved action state', async () => {
    const form = policyChangeForm();
    form.set('intent', 'rollback');

    const result = await updateOperationalPolicy(initialOperationsPolicyActionState, form);

    expect(result).toMatchObject({ status: 'error', message: expect.stringContaining('no longer available') });
    expect(adminPatchOrThrow).not.toHaveBeenCalled();
  });

  it('does not attempt a policy mutation when audit evidence is unavailable', async () => {
    vi.mocked(adminGetResult).mockResolvedValueOnce({
      data: { items: [], nextCursor: null, source: 'operator' },
      ok: false,
      status: 503,
    });

    const result = await updateOperationalPolicy(initialOperationsPolicyActionState, policyChangeForm());

    expect(result).toMatchObject({
      status: 'error',
      message: expect.stringContaining('audit evidence is unavailable'),
    });
    expect(adminPatchOrThrow).not.toHaveBeenCalled();
  });

  it.each([
    ['same value', (form: FormData) => form.set('value', '10'), 'value'],
    ['short reason', (form: FormData) => form.set('reason', 'too short'), 'reason'],
    ['long reason', (form: FormData) => form.set('reason', 'x'.repeat(501)), 'reason'],
    ['missing confirmation', (form: FormData) => form.delete('confirmed'), 'confirmed'],
    ['below range', (form: FormData) => form.set('value', '2'), 'value'],
    ['above range', (form: FormData) => form.set('value', '31'), 'value'],
  ])('blocks %s before calling the API', async (_label, mutate, field) => {
    const form = policyChangeForm();
    mutate(form);

    const result = await updateOperationalPolicy(initialOperationsPolicyActionState, form);

    expect(result.status).toBe('error');
    expect(result.fieldErrors?.[field as keyof NonNullable<typeof result.fieldErrors>]).toBeTruthy();
    expect(adminPatchOrThrow).not.toHaveBeenCalled();
  });

  it.each([
    [
      'conflict',
      new AdminApiRequestError('PATCH', '/admin/operational-policy/key', 409),
      'Another operator changed this policy',
    ],
    [
      'permission',
      new AdminOperatorAccessDeniedError('SYSTEM_POLICY'),
      'System Policy write access',
    ],
    [
      'range',
      new AdminApiRequestError('PATCH', '/admin/operational-policy/key', 400, {
        message: 'Operational policy value must be between 3 and 30',
      }),
      'outside the allowed policy range',
    ],
    ['network', new TypeError('fetch failed'), 'could not be reached'],
  ])('returns a distinct %s error without dropping form state', async (_label, error, message) => {
    vi.mocked(adminPatchOrThrow).mockRejectedValueOnce(error);

    const result = await updateOperationalPolicy(initialOperationsPolicyActionState, policyChangeForm());

    expect(result).toMatchObject({ status: 'error' });
    expect(result.message).toContain(message);
  });
});

function policyChangeForm() {
  const formData = new FormData();
  formData.set('confirmed', 'yes');
  formData.set('expectedValue', '10');
  formData.set('key', 'matching.provider_response_window_minutes');
  formData.set('label', 'First-pick response window');
  formData.set('max', '30');
  formData.set('min', '3');
  formData.set('reason', 'Increase after reviewing the matching queue');
  formData.set('value', '12');
  formData.set('valueType', 'number');
  return formData;
}
