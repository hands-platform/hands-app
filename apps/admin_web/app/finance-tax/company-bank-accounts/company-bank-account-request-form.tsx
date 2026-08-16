'use client';

import { createContext, useActionState, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { AdminFormControlButton, AdminFormControlLink, AdminFormInput } from '../../../components/admin-form-controls';
import { AdminInlineNotice } from '../../../components/admin-inline-notice';

export type CompanyBankAccountRequestFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  receipt?: {
    makerId: string | null;
    queueHref: string;
    requestId: string;
    submittedAt: string | null;
  };
  status: 'idle' | 'error' | 'success';
};

export const INITIAL_COMPANY_BANK_ACCOUNT_REQUEST_FORM_STATE: CompanyBankAccountRequestFormState = {
  status: 'idle',
};

const CompanyBankAccountFieldErrorsContext = createContext<Record<string, string>>({});

type CompanyBankAccountRequestFormProps = {
  readonly action: (
    previousState: CompanyBankAccountRequestFormState,
    formData: FormData,
  ) => Promise<CompanyBankAccountRequestFormState>;
  readonly children: ReactNode;
  readonly className?: string;
};

export function CompanyBankAccountRequestForm({
  action,
  children,
  className,
}: CompanyBankAccountRequestFormProps) {
  const [state, formAction, pending] = useActionState(
    action,
    INITIAL_COMPANY_BANK_ACCOUNT_REQUEST_FORM_STATE,
  );
  const resultRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status !== 'idle') resultRef.current?.focus();
  }, [state]);

  useEffect(() => {
    for (const element of formRef.current?.querySelectorAll<HTMLElement>('[name]') ?? []) {
      element.removeAttribute('aria-invalid');
      const original = element.dataset.companyBankAccountOriginalDescribedBy;
      if (original === undefined) continue;
      if (original) element.setAttribute('aria-describedby', original);
      else element.removeAttribute('aria-describedby');
      delete element.dataset.companyBankAccountOriginalDescribedBy;
    }
    const fields = state.fieldErrors ? Object.keys(state.fieldErrors) : [];
    for (const field of fields) {
      const element = formRef.current?.querySelector<HTMLElement>(`[name="${CSS.escape(field)}"]`);
      if (!element) continue;
      element.setAttribute('aria-invalid', 'true');
      element.dataset.companyBankAccountOriginalDescribedBy = element.getAttribute('aria-describedby') ?? '';
      const errorId = `company-bank-account-${field}-error`;
      element.setAttribute(
        'aria-describedby',
        [element.dataset.companyBankAccountOriginalDescribedBy, errorId].filter(Boolean).join(' '),
      );
    }
  }, [state.fieldErrors]);

  if (state.status === 'success' && state.receipt) {
    return <CompanyBankAccountRequestReceipt receipt={state.receipt} resultRef={resultRef} />;
  }

  return (
    <form action={formAction} className={`calendar-form-grid ${className ?? ''}`.trim()} ref={formRef}>
      {state.status === 'error' ? (
        <div ref={resultRef} tabIndex={-1}>
          <AdminInlineNotice role="alert" tone="danger">
            {state.error ?? 'The request could not be submitted. Review the form and try again.'}
          </AdminInlineNotice>
          {state.fieldErrors && Object.keys(state.fieldErrors).length > 0 ? (
            <ul className="company-bank-account-field-errors" aria-label="Fields requiring attention">
              {Object.entries(state.fieldErrors).map(([field, message]) => (
                <li key={field}>
                  <AdminFormControlButton
                    className="text-link admin-link-button"
                    onClick={() => document.querySelector<HTMLElement>(`[name="${CSS.escape(field)}"]`)?.focus()}
                    type="button"
                  >
                    {message}
                  </AdminFormControlButton>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <fieldset className="company-bank-account-request-fields" disabled={pending}>
        <CompanyBankAccountFieldErrorsContext.Provider value={state.fieldErrors ?? {}}>
          {children}
        </CompanyBankAccountFieldErrorsContext.Provider>
      </fieldset>
      {pending ? <p aria-live="polite" className="muted">Submitting the approval request…</p> : null}
    </form>
  );
}

export function CompanyBankAccountFieldError({ field }: { readonly field: string }) {
  const message = useContext(CompanyBankAccountFieldErrorsContext)[field];
  return message ? (
    <p className="company-bank-account-adjacent-error" id={`company-bank-account-${field}-error`} role="alert">
      {message}
    </p>
  ) : null;
}

export function CompanyBankAccountRequestReceipt({
  receipt,
  resultRef,
}: {
  readonly receipt: NonNullable<CompanyBankAccountRequestFormState['receipt']>;
  readonly resultRef?: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="company-bank-account-request-receipt" ref={resultRef} tabIndex={-1}>
      <AdminInlineNotice role="status" tone="success">
        The account request was submitted to a different Finance approver.
      </AdminInlineNotice>
      <dl>
        <div><dt>Request ID</dt><dd>{shortReceiptIdentifier(receipt.requestId)}</dd></div>
        <div><dt>Maker</dt><dd>{receipt.makerId ? shortReceiptIdentifier(receipt.makerId) : 'Not returned by the API'}</dd></div>
        <div>
          <dt>Submitted</dt>
          <dd>
            {receipt.submittedAt ? (
              <time dateTime={receipt.submittedAt}>{formatVietnamDateTime(receipt.submittedAt)}</time>
            ) : 'Not returned by the API'}
          </dd>
        </div>
        <div><dt>Next step</dt><dd>Review by an eligible checker</dd></div>
      </dl>
      <div className="actions">
        <AdminFormControlLink className="button-primary" href={receipt.queueHref}>
          Open exact approval request
        </AdminFormControlLink>
        <AdminFormControlLink className="button-secondary" href="/finance-tax/company-bank-accounts">
          Return to accounts
        </AdminFormControlLink>
      </div>
    </div>
  );
}

export function CompanyBankAccountLast4Input() {
  const [last4, setLast4] = useState('');
  const maskPreview = /^[0-9]{4}$/u.test(last4) ? `•••• ${last4}` : 'Enter exactly four digits to preview the stored mask.';

  return (
    <div className="company-bank-account-last4-field">
      <AdminFormInput
        ariaDescribedBy="company-bank-account-last4-preview"
        label="Last four digits"
        labelVisibility="visible"
        maxLength={4}
        minLength={4}
        name="accountNumberLast4"
        inputMode="numeric"
        onChange={(event) => setLast4(event.target.value)}
        pattern="[0-9]{4}"
        placeholder="1234"
        required
        value={last4}
      />
      <p aria-live="polite" className="muted" id="company-bank-account-last4-preview">
        Stored mask preview: <strong>{maskPreview}</strong>
      </p>
    </div>
  );
}

function formatVietnamDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Submitted just now';
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(date);
}

function shortReceiptIdentifier(value: string) {
  return value.length <= 12 ? value : `${value.slice(0, 8)}…`;
}
