import Link from 'next/link';
import type { ReactNode } from 'react';

import { AdminFormInput } from './admin-form-controls';
import { AdminDialogCard } from './admin-surface';
import type { StatusBadgeTone } from './status-badge';
import { statusBadgeClassName } from './status-badge';

type FormAction = string | ((formData: FormData) => void | Promise<void>);

type ConfirmDialogHiddenInput = {
  readonly name: string;
  readonly value: boolean | number | string;
};

type ConfirmDialogTextInput = {
  readonly defaultValue?: string;
  readonly label: string;
  readonly maxLength?: number;
  readonly minLength?: number;
  readonly name: string;
  readonly placeholder?: string;
  readonly required?: boolean;
};

type ConfirmDialogSupportingLink = {
  readonly description?: string;
  readonly href: string;
  readonly label: string;
};

type ConfirmDialogProps = {
  readonly action: FormAction;
  readonly cancelHref: string;
  readonly cancelLabel?: string;
  readonly confirmLabel: string;
  readonly description: ReactNode;
  readonly disabled?: boolean;
  readonly hiddenInputs?: readonly ConfirmDialogHiddenInput[];
  readonly id: string;
  readonly loading?: boolean;
  readonly loadingLabel?: string;
  readonly supportingLinks?: readonly ConfirmDialogSupportingLink[];
  readonly textInputs?: readonly ConfirmDialogTextInput[];
  readonly title: string;
  readonly tone?: StatusBadgeTone;
};

type ConfirmDialogButtonState = {
  readonly disabled?: boolean;
  readonly loading?: boolean;
};

export function confirmDialogButtonClassName(
  tone: StatusBadgeTone = 'danger',
  state: ConfirmDialogButtonState = {},
) {
  if (state.disabled || state.loading) {
    return statusBadgeClassName('neutral');
  }
  return statusBadgeClassName(tone);
}

export function confirmDialogButtonState(input: {
  readonly confirmLabel: string;
  readonly disabled?: boolean;
  readonly loading?: boolean;
  readonly loadingLabel?: string;
}) {
  const loading = Boolean(input.loading);
  return {
    disabled: Boolean(input.disabled || loading),
    label: loading ? (input.loadingLabel ?? 'Working...') : input.confirmLabel,
  };
}

export function ConfirmDialog({
  action,
  cancelHref,
  cancelLabel = 'Cancel',
  confirmLabel,
  description,
  disabled = false,
  hiddenInputs = [],
  id,
  loading = false,
  loadingLabel = 'Working...',
  supportingLinks = [],
  textInputs = [],
  title,
  tone = 'danger',
}: ConfirmDialogProps) {
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;
  const confirmState = confirmDialogButtonState({ confirmLabel, disabled, loading, loadingLabel });

  return AdminDialogCard({
    ariaDescribedBy: descriptionId,
    ariaLabelledBy: titleId,
    className: 'admin-dialog-card',
    loading,
    children: [
      <div className="ops-section-header" key="header">
        <div>
          <h2 id={titleId}>{title}</h2>
          <p className="muted" id={descriptionId}>
            {description}
          </p>
        </div>
        <span className={statusBadgeClassName(tone)}>Review</span>
      </div>,
      <div className="actions confirm-dialog-actions" key="actions">
        <form action={action} className="confirm-dialog-form">
          {hiddenInputs.map((input) => (
            <input key={input.name} name={input.name} type="hidden" value={String(input.value)} />
          ))}
          {textInputs.map((input) => (
            <AdminFormInput
              className="confirm-dialog-label"
              defaultValue={input.defaultValue}
              key={input.name}
              label={input.label}
              labelVisibility="visible"
              maxLength={input.maxLength}
              minLength={input.minLength}
              name={input.name}
              placeholder={input.placeholder}
              required={input.required}
            />
          ))}
          <button
            className={confirmDialogButtonClassName(tone, { disabled, loading })}
            disabled={confirmState.disabled}
            type="submit"
          >
            {confirmState.label}
          </button>
        </form>
        <Link className={statusBadgeClassName('neutral')} href={cancelHref}>
          {cancelLabel}
        </Link>
        {supportingLinks.map((link) => (
          <Link
            className={statusBadgeClassName('info')}
            href={link.href}
            key={link.href}
            title={link.description}
          >
            {link.label}
          </Link>
        ))}
      </div>,
    ],
  });
}
