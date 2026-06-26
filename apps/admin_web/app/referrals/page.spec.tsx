import { vi } from 'vitest';
import { redirect } from 'next/navigation';

import ReferralsPage from './page';

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

describe('ReferralsPage', () => {
  it('redirects the referrals landing page to customer referrals', () => {
    ReferralsPage();

    expect(redirect).toHaveBeenCalledWith('/referrals/customers');
  });
});
