import { PayoutWalletWithdrawalRequestSection } from './payout-wallet-withdrawal-request-section';
import type { AdminProviderWalletWithdrawalRequest } from '../../lib/admin-api';
import { readFileSync } from 'node:fs';

const sectionSource = readFileSync(new URL('./payout-wallet-withdrawal-request-section.tsx', import.meta.url), 'utf8');

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
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group payout-wallet-withdrawal-request-section admin-mb-16 admin-section',
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table',
        'admin-form-input',
        'admin-form-control-button button button-sm button-primary',
        'admin-form-control-button button button-sm button-outline',
        'admin-form-control-button button button-sm button-danger',
      ]),
    );
  });

  it('shows bank correction rows as partner-pending instead of finance-approvable', () => {
    const section = PayoutWalletWithdrawalRequestSection({
      requests: [
        {
          amount: 420000,
          bankAccount: {
            accountHolderName: 'Smoke Partner',
            accountNumberLast4: '7788',
            bankName: 'Techcombank',
            id: 'bank-1',
            isPrimary: true,
            status: 'REJECTED',
          },
          bankAccountId: 'bank-1',
          correctionReason: 'Bank account name does not match KYC name.',
          createdAt: '2026-06-27T09:00:00.000Z',
          currency: 'VND',
          id: 'withdrawal-request-needs-bank-correction',
          providerProfile: {
            displayName: 'Smoke Partner',
            user: { phone: '+84900001111' },
          },
          providerProfileId: 'provider-1',
          status: 'NEEDS_BANK_CORRECTION',
        },
      ] satisfies AdminProviderWalletWithdrawalRequest[],
      updateWithdrawalRequestAction: async () => undefined,
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Waiting for partner bank correction');
    expect(rendered).toContain(
      'Partner must update bank details in the Partner app before finance can approve this withdrawal.',
    );
    expect(rendered).toContain('Bank account name does not match KYC name.');
    expect(rendered).not.toContain('Approve');
    expect(rendered).not.toContain('Request correction');
    expect(rendered).not.toContain('Reject');
  });

  it('renders withdrawal status-change audit evidence for released locked amounts', () => {
    const request = {
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
      id: 'withdrawal-request-rejected',
      metadata: {
        lastStatusChange: {
          previousStatus: 'APPROVED',
          nextStatus: 'REJECTED',
          lockedAmountReleased: true,
          releasedAmount: 500000,
        },
      },
      providerProfile: {
        displayName: 'Smoke Partner',
        user: { phone: '+84900001111' },
      },
      providerProfileId: 'provider-1',
      status: 'REJECTED',
    } as unknown as AdminProviderWalletWithdrawalRequest;
    const section = PayoutWalletWithdrawalRequestSection({
      requests: [request],
      updateWithdrawalRequestAction: async () => undefined,
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Approved -> Rejected');
    expect(rendered).toContain('Lock released 500.000 VND');
  });

  it('renders accounting preview labels for locked, paid, and returned withdrawal requests', () => {
    const section = PayoutWalletWithdrawalRequestSection({
      requests: [
        {
          amount: 800000,
          bankAccount: null,
          bankAccountId: null,
          createdAt: '2026-06-27T09:00:00.000Z',
          currency: 'VND',
          id: 'withdrawal-locked',
          providerProfileId: 'provider-locked',
          status: 'APPROVED',
        },
        {
          amount: 500000,
          bankAccount: null,
          bankAccountId: null,
          createdAt: '2026-06-27T10:00:00.000Z',
          currency: 'VND',
          id: 'withdrawal-paid',
          paidAt: '2026-06-28T10:00:00.000Z',
          providerProfileId: 'provider-paid',
          status: 'PAID',
        },
        {
          amount: 300000,
          bankAccount: null,
          bankAccountId: null,
          createdAt: '2026-06-27T11:00:00.000Z',
          currency: 'VND',
          id: 'withdrawal-returned',
          providerProfileId: 'provider-returned',
          status: 'REJECTED',
        },
      ] as unknown as AdminProviderWalletWithdrawalRequest[],
      updateWithdrawalRequestAction: async () => undefined,
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Accounting preview');
    expect(rendered).toContain('Dr Partner wallet liability 800.000 VND');
    expect(rendered).toContain('Cr Partner withdrawal payable 800.000 VND');
    expect(rendered).toContain('Dr Partner withdrawal payable 500.000 VND');
    expect(rendered).toContain('Cr Bank 500.000 VND');
    expect(rendered).toContain('Cr Partner wallet liability 300.000 VND');
  });

  it('summarizes finance queue status filters before the withdrawal table', () => {
    const section = PayoutWalletWithdrawalRequestSection({
      activeStatus: 'BANK_TRANSFER_PENDING',
      range: '7d',
      requests: [
        {
          amount: 500000,
          bankAccount: null,
          bankAccountId: null,
          createdAt: '2026-06-27T09:00:00.000Z',
          currency: 'VND',
          id: 'withdrawal-review-required',
          providerProfileId: 'provider-review',
          status: 'REVIEW_REQUIRED',
        },
        {
          amount: 650000,
          bankAccount: null,
          bankAccountId: null,
          createdAt: '2026-06-27T09:30:00.000Z',
          currency: 'VND',
          id: 'withdrawal-bank-pending',
          providerProfileId: 'provider-bank',
          status: 'BANK_TRANSFER_PENDING',
        },
        {
          amount: 500000,
          bankAccount: null,
          bankAccountId: null,
          createdAt: '2026-06-27T10:00:00.000Z',
          currency: 'VND',
          id: 'withdrawal-rejected',
          metadata: {
            lastStatusChange: {
              previousStatus: 'APPROVED',
              nextStatus: 'REJECTED',
              lockedAmountReleased: true,
              releasedAmount: 500000,
            },
          },
          providerProfileId: 'provider-rejected',
          status: 'REJECTED',
        },
      ] as unknown as AdminProviderWalletWithdrawalRequest[],
      updateWithdrawalRequestAction: async () => undefined,
    });

    const rendered = normalizeSpaces(textContent(section));
    const hrefs = hrefsIn(section);

    expect(rendered).toContain('Withdrawal request status summary');
    expect(rendered).toContain('Review required 1');
    expect(rendered).toContain('Bank transfer pending 1');
    expect(rendered).toContain('Lock released 1');
    expect(rendered).toContain('Selected');
    expect(hrefs).toContain('/payouts?range=7d&withdrawalStatus=REVIEW_REQUIRED');
    expect(hrefs).toContain('/payouts?range=7d&withdrawalStatus=BANK_TRANSFER_PENDING');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'payout-wallet-withdrawal-summary-grid',
        'card admin-card payout-wallet-withdrawal-summary-card is-info is-active',
        'card admin-card payout-wallet-withdrawal-summary-card is-audit',
      ]),
    );
    expect(sectionSource).toContain('AdminCard');
    expect(sectionSource).toContain('AdminLinkCard');
    expect(sectionSource).not.toContain('<div className="card admin-card payout-wallet-withdrawal-summary-card is-audit">');
    expect(sectionSource).not.toContain('<AdminCard className="payout-wallet-withdrawal-summary-card is-audit">');
    expect(sectionSource).not.toContain("'card admin-card payout-wallet-withdrawal-summary-card'");
  });

  it('uses the shared empty-state atom for no-row messaging', () => {
    expect(sectionSource).toContain('AdminTablePanel');
    expect(sectionSource).toContain('AdminEmptyState');
    expect(sectionSource).not.toContain('className="payout-wallet-withdrawal-request-section admin-mb-16 vuexy-booking-table-card vuexy-booking-table-group"');
    expect(sectionSource).not.toContain('<div className="empty-state">');
  });

  it('uses the shared inline fallback atom for missing partner phone values', () => {
    expect(sectionSource).toContain('AdminInlineFallback');
    expect(sectionSource).not.toContain(
      '<p className="muted">{request.providerProfile?.user?.phone ?? \'No phone on file\'}</p>',
    );
  });

  it('uses shared badge atoms for withdrawal status and action warnings', () => {
    expect(sectionSource).toContain('StatusBadge');
    expect(sectionSource).toContain('statusBadgeTone');
    expect(sectionSource).not.toContain('<span className={`pill ${statusPillClass(request.status)}`}>');
    expect(sectionSource).not.toContain('<span className="pill pill-warn">Waiting for partner bank correction</span>');
    expect(sectionSource).not.toContain('<span className="pill pill-warn">Finance review required before payout</span>');
    expect(sectionSource).not.toContain('<span className="pill pill-info">Manual bank transfer pending</span>');
    expect(sectionSource).not.toContain('function statusPillClass');
  });

  it('uses the shared money atom for withdrawal request amounts', () => {
    expect(sectionSource).toContain('MoneyText');
    expect(sectionSource).not.toContain('<strong>{formatMoney(request.amount, request.currency)}</strong>');
    expect(sectionSource).not.toContain('formatMoney(statusChange.evidenceAmount');
  });

  it('uses the shared DateTimeText atom for visible withdrawal timestamps', () => {
    expect(sectionSource).toContain('DateTimeText');
    expect(sectionSource).not.toContain('formatDateTime,');
    expect(sectionSource).not.toContain('<span className="muted">{formatDateTime(request.createdAt)}</span>');
    expect(sectionSource).not.toContain('<p className="muted">Reviewed {formatDateTime(request.reviewedAt)}</p>');
    expect(sectionSource).not.toContain('<span className="muted">Paid {formatDateTime(request.paidAt)}</span>');
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
