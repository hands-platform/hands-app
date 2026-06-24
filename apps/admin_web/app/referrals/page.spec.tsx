import { redirect } from 'next/navigation';

import ReferralsPage from './page';

jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}));

describe('ReferralsPage', () => {
  it('redirects the referrals landing page to customer referrals', () => {
    ReferralsPage();

    expect(redirect).toHaveBeenCalledWith('/referrals/customers');
  });
});
