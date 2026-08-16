'use client';

import {
  createContext,
  type ReactNode,
  useActionState,
  useContext,
  useEffect,
  useRef,
} from 'react';

import { AdminInlineNotice } from '../../components/admin-inline-notice';
import {
  INITIAL_TAX_POLICY_ACTION_STATE,
  type TaxPolicyActionState,
} from './action-state';

type TaxPolicyServerAction = (
  state: TaxPolicyActionState,
  formData: FormData,
) => Promise<TaxPolicyActionState>;

const TaxPolicyFormContext = createContext<{ formId: string; state: TaxPolicyActionState } | null>(null);

export function TaxPolicyActionForm({
  action,
  children,
  className,
  id,
}: {
  readonly action: TaxPolicyServerAction;
  readonly children: ReactNode;
  readonly className: string;
  readonly id: string;
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL_TAX_POLICY_ACTION_STATE);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    form.querySelectorAll<HTMLElement>('[aria-invalid="true"]').forEach((field) => field.removeAttribute('aria-invalid'));
    form.querySelectorAll<HTMLElement>('[data-tax-policy-field-message]').forEach((message) => {
      const name = message.dataset.taxPolicyFieldMessage;
      if (!name) return;
      const field = visibleFormField(form, name);
      if (!field) return;
      field.id ||= `${id}-${name}`;
      const describedBy = new Set((field.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean));
      describedBy.add(message.id);
      field.setAttribute('aria-describedby', [...describedBy].join(' '));
    });
    if (state.status !== 'error') return;
    Object.entries(state.values ?? {}).forEach(([name, value]) => {
      const fields = form.elements.namedItem(name);
      if (fields instanceof HTMLInputElement && fields.type === 'checkbox') {
        fields.checked = value === 'on' || value === 'true';
      } else if (fields instanceof HTMLInputElement || fields instanceof HTMLTextAreaElement || fields instanceof HTMLSelectElement) {
        fields.value = value;
      }
    });
    Object.keys(state.fieldErrors ?? {}).forEach((name) => {
      const field = visibleFormField(form, name);
      if (!field) return;
      field.id ||= `${id}-${name}`;
      field.setAttribute('aria-invalid', 'true');
      const describedBy = new Set((field.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean));
      describedBy.add(`${id}-${name}-message`);
      field.setAttribute('aria-describedby', [...describedBy].join(' '));
    });
    const firstField = Object.keys(state.fieldErrors ?? {})[0];
    const target = firstField ? visibleFormField(form, firstField) : null;
    if (target) {
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' });
    } else {
      form.querySelector<HTMLElement>('[data-tax-policy-error-summary]')?.focus();
    }
  }, [id, state]);

  return (
    <TaxPolicyFormContext.Provider value={{ formId: id, state }}>
      <form action={formAction} className={className} id={id} ref={formRef}>
        {state.status === 'error' ? (
          <div className="tax-policy-action-error-summary" data-tax-policy-error-summary tabIndex={-1}>
            <AdminInlineNotice role="alert" tone="danger">
              <strong>Review the highlighted fields</strong>
              <span>{state.error}</span>
              {state.code ? <code>{state.code}</code> : null}
              {Object.entries(state.fieldErrors ?? {}).map(([name, message]) => (
                <a href={`#${id}-${name}`} key={name}>{message}</a>
              ))}
            </AdminInlineNotice>
          </div>
        ) : null}
        <fieldset disabled={pending}>{children}</fieldset>
      </form>
    </TaxPolicyFormContext.Provider>
  );
}

export function TaxPolicyFieldMessage({ helper, name }: { readonly helper?: string; readonly name: string }) {
  const context = useContext(TaxPolicyFormContext);
  if (!context) return helper ? <small className="muted">{helper}</small> : null;
  const error = context.state.fieldErrors?.[name];
  if (!error && !helper) return null;
  return (
    <small
      className={error ? 'tax-policy-field-error' : 'muted'}
      data-tax-policy-field-message={name}
      id={`${context.formId}-${name}-message`}
    >
      {error ?? helper}
    </small>
  );
}

function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function visibleFormField(form: HTMLFormElement, name: string) {
  const field = form.elements.namedItem(name);
  if (!(field instanceof HTMLElement)) return null;
  if (!(field instanceof HTMLInputElement) || field.type !== 'hidden') return field;
  return field.previousElementSibling?.querySelector<HTMLElement>(
    'input:not([type="hidden"]), select, textarea, button',
  ) ?? null;
}
