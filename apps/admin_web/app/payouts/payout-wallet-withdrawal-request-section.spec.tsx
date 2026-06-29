import { PayoutWalletWithdrawalRequestSection } from './payout-wallet-withdrawal-request-section';
import type { AdminProviderWalletWithdrawalRequest } from '../../lib/admin-api';

describe('PayoutWalletWithdrawalRequestSection', () => {
  it('renders withdrawal requests with partner, bank, status, and finance actions', () => {
    const section = PayoutWalletWithdrawalRequestSection({
      requests: [
        {
          amount: 500000,
          bankAccount: {
            accountHolderName: 'Smoke Partner',
            accountNumberMasked: '****1234',
            bankName: 'VCB',
            id: 'bank-1',
            isPrimary: true,
            status: 'APPROVED',
          },
          bankAccountId: 'bank-1',
          createdAt: '2026-06-27T09:00:00.000Z',
          currency: 'VND',
          id: 'withdrawal-request-1',
          providerProfile: {
            displayName: 'Smoke Partner',
            user: { phone: '+84900001111' },
          },
          providerProfileId: 'provider-1',
          status: 'REQUESTED',
        },
      ] satisfies AdminProviderWalletWithdrawalRequest[],
      updateWithdrawalRequestAction: async () => undefined,
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Partner wallet withdrawal requests');
    expect(rendered).toContain('1 needs action');
    expect(rendered).toContain('Smoke Partner');
    expect(rendered).toContain('500.000 VND');
    expect(rendered).toContain('VCB');
    expect(rendered).toContain('Requested');
    expect(rendered).toContain('Approve');
    expect(rendered).toContain('Request correction');
    expect(rendered).toContain('Reject');
    expect(hrefsIn(section)).toContain('/partners/provider-1?section=full#finance');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel payout-wallet-withdrawal-request-section admin-mb-16',
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table',
      ]),
    );
  });
});

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

function hrefsIn(value: unknown): string[] {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(hrefsIn);
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  const href = typeof props?.href === 'string' ? [props.href] : [];
  return [...href, ...hrefsIn(props?.children)];
}

function classNamesIn(value: unknown): string[] {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(classNamesIn);
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  const className = typeof props?.className === 'string' ? [props.className] : [];
  return [...className, ...classNamesIn(props?.children)];
}

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
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
