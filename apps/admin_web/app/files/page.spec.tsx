import { redirect } from 'next/navigation';
import { vi } from 'vitest';

import { buildPartnerFileReviewRedirect } from './files-page-model';
import LegacyFilesPage from './page';

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

describe('legacy files route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes the retired file queue to the oldest Partner approval record', async () => {
    await LegacyFilesPage({});

    expect(redirect).toHaveBeenCalledWith('/partners?review=approval-pending&sort=oldest');
  });

  it('preserves a Partner search when an old file queue link is opened', () => {
    expect(buildPartnerFileReviewRedirect({ q: 'Nguyen Van A' })).toBe(
      '/partners?review=approval-pending&sort=oldest&q=Nguyen+Van+A',
    );
  });

  it('opens the owning Partner detail when a legacy confirmation link contains providerId', () => {
    expect(buildPartnerFileReviewRedirect({ providerId: 'partner/1' })).toBe(
      '/partners/partner%2F1#partner-profile-kyc',
    );
  });

  it('keeps incomplete uploads in the broader unapproved Partner queue', () => {
    expect(buildPartnerFileReviewRedirect({ review: 'upload-incomplete' })).toBe(
      '/partners?review=unapproved&sort=oldest',
    );
  });
});
