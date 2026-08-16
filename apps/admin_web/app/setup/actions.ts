'use server';

import { revalidatePath } from 'next/cache';

import { type AdminExternalReadiness, adminGetResult } from '../../lib/admin-api';

export type SetupRefreshState = {
  readonly message: string;
  readonly status: 'idle' | 'success' | 'error';
};

export async function refreshExternalServices(
  previousState: SetupRefreshState,
  formData: FormData,
): Promise<SetupRefreshState> {
  void previousState;
  void formData;

  const startedAt = Date.now();

  const result = await adminGetResult<AdminExternalReadiness | null>('/health/external', null);
  if (process.env.NODE_ENV !== 'test') {
    const remainingPendingTime = Math.max(0, 600 - (Date.now() - startedAt));
    await new Promise((resolve) => setTimeout(resolve, remainingPendingTime));
  }

  if (!result.ok || !result.data) {
    return {
      message: 'External service status could not be refreshed. The existing snapshot remains visible.',
      status: 'error',
    };
  }

  revalidatePath('/setup');
  return {
    message: 'External service status refreshed.',
    status: 'success',
  };
}
