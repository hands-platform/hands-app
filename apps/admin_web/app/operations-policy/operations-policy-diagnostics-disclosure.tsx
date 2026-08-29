import type { ReactNode } from 'react';

import { AdminFormControlLink } from '../../components/admin-form-controls';

type OperationsPolicyDiagnosticsDisclosureProps = {
  readonly children: ReactNode;
  readonly hideHref: string;
  readonly open: boolean;
  readonly showHref: string;
};

export function OperationsPolicyDiagnosticsDisclosure({
  children,
  hideHref,
  open,
  showHref,
}: OperationsPolicyDiagnosticsDisclosureProps) {

  return (
    <div className="operations-policy-diagnostics-disclosure">
      <AdminFormControlLink
        aria-controls="operations-policy-diagnostic-details"
        aria-expanded={open}
        className="button-secondary"
        href={open ? hideHref : showHref}
      >
        {open ? 'Hide complete diagnostics' : 'Show complete diagnostics'}
      </AdminFormControlLink>
      {open ? <div id="operations-policy-diagnostic-details">{children}</div> : null}
    </div>
  );
}
