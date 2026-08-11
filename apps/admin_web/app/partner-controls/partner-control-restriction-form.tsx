'use client';

import { useActionState, useEffect, useId, useRef, type ReactNode } from 'react';

import { AdminFormGrid } from '../../components/admin-form-controls';
import type { PartnerControlActionState } from './actions';

type PartnerControlActionFormProps = {
  readonly action: (
    previousState: PartnerControlActionState | null,
    formData: FormData,
  ) => Promise<PartnerControlActionState>;
  readonly children: ReactNode;
  readonly className?: string;
};

export function PartnerControlActionForm({ action, children, className }: PartnerControlActionFormProps) {
  const [state, formAction, pending] = useActionState(action, null);
  const formRef = useRef<HTMLDivElement>(null);
  const errorIdPrefix = useId().replaceAll(':', '');

  useEffect(() => {
    for (const control of formRef.current?.querySelectorAll<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >('[name]') ?? []) {
      control.removeAttribute('aria-invalid');
      control.removeAttribute('aria-describedby');
      if (state?.status === 'error') {
        if (control instanceof HTMLInputElement && control.type === 'checkbox') {
          control.checked = state.values[control.name] === control.value;
        } else if (state.values[control.name] !== undefined) {
          control.value = state.values[control.name];
        }
        if (state.fieldErrors?.[control.name]) {
          control.setAttribute('aria-invalid', 'true');
          control.setAttribute('aria-describedby', `${errorIdPrefix}-${control.name}-error`);
        }
      }
    }
  }, [errorIdPrefix, state]);

  return (
    <div ref={formRef}>
      <AdminFormGrid action={formAction} aria-busy={pending} className={className}>
        {children}
        {state ? (
          <div
            aria-live="polite"
            className={`admin-grid-span-2 partner-control-form-result ${
              state.status === 'error' ? 'text-danger' : 'text-success'
            }`}
            role={state.status === 'error' ? 'alert' : 'status'}
          >
            <p>{state.message}</p>
            {state.fieldErrors ? (
              <ul>
                {Object.entries(state.fieldErrors).map(([field, message]) => (
                  <li id={`${errorIdPrefix}-${field}-error`} key={field}>
                    {message}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </AdminFormGrid>
    </div>
  );
}

export const PartnerControlRestrictionForm = PartnerControlActionForm;
