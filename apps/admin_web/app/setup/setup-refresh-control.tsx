'use client';

import { RefreshCw } from 'lucide-react';
import { useActionState, useEffect, useRef } from 'react';

import { AdminFormControlButton } from '../../components/admin-form-controls';
import { refreshExternalServices, type SetupRefreshState } from './actions';

const INITIAL_SETUP_REFRESH_STATE: SetupRefreshState = {
  message: '',
  status: 'idle',
};

export function SetupRefreshControl() {
  const [state, action, pending] = useActionState(refreshExternalServices, INITIAL_SETUP_REFRESH_STATE);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && state.status !== 'idle') {
      formRef.current?.querySelector('button')?.focus();
    }
  }, [pending, state.status]);

  return (
    <form action={action} className="setup-refresh-control" ref={formRef}>
      <AdminFormControlButton
        aria-label="Refresh External Services status"
        className="button-secondary"
        disabled={pending}
        type="submit"
      >
        <RefreshCw aria-hidden="true" className={pending ? 'is-spinning' : undefined} size={16} />
        {pending ? 'Refreshing' : 'Refresh now'}
      </AdminFormControlButton>
      <span
        aria-live="polite"
        className={state.status === 'error' ? 'setup-refresh-message is-error' : 'setup-refresh-message'}
        role="status"
      >
        {pending ? 'Refreshing external service status.' : state.message}
      </span>
    </form>
  );
}
