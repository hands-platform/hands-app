import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { adminGetResult } from '../../lib/admin-api';
import { getCurrentAdminOperatorAccess } from '../../lib/admin-operator-access';
import ReferralCashoutsPage from './cashouts/page';
import PartnerReferralsPage from './partners/page';

vi.mock('../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/admin-api')>('../../lib/admin-api');
  return { ...actual, adminGetResult: vi.fn() };
});

vi.mock('../../lib/admin-operator-access', () => ({ getCurrentAdminOperatorAccess: vi.fn() }));

const mockedAdminGetResult = vi.mocked(adminGetResult);
const mockedOperatorAccess = vi.mocked(getCurrentAdminOperatorAccess);

describe('Referral route read failures', () => {
  beforeEach(() => {
    mockedAdminGetResult.mockReset();
    mockedAdminGetResult.mockImplementation(async (_href, fallback) => ({
      data: fallback,
      ok: true,
      status: 200,
    }));
    mockedOperatorAccess.mockResolvedValue({
      categories: ['FINANCE_SETTLEMENTS', 'SYSTEM_POLICY'],
      id: 'admin-finance-reader',
      roles: ['ADMIN'],
    });
  });

  it('does not convert a Partner rows 403 into a valid empty directory', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) => ({
      data: fallback,
      ok: String(href).includes('/summary'),
      status: String(href).includes('/summary') ? 200 : 403,
    }));

    const markup = renderToStaticMarkup(await PartnerReferralsPage({ searchParams: Promise.resolve({}) }));

    expect(markup).toContain('role="alert"');
    expect(markup).toContain('Partner referral records could not be loaded');
    expect(markup).not.toContain('No Partner referral parents yet');
    expect(markup).not.toContain('Partner referral operations</h2>');
  });

  it('labels a Partner summary 500 as partial data instead of authoritative zero totals', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) => ({
      data: fallback,
      ok: !String(href).includes('/summary'),
      status: String(href).includes('/summary') ? 500 : 200,
    }));

    const markup = renderToStaticMarkup(await PartnerReferralsPage({ searchParams: Promise.resolve({}) }));

    expect(markup).toContain('role="alert"');
    expect(markup).toContain('Partner referral summary could not be loaded');
    expect(markup).toContain('Loaded parent rows remain read-only');
  });

  it('does not convert a cashout network failure into a valid empty queue', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) => ({
      data: fallback,
      ok: String(href).includes('/summary'),
      status: String(href).includes('/summary') ? 200 : null,
    }));

    const markup = renderToStaticMarkup(await ReferralCashoutsPage({ searchParams: Promise.resolve({}) }));

    expect(markup).toContain('role="alert"');
    expect(markup).toContain('Referral cashout rows could not be loaded');
    expect(markup).not.toContain('No referral cashouts match the current filters.');
  });

  it('labels a cashout summary 500 as partial and disables financial actions', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) => ({
      data: fallback,
      ok: !String(href).includes('/summary'),
      status: String(href).includes('/summary') ? 500 : 200,
    }));

    const markup = renderToStaticMarkup(await ReferralCashoutsPage({ searchParams: Promise.resolve({}) }));

    expect(markup).toContain('role="alert"');
    expect(markup).toContain('Cashout summary could not be loaded');
    expect(markup).toContain('0 cashout rows loaded · summary unavailable');
    expect(markup).not.toContain('aria-label="Referral cashout queue summary"');
  });
});
