import { describe, expect, it } from 'vitest';

import {
  publicPartnerArea,
  publicPartnerDetailPath,
  safePublicMediaUrl,
} from './public-partners';

describe('public Partner directory helpers', () => {
  it('builds district-specific SEO paths without accepting unsafe media URLs', () => {
    expect(publicPartnerArea('ho-chi-minh', 'district-1').label).toBe('호찌민 1군');
    expect(
      publicPartnerDetailPath({
        id: 'partner-1',
        displayName: 'Linh',
        location: {
          citySlug: 'ho-chi-minh',
          cityLabel: 'Ho Chi Minh City',
          districtSlug: 'district-1',
          districtLabel: 'District 1',
        },
      }),
    ).toBe('/ko/partners/ho-chi-minh/district-1/linh--partner-1');
    expect(publicPartnerArea('ho-chi-minh', 'district-1', 'ja').label).toBe(
      'ホーチミン 1区',
    );
    expect(
      publicPartnerDetailPath(
        {
          id: 'partner-1',
          displayName: 'Linh',
          location: {
            citySlug: 'ho-chi-minh',
            cityLabel: 'Ho Chi Minh City',
            districtSlug: 'district-1',
          },
        },
        'zh',
      ),
    ).toBe('/zh/partners/ho-chi-minh/district-1/linh--partner-1');
    expect(safePublicMediaUrl('/cdn/public/profile.jpg')).toBe(
      'http://localhost:3000/cdn/public/profile.jpg',
    );
    expect(safePublicMediaUrl('javascript:alert(1)')).toBeNull();
  });
});
