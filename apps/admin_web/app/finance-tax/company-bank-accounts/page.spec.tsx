import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { adminGet } from '../../../lib/admin-api';
import CompanyBankAccountsPage from './page';

vi.mock('../../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/admin-api')>('../../../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
  };
});

const mockedAdminGet = vi.mocked(adminGet);

describe('CompanyBankAccountsPage', () => {
  beforeEach(() => {
    mockedAdminGet.mockResolvedValue([
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
    ]);
  });

  it('lists company bank accounts from the bounded admin API using the shared finance table shell', async () => {
    const page = await CompanyBankAccountsPage();
    const markup = renderToStaticMarkup(page);

    expect(mockedAdminGet).toHaveBeenCalledWith('/admin/company-bank-accounts?status=ALL', []);
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
    expect(markup).not.toContain('class="form-input"');
  });
});
