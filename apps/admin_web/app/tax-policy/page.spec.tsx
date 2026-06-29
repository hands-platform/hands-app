import { vi } from 'vitest';

import { adminGet } from '../../lib/admin-api';
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
  });
});
