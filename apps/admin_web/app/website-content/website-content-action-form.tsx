'use client';

import { Children, cloneElement, isValidElement, useActionState, useEffect, useRef, type ReactElement, type ReactNode } from 'react';

import { AdminFormActionRow, AdminFormControlButton, AdminFormGrid } from '../../components/admin-form-controls';
import { AdminNoticeCard } from '../../components/admin-surface';
import type { WebsiteContentActionState } from './actions';

const initialState: WebsiteContentActionState = { status: 'idle' };

type WebsiteContentAction = (
  state: WebsiteContentActionState,
  formData: FormData,
) => Promise<WebsiteContentActionState>;

export function WebsiteContentActionForm({
  action,
  children,
  disabled = false,
  fieldsClassName,
  submitLabel,
}: {
  action: WebsiteContentAction;
  children: ReactNode;
  disabled?: boolean;
  fieldsClassName?: string;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const errorRef = useRef<HTMLDivElement>(null);
  const fieldErrors = state.fieldErrors ?? {};
  const formDisabled = disabled || !Children.toArray(children).some((child) => {
    if (!isValidElement(child)) return false;
    const props = child.props as { disabled?: boolean; name?: string; type?: string };
    return Boolean(props.name) && props.type !== 'hidden' && props.disabled !== true;
  });

  useEffect(() => {
    if (state.status !== 'error') return;
    const firstField = Object.keys(state.fieldErrors ?? {})[0];
    const form = errorRef.current?.closest('form');
    const target = firstField ? form?.elements.namedItem(firstField) : null;
    if (target instanceof HTMLElement) target.focus();
    else errorRef.current?.focus();
  }, [state]);

  const fields = Children.map(children, (child) => {
    if (!isValidElement(child)) return child;
    const field = child as ReactElement<{ name?: string; ariaInvalid?: boolean; ariaDescribedBy?: string }>;
    const name = field.props.name;
    const message = name ? fieldErrors[name] : null;
    if (!name || !message) return child;
    const errorId = `website-content-${name}-error`;
    return (
      <div className="website-content-field-with-error">
        {cloneElement(field, { ariaInvalid: true, ariaDescribedBy: errorId })}
        <p className="website-content-field-error" id={errorId}>{message}</p>
      </div>
    );
  });

  return (
    <AdminFormGrid action={formAction} className="website-content-action-form">
      {state.status === 'error' ? (
        <AdminNoticeCard className="form-grid-wide website-content-action-notice" role="alert" tone="danger">
          <div ref={errorRef} tabIndex={-1}>
            <strong>Could not save this Draft</strong>
            <p>{state.error}</p>
            {Object.entries(state.fieldErrors ?? {}).length ? (
              <ul>{Object.entries(state.fieldErrors ?? {}).map(([field, message]) => <li key={field}><AdminFormControlButton className="text-link" onClick={() => { const element = errorRef.current?.closest('form')?.elements.namedItem(field); if (element instanceof HTMLElement) element.focus(); }} type="button">{field}: {message}</AdminFormControlButton></li>)}</ul>
            ) : null}
            {state.retryMode === 'reload-first' ? <p><AdminFormControlButton className="text-link" onClick={() => window.location.reload()} type="button">Reload current page state</AdminFormControlButton></p> : null}
          </div>
        </AdminNoticeCard>
      ) : null}
      <fieldset className={`website-content-action-fields form-grid-wide${fieldsClassName ? ` ${fieldsClassName}` : ''}`} disabled={pending || formDisabled}>
        {fields}
      </fieldset>
      <AdminFormActionRow>
        <AdminFormControlButton className="button-primary" disabled={pending || formDisabled} type="submit">
          {pending ? 'Saving…' : submitLabel}
        </AdminFormControlButton>
      </AdminFormActionRow>
    </AdminFormGrid>
  );
}
