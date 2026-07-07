import { readFileSync } from 'node:fs';

import { classNamesIn, hrefsIn, textContent } from './setup-section-test-utils';
import { SetupGroupDetailSummaryLink } from './setup-group-detail-summary-link';

describe('SetupGroupDetailSummaryLink', () => {
  it('uses a shared badge link atom instead of a raw pill anchor', () => {
    const pageSource = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
    const source = readFileSync(new URL('./setup-group-detail-summary-link.tsx', import.meta.url), 'utf8');

    expect(source).toContain('StatusBadgeLink');
    expect(source).not.toContain('<a className="pill pill-neutral" href="/setup?details=all">');
    expect(pageSource).not.toContain('export function SetupGroupDetailSummaryLink');
  });

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
