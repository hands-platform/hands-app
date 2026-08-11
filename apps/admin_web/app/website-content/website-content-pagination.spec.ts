import { describe, expect, it } from 'vitest';

import {
  filterWebsiteContentRows,
  paginateWebsiteContentRows,
  websiteContentManageHref,
  websiteContentPageHref,
} from './website-content-pagination';

describe('website content pagination', () => {
  it('limits route rows and preserves active filters in page links', () => {
    const pagination = paginateWebsiteContentRows(Array.from({ length: 45 }, (_, index) => index), '2');

    expect(pagination).toMatchObject({
      page: 2,
      totalPages: 3,
      totalRows: 45,
      from: 21,
      to: 40,
    });
    expect(pagination.rows).toHaveLength(20);
    expect(websiteContentPageHref(2, 'MAIN', 'vi', 'privacy')).toBe(
      '/website-content?site=MAIN&locale=vi&q=privacy&routePage=2',
    );
    expect(websiteContentManageHref('page-1', 2, 'MAIN', 'vi', 'privacy')).toBe(
      '/website-content?site=MAIN&locale=vi&q=privacy&routePage=2&pageId=page-1',
    );
    expect(
      filterWebsiteContentRows(
        [
          { internalName: 'Privacy policy', path: '/legal/privacy' },
          { internalName: 'Contact', path: '/contact' },
        ],
        'PRIVACY',
      ),
    ).toHaveLength(1);
  });
});
