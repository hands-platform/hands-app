import type { AdminProviderWalletWithdrawalRequest } from '../lib/admin-api';
import { formatMoney } from '../lib/admin-format';

type AdminWithdrawalAccountingPreviewProps = {
  readonly request: AdminProviderWalletWithdrawalRequest;
};

export function AdminWithdrawalAccountingPreview({ request }: AdminWithdrawalAccountingPreviewProps) {
  const lines = withdrawalAccountingPreviewLines(request);
  if (lines.length === 0) {
    return null;
  }

  return (
    <div className="admin-mini-ledger" aria-label={`Accounting preview for withdrawal ${request.id}`}>
      <span>Accounting preview</span>
      {lines.map((line) => (
        <small key={line}>{line}</small>
      ))}
    </div>
  );
}

export function withdrawalAccountingPreviewLines(request: AdminProviderWalletWithdrawalRequest) {
  const amount = formatMoney(request.amount, request.currency);
  if (request.status === 'PAID') {
    return [`Dr Partner withdrawal payable ${amount}`, `Cr Bank ${amount}`];
  }
  if (
    request.status === 'REJECTED' ||
    request.status === 'CANCELLED' ||
    request.status === 'FAILED' ||
    request.status === 'REVERSED'
  ) {
    return [`Dr Partner withdrawal payable ${amount}`, `Cr Partner wallet liability ${amount}`];
  }
  if (
    request.status === 'REQUESTED' ||
    request.status === 'APPROVED' ||
    request.status === 'BANK_TRANSFER_PENDING' ||
    request.status === 'REVIEW_REQUIRED' ||
    request.status === 'HOLD' ||
    request.status === 'NEEDS_BANK_CORRECTION'
  ) {
    return [`Dr Partner wallet liability ${amount}`, `Cr Partner withdrawal payable ${amount}`];
  }
  return [];
}
