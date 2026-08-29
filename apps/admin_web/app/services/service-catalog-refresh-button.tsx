'use client';

import { useActionState } from 'react';
import { RefreshCw } from 'lucide-react';

import { AdminFormControlButton } from '../../components/admin-form-controls';
import { refreshServiceCatalog } from './actions';
import { initialServiceCatalogRefreshState } from './service-catalog-action-state';

export function ServiceCatalogRefreshButton() {
  const [state, action, pending] = useActionState(
    refreshServiceCatalog,
    initialServiceCatalogRefreshState,
  );
  return (
    <form action={action}>
      <AdminFormControlButton className="button-secondary" disabled={pending} type="submit">
        <RefreshCw aria-hidden="true" size={16} />
        {pending ? 'Refreshing…' : state.status === 'refreshed' ? 'Refreshed' : 'Refresh'}
      </AdminFormControlButton>
      <span className="sr-only" role={state.status === 'error' ? 'alert' : 'status'}>
        {state.message ?? ''}
      </span>
    </form>
  );
}
