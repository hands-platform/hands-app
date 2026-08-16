'use client';

import { useActionState, useEffect, useRef, type ReactNode } from 'react';

import { AdminInlineNotice } from '../../../components/admin-inline-notice';
import { ConfirmDialog } from '../../../components/confirm-dialog';
import type { StatusBadgeTone } from '../../../components/status-badge';
import {
  CompanyBankAccountRequestReceipt,
  INITIAL_COMPANY_BANK_ACCOUNT_REQUEST_FORM_STATE,
  type CompanyBankAccountRequestFormState,
} from './company-bank-account-request-form';

type CompanyBankAccountStatusDialogProps = {
  readonly action: (
    previousState: CompanyBankAccountRequestFormState,
    formData: FormData,
  ) => Promise<CompanyBankAccountRequestFormState>;
  readonly cancelHref: string;
  readonly confirmLabel: string;
  readonly description: ReactNode;
  readonly disabled?: boolean;
  readonly hiddenInputs: readonly { name: string; value: boolean | number | string }[];
  readonly id: string;
  readonly supportingLinks?: readonly { description?: string; href: string; label: string }[];
  readonly textInputs: readonly {
    label: string;
    maxLength?: number;
    minLength?: number;
    name: string;
    placeholder?: string;
    required?: boolean;
  }[];
  readonly title: string;
  readonly tone: StatusBadgeTone;
};

export function CompanyBankAccountStatusDialog({
  action,
  cancelHref,
  confirmLabel,
  description,
  disabled,
  hiddenInputs,
  id,
  supportingLinks,
  textInputs,
  title,
  tone,
}: CompanyBankAccountStatusDialogProps) {
  const [state, formAction, pending] = useActionState(
    action,
    INITIAL_COMPANY_BANK_ACCOUNT_REQUEST_FORM_STATE,
  );
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.status !== 'idle') resultRef.current?.focus();
  }, [state.status]);

  if (state.status === 'success' && state.receipt) {
    return <CompanyBankAccountRequestReceipt receipt={state.receipt} resultRef={resultRef} />;
  }

  return (
    <>
      {state.status === 'error' ? (
        <div className="company-bank-account-status-error" ref={resultRef} tabIndex={-1}>
          <AdminInlineNotice role="alert" tone="danger">
            {state.error ?? 'The status request could not be submitted. Review the latest preflight and try again.'}
          </AdminInlineNotice>
        </div>
      ) : null}
      <ConfirmDialog
        action={formAction}
        cancelHref={cancelHref}
        confirmLabel={confirmLabel}
        description={description}
        disabled={disabled}
        hiddenInputs={hiddenInputs}
        id={id}
        loading={pending}
        loadingLabel="Submitting…"
        requireValidForm
        supportingLinks={supportingLinks}
        textInputs={textInputs}
        title={title}
        tone={tone}
      />
    </>
  );
}
