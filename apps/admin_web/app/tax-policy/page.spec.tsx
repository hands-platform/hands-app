import { vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { adminGet, type AdminTaxPolicyVersion } from '../../lib/admin-api';
import TaxPolicyPage from './page';

vi.mock('../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/admin-api')>('../../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
  };
});

const mockedAdminGet = vi.mocked(adminGet);

describe('TaxPolicyPage', () => {
  beforeEach(() => {
    mockedAdminGet.mockReset();
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);
  });

  it('keeps default tax policy history request bounded', async () => {
    await TaxPolicyPage({
      searchParams: Promise.resolve({}),
    });

    const hrefs = mockedAdminGet.mock.calls.map(([href]) => href);

    expect(hrefs).toContain('/admin/tax-policy-versions?take=20');
    expect(hrefs).toContain('/admin/audit-logs?q=tax_&take=8');
    expect(hrefs).toContain('/admin/earnings?range=30d&take=8');
  });

  it('uses shared admin form atoms for preview and create forms', async () => {
    const page = await TaxPolicyPage({
      searchParams: Promise.resolve({}),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('admin-form-input');
    expect(markup).toContain('admin-form-select');
    expect(markup).toContain('admin-form-control-button');
    expect(markup).not.toContain('class="form-grid"><label>');
  });

  it('uses shared admin form atoms for policy and rule edit forms', async () => {
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href.startsWith('/admin/tax-policy-versions')) {
        return [taxPolicyFixture()];
      }
      return fallback;
    });

    const page = await TaxPolicyPage({
      searchParams: Promise.resolve({}),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Update policy');
    expect(markup).toContain('Update rule');
    expect(markup).toContain('Add rule');
    expect(markup).not.toContain('<label>Status<select');
    expect(markup).not.toContain('<label>Scope<select');
    expect(markup).not.toContain('<label>Service type<input');
    expect(markup).not.toContain('<label>Rate bps<input');
  });
});

function taxPolicyFixture(): AdminTaxPolicyVersion {
  return {
    effectiveFrom: '2026-06-01T00:00:00.000Z',
    effectiveTo: null,
    id: 'tax-policy-1',
    name: 'Vietnam freelance withholding 2026',
    notes: 'Operator approved policy',
    rules: [
      {
        active: true,
        fixedAmount: 0,
        id: 'tax-rule-1',
        maxGrossAmount: null,
        minGrossAmount: null,
        policyVersionId: 'tax-policy-1',
        rateBps: 500,
        scope: 'DEFAULT',
        serviceType: null,
      },
    ],
    status: 'ACTIVE',
  };
}
