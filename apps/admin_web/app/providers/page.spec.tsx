import { redirect } from 'next/navigation';
import { vi } from 'vitest';

import LegacyProviderDetailPage from './[id]/page';
import { buildLegacyPartnerQueryString } from './legacy-provider-redirect';
import LegacyProvidersPage from './page';

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

describe('legacy providers routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps the providers listing as a compatibility redirect to partners', async () => {
    await LegacyProvidersPage({
      searchParams: Promise.resolve({
        page: '2',
        review: 'unapproved',
      }),
    });

    expect(redirect).toHaveBeenCalledWith('/partners?page=2&review=unapproved');
  });

  it('keeps provider detail aliases pointed at the canonical partner detail route', async () => {
    await LegacyProviderDetailPage({
      params: Promise.resolve({ id: 'provider-1' }),
      searchParams: Promise.resolve({
        section: 'full',
      }),
    });

    expect(redirect).toHaveBeenCalledWith('/partners/provider-1?section=full');
  });

  it('preserves repeated query filters when redirecting legacy provider URLs', () => {
    expect(
      buildLegacyPartnerQueryString({
        review: 'unapproved',
        tag: ['kyc', 'wallet'],
      }),
    ).toBe('?review=unapproved&tag=kyc&tag=wallet');
  });
});
