import type { ReactNode } from 'react';

import {
  AdminFormActionRow,
  AdminFormControlButton,
} from '../../components/admin-form-controls';
import { AdminDisclosure } from '../../components/admin-surface';

export type FinanceActionConfirmationDisclosureProps = {
  readonly auditDetail?: ReactNode;
  readonly buttonType?: 'button' | 'submit';
  readonly className?: string;
  readonly confirmLabel: string;
  readonly detail: ReactNode;
  readonly disabled?: boolean;
  readonly onConfirm?: () => void;
  readonly secondaryAction?: ReactNode;
  readonly title: string;
  readonly tone?: 'danger' | 'primary' | 'secondary';
};

export function FinanceActionConfirmationDisclosure({
  auditDetail = 'Submitting records the operator, separate approver, action details, and evidence in the Finance audit trail.',
  buttonType = 'submit',
  className,
  confirmLabel,
  detail,
  disabled = false,
  onConfirm,
  secondaryAction,
  title,
  tone = 'primary',
}: FinanceActionConfirmationDisclosureProps) {
  const buttonClassName = tone === 'danger' ? 'button-danger' : tone === 'secondary' ? 'button-secondary' : undefined;
  return (
    <AdminDisclosure className={['finance-action-confirmation', className].filter(Boolean).join(' ')}>
      <summary>
        <span>{title}</span>
        <small>{detail}</small>
      </summary>
      <AdminFormActionRow className="finance-reconciliation-form-actions admin-mt-12">
        <AdminFormControlButton
          className={buttonClassName}
          disabled={disabled}
          onClick={onConfirm}
          type={buttonType}
        >
          {confirmLabel}
        </AdminFormControlButton>
        {secondaryAction}
        <span className="muted">{auditDetail}</span>
      </AdminFormActionRow>
    </AdminDisclosure>
  );
}
