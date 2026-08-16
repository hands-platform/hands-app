'use client';

import { useEffect } from 'react';

export function CmsPreviewBootstrap() {
  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const token = fragment.get('cmsPreview');
    if (!token) return;

    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    void fetch('/api/cms-preview-session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: window.location.pathname, token }),
      credentials: 'same-origin',
    }).then((response) => {
      if (response.ok) window.location.reload();
    });
  }, []);

  return null;
}
