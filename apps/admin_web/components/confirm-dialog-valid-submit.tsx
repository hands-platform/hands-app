'use client';

import { useEffect, useRef, useState } from 'react';

import type { StatusBadgeTone } from './status-badge';
import { statusBadgeClassName } from './status-badge';

type ConfirmDialogValidSubmitProps = {
  readonly disabled: boolean;
  readonly label: string;
  readonly tone: StatusBadgeTone;
};

export function ConfirmDialogValidSubmit({ disabled, label, tone }: ConfirmDialogValidSubmitProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [formValid, setFormValid] = useState(false);

  useEffect(() => {
    const form = buttonRef.current?.form;
    if (!form) return;
    const updateValidity = () => setFormValid(form.checkValidity());
    updateValidity();
    form.addEventListener('input', updateValidity);
    form.addEventListener('change', updateValidity);
    return () => {
      form.removeEventListener('input', updateValidity);
      form.removeEventListener('change', updateValidity);
    };
  }, []);

  const submitDisabled = disabled || !formValid;
  return (
    <button
      className={statusBadgeClassName(submitDisabled ? 'neutral' : tone)}
      disabled={submitDisabled}
      ref={buttonRef}
      type="submit"
    >
      {label}
    </button>
  );
}
