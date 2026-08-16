import { acceptOperatorInvitation, INITIAL_OPERATOR_SETUP_STATE } from './actions';

describe('operator setup action', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('submits the one-time token and password to the public API', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
    const formData = new FormData();
    formData.set('token', 'one-time-token');
    formData.set('password', 'long-admin-password');
    formData.set('passwordConfirmation', 'long-admin-password');

    await expect(acceptOperatorInvitation(INITIAL_OPERATOR_SETUP_STATE, formData)).resolves.toEqual({ status: 'success' });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/auth/admin-operator-invitations/accept',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ password: 'long-admin-password', token: 'one-time-token' }) }),
    );
  });

  it('does not call the API when password confirmation differs', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const formData = new FormData();
    formData.set('token', 'one-time-token');
    formData.set('password', 'long-admin-password');
    formData.set('passwordConfirmation', 'different-password');

    await expect(acceptOperatorInvitation(INITIAL_OPERATOR_SETUP_STATE, formData)).resolves.toMatchObject({
      status: 'error',
      fieldErrors: { passwordConfirmation: expect.any(String) },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
