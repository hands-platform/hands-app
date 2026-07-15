import type { ReactNode } from 'react';

import { FinanceActionConfirmationDisclosure } from '../finance-action-confirmation-disclosure';

type BankReconciliationConfirmationDisclosureProps = {
  readonly auditDetail?: ReactNode;
  readonly buttonType?: 'button' | 'submit';
  readonly className?: string;
  readonly confirmLabel: string;
  readonly detail: ReactNode;
  readonly disabled?: boolean;
  readonly onConfirm?: () => void;
  readonly title: string;
  readonly tone?: 'danger' | 'primary' | 'secondary';
};

export function BankReconciliationConfirmationDisclosure({
  auditDetail = 'Submitting records the entered source, amount, approver, and evidence in the reconciliation audit trail.',
  buttonType = 'submit',
  className,
  confirmLabel,
  detail,
  disabled = false,
  onConfirm,
  title,
  tone = 'primary',
}: BankReconciliationConfirmationDisclosureProps) {
  return (
    <FinanceActionConfirmationDisclosure
      auditDetail={auditDetail}
      buttonType={buttonType}
      className={['finance-reconciliation-confirmation', className].filter(Boolean).join(' ')}
      confirmLabel={confirmLabel}
      detail={detail}
      disabled={disabled}
      onConfirm={onConfirm}
      title={title}
      tone={tone}
    />
  );
}
