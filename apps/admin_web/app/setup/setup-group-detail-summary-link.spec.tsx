import { classNamesIn, hrefsIn, textContent } from './setup-section-test-utils';
import { SetupGroupDetailSummaryLink } from './page';

describe('SetupGroupDetailSummaryLink', () => {
  it('renders the collapsed setup group details link as a shared section surface', () => {
    const section = SetupGroupDetailSummaryLink({ groupCount: 4 });
    const rendered = textContent(section).replace(/\s+/g, ' ');

    expect(rendered).toContain('Setup group details');
    expect(rendered).toContain('Show 4 setup group(s)');
    expect(hrefsIn(section)).toContain('/setup?details=all');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-section admin-mt-16',
        'ops-section-header admin-section-header',
      ]),
    );
  });
});
