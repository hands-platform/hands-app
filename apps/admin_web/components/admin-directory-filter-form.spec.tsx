import { canonicalGetFormHref } from './admin-directory-filter-form';

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
