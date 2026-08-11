'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { AdminFormControlButton } from './admin-form-controls';

type StartShiftRefreshButtonProps = {
  readonly refreshIntervalMs?: number;
};

const DEFAULT_REFRESH_INTERVAL_MS = 60_000;

export function StartShiftRefreshButton({
  refreshIntervalMs = DEFAULT_REFRESH_INTERVAL_MS,
}: StartShiftRefreshButtonProps) {
  const router = useRouter();
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isPending, startTransition] = useTransition();
  const refresh = useCallback(() => {
    setUpdateAvailable(false);
    startTransition(() => {
      router.refresh();
    });
  }, [router]);

  useEffect(() => {
    const operatorIsInteracting = () => {
      const activeElement = document.activeElement;
      return activeElement instanceof HTMLElement && activeElement !== document.body && activeElement.matches(
        'a, button, input, select, textarea, [role="button"], [role="menuitem"], [role="tab"]',
      );
    };
    const refreshVisiblePage = () => {
      if (document.visibilityState !== 'visible') {
        return;
      }
      if (operatorIsInteracting()) {
        setUpdateAvailable(true);
        return;
      }
      refresh();
    };
    const intervalId = window.setInterval(refreshVisiblePage, refreshIntervalMs);

    document.addEventListener('visibilitychange', refreshVisiblePage);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', refreshVisiblePage);
    };
  }, [refresh, refreshIntervalMs]);

  return (
    <>
      <AdminFormControlButton
        aria-label="Refresh Start Shift data"
        className="button-secondary start-shift-refresh-button"
        disabled={isPending}
        onClick={refresh}
        title={updateAvailable ? 'New data — refresh' : 'Refresh Start Shift data'}
        type="button"
      >
        <RefreshCw
          aria-hidden="true"
          className={isPending ? 'start-shift-refresh-icon is-spinning' : 'start-shift-refresh-icon'}
          size={16}
        />
        {isPending ? 'Refreshing' : updateAvailable ? 'New data — refresh' : 'Refresh'}
      </AdminFormControlButton>
      <span className="sr-only" role="status">
        {updateAvailable ? 'New dashboard data is available.' : ''}
      </span>
    </>
  );
}
