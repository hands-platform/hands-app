import { createElement, Fragment, type ReactNode } from 'react';

import type { AdminProviderWalletWithdrawalRequest } from '../lib/admin-api';
import { MoneyText } from './money-text';

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
      {lines.map((line, index) => (
        <small key={`${request.id}-withdrawal-accounting-${index}`}>{line}</small>
      ))}
    </div>
  );
}

export function withdrawalAccountingPreviewLines(request: AdminProviderWalletWithdrawalRequest) {
  if (request.status === 'PAID') {
    return [
      previewLine('Dr Partner withdrawal payable ', request.amount, request.currency),
      previewLine('Cr Bank ', request.amount, request.currency),
    ];
  }
  if (
    request.status === 'REJECTED' ||
    request.status === 'CANCELLED' ||
    request.status === 'FAILED' ||
    request.status === 'REVERSED'
  ) {
    return [
      previewLine('Dr Partner withdrawal payable ', request.amount, request.currency),
      previewLine('Cr Partner wallet liability ', request.amount, request.currency),
    ];
  }
  if (
    request.status === 'REQUESTED' ||
    request.status === 'APPROVED' ||
    request.status === 'BANK_TRANSFER_PENDING' ||
    request.status === 'REVIEW_REQUIRED' ||
    request.status === 'HOLD' ||
    request.status === 'NEEDS_BANK_CORRECTION'
  ) {
    return [
      previewLine('Dr Partner wallet liability ', request.amount, request.currency),
      previewLine('Cr Partner withdrawal payable ', request.amount, request.currency),
    ];
  }
  return [];
}

function previewLine(label: string, amount: number, currency: string): ReactNode {
  return createElement(Fragment, null, label, createElement(MoneyText, { amount, currency }));
}
