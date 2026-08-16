'use server';

export type OperatorSetupState = {
  readonly error?: string;
  readonly fieldErrors?: Record<string, string>;
  readonly status: 'idle' | 'error' | 'success';
};

export const INITIAL_OPERATOR_SETUP_STATE: OperatorSetupState = { status: 'idle' };

export async function acceptOperatorInvitation(
  _previousState: OperatorSetupState,
  formData: FormData,
): Promise<OperatorSetupState> {
  const token = String(formData.get('token') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const confirmation = String(formData.get('passwordConfirmation') ?? '');
  const fieldErrors: Record<string, string> = {};

  if (!token || token.length > 256) fieldErrors.token = 'Open the complete one-time setup link from your invitation.';
  if (password.length < 12 || password.length > 256) {
    fieldErrors.password = 'Use a password between 12 and 256 characters.';
  }
  if (password !== confirmation) fieldErrors.passwordConfirmation = 'The password confirmation does not match.';
  if (Object.keys(fieldErrors).length) {
    return { status: 'error', error: 'Review the highlighted fields. No operator account was created.', fieldErrors };
  }

  try {
    const apiBaseUrl = process.env.ADMIN_API_BASE_URL ?? 'http://localhost:3000/api';
    const response = await fetch(`${apiBaseUrl}/auth/admin-operator-invitations/accept`, {
      body: JSON.stringify({ password, token }),
      cache: 'no-store',
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    if (response.ok) return { status: 'success' };

    const payload = await response.json().catch(() => null) as { code?: string } | null;
    if (response.status === 409 || payload?.code === 'ADMIN_OPERATOR_INVITATION_INVALID') {
      return { status: 'error', error: 'This setup link is expired, already used, or no longer valid.' };
    }
    if (response.status >= 500) {
      return { status: 'error', error: 'Operator setup is temporarily unavailable. Your invitation was not consumed.' };
    }
    return { status: 'error', error: 'Operator setup could not be completed. Check the invitation and try again.' };
  } catch {
    return { status: 'error', error: 'Operator setup is temporarily unavailable. Your invitation was not consumed.' };
  }
}
