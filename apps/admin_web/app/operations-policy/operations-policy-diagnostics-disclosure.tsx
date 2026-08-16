'use client';

import { useState, type ReactNode } from 'react';

import { AdminFormControlButton } from '../../components/admin-form-controls';

export function OperationsPolicyDiagnosticsDisclosure({ children }: { readonly children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="operations-policy-diagnostics-disclosure">
      <AdminFormControlButton
        aria-controls="operations-policy-diagnostic-details"
        aria-expanded={open}
        className="button-secondary"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        {open ? 'Hide diagnostic details' : 'Show diagnostic details'}
      </AdminFormControlButton>
      {open ? <div id="operations-policy-diagnostic-details">{children}</div> : null}
    </div>
  );
}
