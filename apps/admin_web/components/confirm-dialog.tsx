import { Fragment, type FormEventHandler, type ReactNode, type RefObject } from 'react';

import { AdminFormInput, AdminFormSelect } from './admin-form-controls';
import { AdminSectionHeader } from './admin-page-template';
import { ConfirmDialogFocusBoundary } from './confirm-dialog-focus-boundary';
import { ConfirmDialogValidSubmit } from './confirm-dialog-valid-submit';
import type { StatusBadgeTone } from './status-badge';
import { StatusBadge, StatusBadgeButton, StatusBadgeLink, statusBadgeClassName } from './status-badge';

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

type ConfirmDialogSelectInput = {
  readonly defaultValue?: string;
  readonly label: string;
  readonly name: string;
  readonly options: readonly { readonly label: string; readonly value: string }[];
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
  readonly onCancel?: () => void;
  readonly onSubmit?: FormEventHandler<HTMLFormElement>;
  readonly requireValidForm?: boolean;
  readonly returnFocusRef?: RefObject<HTMLElement | null>;
  readonly selectInputs?: readonly ConfirmDialogSelectInput[];
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
  onCancel,
  onSubmit,
  requireValidForm = false,
  returnFocusRef,
  selectInputs = [],
  supportingLinks = [],
  textInputs = [],
  title,
  tone = 'danger',
}: ConfirmDialogProps) {
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;
  const confirmState = confirmDialogButtonState({ confirmLabel, disabled, loading, loadingLabel });

  return (
    <ConfirmDialogFocusBoundary
      ariaDescribedBy={descriptionId}
      ariaLabelledBy={titleId}
      cancelHref={cancelHref}
      id={id}
      loading={loading}
      onCancel={onCancel}
      returnFocusRef={returnFocusRef}
    >
      <Fragment>
        <AdminSectionHeader
          actions={<StatusBadge tone={tone}>Review</StatusBadge>}
          title={title}
          titleId={titleId}
        />
        <div className="muted confirm-dialog-description" id={descriptionId}>{description}</div>
      </Fragment>
      <div className="actions confirm-dialog-actions">
        <StatusBadgeLink href={cancelHref} tone="neutral">
          {cancelLabel}
        </StatusBadgeLink>
        <form action={action} className="confirm-dialog-form" onSubmit={onSubmit}>
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
          {selectInputs.map((input) => (
            <AdminFormSelect
              className="confirm-dialog-label"
              defaultValue={input.defaultValue}
              key={input.name}
              label={input.label}
              labelVisibility="visible"
              name={input.name}
              options={input.options}
              required={input.required}
            />
          ))}
          {requireValidForm ? (
            <ConfirmDialogValidSubmit
              disabled={confirmState.disabled}
              label={confirmState.label}
              tone={tone}
            />
          ) : (
            <StatusBadgeButton
              disabled={confirmState.disabled}
              tone={disabled || loading ? 'neutral' : tone}
              type="submit"
            >
              {confirmState.label}
            </StatusBadgeButton>
          )}
        </form>
        {supportingLinks.map((link) => (
          <StatusBadgeLink
            href={link.href}
            key={link.href}
            tone="info"
            title={link.description}
          >
            {link.label}
          </StatusBadgeLink>
        ))}
      </div>
    </ConfirmDialogFocusBoundary>
  );
}
