import { AdminOperatorPermissionCategory } from '@prisma/client';

import manifest from './admin-operator-permission-manifest.json';

const legacyOnlyCategories = new Set([
  'BOOKINGS',
  'CUSTOMERS',
  'GROWTH',
  'PARTNERS',
  'FINANCE',
  'NOTIFICATIONS',
  'SYSTEM',
  'SYSTEM_SETUP',
  'DEVELOPER_SYSTEM',
]);

describe('admin operator permission manifest', () => {
  it('covers every persisted leaf category exactly once, including website content', () => {
    const expected = Object.values(AdminOperatorPermissionCategory)
      .filter((category) => !legacyOnlyCategories.has(category))
      .sort();
    const actual = manifest.categories.map(({ key }) => key).sort();

    expect(actual).toEqual(expected);
    expect(new Set(actual).size).toBe(actual.length);
    expect(actual).toEqual(expect.arrayContaining([
      'CONTENT_VIEW',
      'CONTENT_EDIT',
      'CONTENT_PUBLISH',
      'CONTENT_DELETE',
    ]));
  });

  it('expands every legacy group only to manifest-backed leaf categories', () => {
    const leaves = new Set(manifest.categories.map(({ key }) => key));
    for (const categories of Object.values(manifest.legacyGroups)) {
      expect(categories.every((category) => leaves.has(category))).toBe(true);
    }
  });
});
