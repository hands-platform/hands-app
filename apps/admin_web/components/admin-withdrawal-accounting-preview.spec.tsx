import { readFileSync } from 'node:fs';

import type { AdminProviderWalletWithdrawalRequest } from '../lib/admin-api';
import {
  AdminWithdrawalAccountingPreview,
  withdrawalAccountingPreviewLines,
} from './admin-withdrawal-accounting-preview';

describe('AdminWithdrawalAccountingPreview', () => {
  it('uses the shared Vuexy money atom for accounting preview amounts', () => {
    const source = readFileSync('components/admin-withdrawal-accounting-preview.tsx', 'utf8');
    const preview = AdminWithdrawalAccountingPreview({
      request: withdrawalRequest({ amount: 125_000, status: 'PAID' }),
    });

    expect(source).toContain('MoneyText');
    expect(source).not.toContain('formatMoney(');
    expect(textContent(preview).replace(/\s+/g, ' ').trim()).toContain(
      'Dr Partner withdrawal payable 125.000 VND',
    );
    expect(textContent(preview).replace(/\s+/g, ' ').trim()).toContain('Cr Bank 125.000 VND');
  });

  it('renders rejected withdrawals back to partner wallet liability', () => {
    expect(
      withdrawalAccountingPreviewLines(withdrawalRequest({ amount: 75_000, status: 'REJECTED' }))
        .map((line) => textContent(line).replace(/\s+/g, ' ').trim()),
    ).toEqual([
      'Dr Partner withdrawal payable 75.000 VND',
      'Cr Partner wallet liability 75.000 VND',
    ]);
  });

  it('scopes mini ledger typography to direct ledger rows', () => {
    const css = readFileSync('app/globals.css', 'utf8');

    expect(css).toContain('.admin-mini-ledger > span');
    expect(css).toContain('.admin-mini-ledger > small');
    expect(css).not.toContain('.admin-mini-ledger span {');
    expect(css).not.toContain('.admin-mini-ledger small {');
  });
});

function withdrawalRequest(
  input: Partial<AdminProviderWalletWithdrawalRequest> = {},
): AdminProviderWalletWithdrawalRequest {
  return {
    amount: 125_000,
    currency: 'VND',
    id: 'withdrawal-1',
    status: 'PAID',
    ...input,
  } as AdminProviderWalletWithdrawalRequest;
}

function textContent(value: unknown): string {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value === 'boolean') {
    return '';
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(textContent).join(' ');
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  return textContent(props?.children);
}

function resolveElement(value: unknown): unknown {
  const record = readRecord(value);
  const props = readRecord(record?.props);
  return typeof record?.type === 'function' ? resolveElement(record.type(props)) : value;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}
