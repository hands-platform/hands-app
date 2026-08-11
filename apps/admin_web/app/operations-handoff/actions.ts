'use server';

import { revalidatePath } from 'next/cache';

import { AdminApiRequestError, adminPostOrThrow } from '../../lib/admin-api';
import { formatDateTime } from '../../lib/admin-format';

export type OperationsHandoffActionState = {
  message: string;
  status: 'error' | 'success';
};

export async function createOperationsShiftHandoff(formData: FormData): Promise<OperationsHandoffActionState> {
  const unresolvedCases = [...new Set(formData.getAll('unresolvedCases').map(String).filter(Boolean))].flatMap(
    (value) => {
      const separator = value.indexOf(':');
      return separator > 0
        ? [{ caseId: value.slice(separator + 1), queueKey: value.slice(0, separator) }]
        : [];
    },
  );

  try {
    await adminPostOrThrow<{ handoffId: string; ok: true }>('/admin/operations-handoff/shift', {
      expectedOpenCaseCount: Number(formData.get('expectedOpenCaseCount') ?? 0),
      incomingOperatorId: String(formData.get('incomingOperatorId') ?? '').trim(),
      note: String(formData.get('note') ?? '').trim(),
      outgoingShift: String(formData.get('outgoingShift') ?? '').trim(),
      ownerId: String(formData.get('ownerId') ?? '').trim(),
      unresolvedCases,
    });
    revalidatePath('/operations-handoff');
    revalidatePath('/audit-log');
    return {
      message: `Handoff sent to ${String(formData.get('incomingOperatorLabel') ?? '').trim() || 'operator'}.`,
      status: 'success',
    };
  } catch (error) {
    return { message: operationsHandoffErrorMessage(error), status: 'error' };
  }
}

export async function acknowledgeOperationsShiftHandoff(formData: FormData): Promise<OperationsHandoffActionState> {
  const handoffId = String(formData.get('handoffId') ?? '').trim();
  if (!handoffId) return { message: 'This handoff is no longer available.', status: 'error' };

  try {
    const result = await adminPostOrThrow<{ acknowledgedAt: string }>(
      `/admin/operations-handoff/shift/${encodeURIComponent(handoffId)}/acknowledge`,
      {},
    );
    revalidatePath('/operations-handoff');
    revalidatePath('/audit-log');
    return { message: `Handoff acknowledged at ${formatDateTime(result.acknowledgedAt)}.`, status: 'success' };
  } catch (error) {
    return { message: operationsHandoffErrorMessage(error), status: 'error' };
  }
}

function operationsHandoffErrorMessage(error: unknown) {
  if (!(error instanceof AdminApiRequestError)) return 'Handoff could not be saved. Try again.';
  if (error.status === 401 || error.status === 403) {
    return 'You do not have permission to send or acknowledge this handoff.';
  }

  const payload = error.payload as { message?: string | string[] } | undefined;
  const message = Array.isArray(payload?.message) ? payload.message[0] : payload?.message;
  if (message) return message;
  if (error.status === 409) return 'Some selected cases are no longer open. Review the list and try again.';
  return 'Handoff could not be saved. Try again.';
}
