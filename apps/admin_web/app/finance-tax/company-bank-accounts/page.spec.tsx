import { readFileSync } from 'node:fs';

import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { adminGet } from '../../../lib/admin-api';
import { getCurrentAdminOperatorAccess } from '../../../lib/admin-operator-access';
import CompanyBankAccountsPage from './page';

vi.mock('../../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/admin-api')>('../../../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
  };
});

vi.mock('../../../lib/admin-operator-access', () => ({
  getCurrentAdminOperatorAccess: vi.fn(),
}));

const mockedAdminGet = vi.mocked(adminGet);
const mockedGetCurrentAdminOperatorAccess = vi.mocked(getCurrentAdminOperatorAccess);
const source = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

const accounts = [
  {
    accountNumberLast4: '0001',
    accountNumberMasked: '****0001',
    bankName: 'VCB',
    currency: 'VND',
    id: 'bank-account-1',
    name: 'Operations VND',
    status: 'ACTIVE',
  },
  {
    accountNumberLast4: '0002',
    accountNumberMasked: '****0002',
    bankName: 'ACB',
    currency: 'VND',
    id: 'bank-account-2',
    name: 'Dormant settlement account',
    status: 'INACTIVE',
  },
];

const approvers = [
  { email: 'current@example.com', fullName: 'Current Operator', id: 'operator-current', phone: '', roles: ['ADMIN', 'FINANCE_APPROVER'] },
  { email: 'approver@example.com', fullName: 'Finance Approver', id: 'approver-2', phone: '', roles: ['ADMIN', 'FINANCE_APPROVER'] },
];

const auditLogs = [
  {
    action: 'company_bank_account.update',
    actor: { fullName: 'Current Operator', id: 'operator-current' },
    createdAt: '2026-07-15T08:00:00.000Z',
    id: 'audit-bank-1',
    metadata: { operatorReason: 'Archive after treasury review' },
    target: 'company_bank_account:bank-account-1',
  },
];

describe('CompanyBankAccountsPage', () => {
  beforeEach(() => {
    mockedGetCurrentAdminOperatorAccess.mockResolvedValue({ id: 'operator-current', roles: ['ADMIN'] } as never);
    mockedAdminGet.mockImplementation(async (href) => {
      if (href === '/admin/company-bank-accounts?status=ALL') return accounts as never;
      if (href === '/admin/audit-logs?q=company_bank_account&take=20') return auditLogs as never;
      if (href === '/admin/users?take=50&role=ADMIN&view=finance-approver-directory') return approvers as never;
      return [] as never;
    });
  });

  it('lists company bank accounts from the bounded admin API using the shared finance table shell', async () => {
    const page = await CompanyBankAccountsPage();
    const markup = renderToStaticMarkup(page);

    expect(mockedAdminGet).toHaveBeenCalledWith('/admin/company-bank-accounts?status=ALL', []);
    expect(mockedAdminGet).toHaveBeenCalledWith('/admin/audit-logs?q=company_bank_account&take=20', []);
    expect(markup).toContain('Company Bank Accounts');
    expect(markup).toContain('Bank account management');
    expect(markup).toContain('Operations VND');
    expect(markup).toContain('Dormant settlement account');
    expect(markup).toContain('VCB');
    expect(markup).toContain('****0001');
    expect(markup).toContain('pill pill-success');
    expect(markup).toContain('pill pill-neutral');
    expect(markup).toContain('vuexy-booking-table-card');
    expect(markup).toContain('vuexy-booking-table');
    expect(markup).toContain('class="admin-form-control-link button button-outline"');
    expect(markup).not.toContain('<a class="button button-outline"');
    expect(markup).not.toContain('class="form-input"');
  });

  it('separates bank account KPI cards into records, live availability, and audit retention', async () => {
    const page = await CompanyBankAccountsPage();
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Bank records');
    expect(markup).toContain('Live');
    expect(markup).toContain('Audit records');
    expect(markup).toContain('Accounts retained for reconciliation and bank import evidence.');
    expect(markup).toContain('Accounts currently selectable for transaction import.');
    expect(markup).toContain('Inactive accounts retained only for historical matching.');
    expect(markup).not.toContain('Company bank accounts returned by the bounded admin API.');
  });

  it('uses a reviewed create flow that stores only masked account identity', async () => {
    const page = await CompanyBankAccountsPage({ searchParams: Promise.resolve({ dialog: 'new' }) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Add company bank account');
    expect(markup).toContain('Review bank account creation');
    expect(markup).toContain('Confirm approved account creation');
    expect(markup).toContain('Finance Approver · approver@example.com');
    expect(markup).not.toContain('Current Operator · current@example.com');
    expect(markup).toContain(`value="company-bank-account-create"`);
    expect(markup).toContain('name="accountNumberMasked"');
    expect(markup).toContain('name="accountNumberLast4"');
    expect(markup).not.toContain('name="accountNumber"');
  });

  it('limits edits to the display name and requires account-bound confirmation', async () => {
    const page = await CompanyBankAccountsPage({
      searchParams: Promise.resolve({ accountId: 'bank-account-1', dialog: 'edit' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Review account name change');
    expect(markup).toContain('Confirm approved name change');
    expect(markup).toContain('name="confirmationAccountId" value="bank-account-1"');
    expect(markup).toContain('name="name"');
    expect(markup).not.toContain('name="bankName"');
  });

  it('reviews archive and activation as status changes without exposing delete', async () => {
    const page = await CompanyBankAccountsPage({
      searchParams: Promise.resolve({
        accountId: 'bank-account-1',
        confirm: 'status',
        nextStatus: 'INACTIVE',
      }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Archive Operations VND?');
    expect(markup).toContain('Archive account');
    expect(markup).toContain('Separate Finance approver');
    expect(markup).toContain('Status change evidence');
    expect(source).toContain("adminPatchOrThrow(`/admin/company-bank-accounts/${encodeURIComponent(accountId)}`");
    expect(source).not.toContain('adminDelete');
    expect(source).not.toContain("method: 'DELETE'");
  });

  it('shows only a bounded recent account audit trail with operator evidence', async () => {
    const page = await CompanyBankAccountsPage();
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Recent account changes');
    expect(markup).toContain('Latest 20 account create, rename, activation, and archive records.');
    expect(markup).toContain('Current Operator');
    expect(markup).toContain('Archive after treasury review');
    expect(markup).toContain('/audit-log?q=company_bank_account');
    expect(source).toContain("'/admin/audit-logs?q=company_bank_account&take=20'");
  });
});
