import { PartnerDetailWalletWithdrawalRequestSection } from './partner-detail-wallet-withdrawal-request-section';
import type { AdminProviderWalletWithdrawalRequest } from '../../../lib/admin-api';
import { readFileSync } from 'node:fs';

const sectionSource = readFileSync(
  new URL('./partner-detail-wallet-withdrawal-request-section.tsx', import.meta.url),
  'utf8',
);

describe('PartnerDetailWalletWithdrawalRequestSection', () => {
  it('renders partner wallet withdrawal history and finance actions as a Vuexy table', () => {
    const section = PartnerDetailWalletWithdrawalRequestSection({
      requests: [
        {
          amount: 650000,
          bankAccount: {
            accountHolderName: 'Linh Nguyen',
            accountNumberMasked: '****7788',
            bankName: 'Techcombank',
            id: 'bank-1',
            isPrimary: true,
            status: 'APPROVED',
          },
          bankAccountId: 'bank-1',
          createdAt: '2026-06-27T09:00:00.000Z',
          currency: 'VND',
          id: 'withdrawal-request-1',
          providerProfileId: 'provider-1',
          requestNote: 'Please transfer this week.',
          status: 'REQUESTED',
        },
        {
          amount: 300000,
          bankAccount: {
            accountHolderName: 'Linh Nguyen',
            accountNumberLast4: '9900',
            bankName: 'VCB',
            id: 'bank-2',
            isPrimary: false,
            status: 'APPROVED',
          },
          bankAccountId: 'bank-2',
          createdAt: '2026-06-25T09:00:00.000Z',
          currency: 'VND',
          id: 'withdrawal-request-2',
          paidAt: '2026-06-26T09:00:00.000Z',
          reviewedByAdminId: 'finance-maker-1',
          paidBy: { id: 'finance-maker-1', fullName: 'Finance Maker' },
          approvalAdminId: 'finance-approver-2',
          approvalAdmin: { id: 'finance-approver-2', fullName: 'Finance Approver' },
          providerProfileId: 'provider-1',
          status: 'PAID',
          transferRef: 'VCB-PAID-1',
        },
      ] satisfies AdminProviderWalletWithdrawalRequest[],
      updateWithdrawalRequestAction: async () => undefined,
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Wallet withdrawal requests');
    expect(rendered).toContain('1 needs action');
    expect(rendered).toContain('650.000 VND');
    expect(rendered).toContain('Please transfer this week.');
    expect(rendered).toContain('Techcombank');
    expect(rendered).toContain('Requested');
    expect(rendered).toContain('Approve');
    expect(rendered).toContain('Request correction');
    expect(rendered).toContain('Reject');
    expect(rendered).toContain('300.000 VND');
    expect(rendered).toContain('Ref VCB-PAID-1');
    expect(rendered).toContain('Paid by Finance Maker');
    expect(rendered).toContain('Approved by Finance Approver');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-partner-detail-review-card admin-mb-16 admin-section',
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table admin-data-table vuexy-partner-detail-review-table',
        'vuexy-booking-table-footer vuexy-partner-detail-review-footer',
        'admin-form-input',
        'admin-form-control-button button button-sm button-primary',
        'admin-form-control-button button button-sm button-outline',
        'admin-form-control-button button button-sm button-danger',
      ]),
    );
  });

  it('requires a separate Finance approver before paid closeout from partner detail', () => {
    const request = {
      amount: 650000,
      bankAccount: null,
      bankAccountId: null,
      createdAt: '2026-07-15T09:00:00.000Z',
      currency: 'VND',
      id: 'withdrawal-approved',
      providerProfileId: 'provider-1',
      status: 'APPROVED',
    } satisfies AdminProviderWalletWithdrawalRequest;
    const section = PartnerDetailWalletWithdrawalRequestSection({
      financeApproverOptions: [{ label: 'Finance Approver', value: 'finance-approver-2' }],
      requests: [request],
      updateWithdrawalRequestAction: async () => undefined,
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Separate Finance approver for withdrawal withdrawal-approved');
    expect(rendered).toContain('Finance Approver');
    expect(sectionSource).toContain('name="approvalAdminId"');
    expect(sectionSource).toContain('disabled={financeApproverOptions.length === 0}');
  });

  it('shows bank correction requests as partner-pending instead of finance-approvable', () => {
    const section = PartnerDetailWalletWithdrawalRequestSection({
      requests: [
        {
          amount: 420000,
          bankAccount: {
            accountHolderName: 'Linh Nguyen',
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

  it('renders accounting preview labels for locked, paid, and returned withdrawal requests', () => {
    const section = PartnerDetailWalletWithdrawalRequestSection({
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

  it('renders withdrawal status-change audit evidence for retained locked amounts', () => {
    const request = {
      amount: 650000,
      bankAccount: {
        accountHolderName: 'Linh Nguyen',
        accountNumberMasked: '****7788',
        bankName: 'Techcombank',
        id: 'bank-1',
        isPrimary: true,
        status: 'APPROVED',
      },
      bankAccountId: 'bank-1',
      createdAt: '2026-06-27T09:00:00.000Z',
      currency: 'VND',
      id: 'withdrawal-request-bank-pending',
      metadata: {
        lastStatusChange: {
          previousStatus: 'APPROVED',
          nextStatus: 'BANK_TRANSFER_PENDING',
          lockedAmountRetained: true,
          amount: 650000,
        },
      },
      providerProfileId: 'provider-1',
      status: 'BANK_TRANSFER_PENDING',
    } as unknown as AdminProviderWalletWithdrawalRequest;
    const section = PartnerDetailWalletWithdrawalRequestSection({
      requests: [request],
      updateWithdrawalRequestAction: async () => undefined,
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Approved -> Bank transfer pending');
    expect(rendered).toContain('Lock retained 650.000 VND');
  });

  it('uses the shared empty-state atom for no-row messaging', () => {
    expect(sectionSource).toContain('AdminEmptyState');
    expect(sectionSource).not.toContain('<div className="empty-state">');
  });

  it('uses shared Vuexy badges for withdrawal status and finance action chips', () => {
    expect(sectionSource).toContain('StatusBadgeFromPillClass');
    expect(sectionSource).toContain('StatusBadge');
    expect(sectionSource).not.toContain('statusBadgeToneFromPillClass');
    expect(sectionSource).not.toContain('PillClassBadge');
    expect(sectionSource).not.toContain('<span className={`pill ${statusPillClass(request.status)}`}>');
    expect(sectionSource).not.toContain('<span className="pill pill-warn">Waiting for partner bank correction</span>');
    expect(sectionSource).not.toContain('<span className="pill pill-warn">Finance review required before payout</span>');
    expect(sectionSource).not.toContain('<span className="pill pill-info">Manual bank transfer pending</span>');
  });

  it('uses the partner detail Vuexy table panel atom for the withdrawal ledger surface', () => {
    expect(sectionSource).toContain('PartnerDetailVuexyTablePanel');
    expect(sectionSource).not.toContain('AdminFilterPanel');
    expect(sectionSource).not.toContain('partnerDetailReviewCardClassName');
  });

  it('uses the shared date time atom for visible withdrawal timestamps', () => {
    expect(sectionSource).toContain('DateTimeText');
    expect(sectionSource).not.toContain('formatDate,');
    expect(sectionSource).not.toContain('{formatDate(request.createdAt)}');
    expect(sectionSource).not.toContain('Paid {formatDate(request.paidAt)}');
  });

  it('uses the shared money atom for visible withdrawal request amounts', () => {
    expect(sectionSource).toContain('MoneyText');
    expect(sectionSource).toContain('<MoneyText amount={request.amount} currency={request.currency} />');
    expect(sectionSource).toContain('<MoneyText amount={statusChange.evidenceAmount} currency={request.currency} />');
    expect(sectionSource).not.toContain('<strong>{formatCurrency(request.amount, request.currency)}</strong>');
    expect(sectionSource).not.toContain('formatCurrency(statusChange.evidenceAmount, request.currency)');
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
