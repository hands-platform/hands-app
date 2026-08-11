'use client';

import { RefreshCw } from 'lucide-react';
import { useState } from 'react';

import { AdminFormControlButton } from '../../components/admin-form-controls';

export function UsageOverviewRefreshButton() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  return (
    <>
      <AdminFormControlButton
        aria-label="Refresh Customer Usage report"
        className="button-secondary usage-overview-refresh-button"
        disabled={isRefreshing}
        onClick={() => {
          if (isRefreshing) return;
          setIsRefreshing(true);
          setAnnouncement('Refreshing Customer Usage report.');
          window.location.reload();
        }}
        type="button"
      >
        <RefreshCw aria-hidden="true" className={isRefreshing ? 'is-spinning' : undefined} size={16} />
        {isRefreshing ? 'Refreshing' : 'Refresh now'}
      </AdminFormControlButton>
      <span aria-live="polite" className="sr-only" role="status">{announcement}</span>
    </>
  );
}
