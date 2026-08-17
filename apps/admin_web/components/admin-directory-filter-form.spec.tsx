import { canonicalGetFormHref } from './admin-directory-filter-form';
import { readFileSync } from 'node:fs';

describe('canonicalGetFormHref', () => {
  it('omits empty values and default newest sort while preserving active review filters', () => {
    expect(
      canonicalGetFormHref(
        '/partners',
        [
          ['review', 'unapproved'],
          ['sort', 'newest'],
          ['q', 'linh'],
          ['activity', ''],
        ],
        { sort: 'newest' },
      ),
    ).toBe('/partners?review=unapproved&q=linh');
  });

  it('keeps non-default booking flow and approval queue ordering', () => {
    expect(
      canonicalGetFormHref(
        '/partners',
        [
          ['sort', 'newest'],
          ['bookingFlow', 'completed-work'],
        ],
        { sort: 'newest' },
      ),
    ).toBe('/partners?bookingFlow=completed-work');
    expect(
      canonicalGetFormHref(
        '/partners',
        [
          ['review', 'approval-pending'],
          ['sort', 'oldest'],
        ],
        {},
      ),
    ).toBe('/partners?review=approval-pending&sort=oldest');
  });
});

it('uses App Router navigation instead of reloading the document', () => {
  const source = readFileSync('components/admin-directory-filter-form.tsx', 'utf8');

  expect(source).toContain("window.history.pushState(null, '', href)");
  expect(source).not.toContain('window.location.assign');
});
