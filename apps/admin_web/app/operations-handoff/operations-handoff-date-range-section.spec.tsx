import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';

import { OperationsHandoffDateRangeSection } from './operations-handoff-date-range-section';
import { classNamesIn, hrefsIn, textContent } from './operations-handoff-section-test-utils';

describe('OperationsHandoffDateRangeSection', () => {
  it('uses the shared filter panel result badge for the selected date range label', () => {
    const source = readFileSync('app/operations-handoff/operations-handoff-date-range-section.tsx', 'utf8');

    expect(source).toContain('AdminFilterPanel');
    expect(source).not.toContain('AdminFilterSummary');
    expect(source).toContain('resultLabel={dateRangeLabel(range)}');
    expect(source).not.toContain('AdminSection');
    expect(source).not.toContain('<span className="pill pill-info">{dateRangeLabel(range)}</span>');
  });

  it('uses the shared AdminFormControlLink atom for range actions', () => {
    const source = readFileSync('app/operations-handoff/operations-handoff-date-range-section.tsx', 'utf8');

    expect(source).toContain('AdminFormControlLink');
    expect(source).not.toContain('<Link className="button button-secondary"');
  });

  it('renders the selected range label and operations history range links', () => {
    const section = OperationsHandoffDateRangeSection({ range: '7d' });

    expect(textContent(section)).toContain('Operations history range');
    expect(textContent(section)).toContain('Last 7 days');
    expect(textContent(section)).not.toContain('Range: Last 7 days');
    expect(textContent(section)).not.toContain('Detail mode: Summary');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining([
        '/operations-handoff?range=all',
        '/operations-handoff?range=today',
        '/operations-handoff',
        '/operations-handoff?range=30d',
        '/operations-handoff?range=90d',
      ]),
    );
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel admin-mt-16 admin-mb-16 operations-handoff-date-range-card admin-section',
        'actions',
      ]),
    );
  });

  it('marks the selected range and preserves full-history mode while switching ranges', () => {
    const markup = renderToStaticMarkup(
      OperationsHandoffDateRangeSection({ detailsMode: 'all', range: '30d' }),
    );

    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain('href="/operations-handoff?details=all&amp;range=all"');
    expect(markup).toContain('href="/operations-handoff?details=all&amp;range=today"');
    expect(markup).toContain('href="/operations-handoff?details=all&amp;range=7d"');
    expect(markup).toContain('href="/operations-handoff?details=all&amp;range=30d"');
    expect(markup).toContain('href="/operations-handoff?details=all&amp;range=90d"');
    expect(markup).toContain('button-primary');
    expect(markup).not.toContain('Detail mode: All records');
  });
});
