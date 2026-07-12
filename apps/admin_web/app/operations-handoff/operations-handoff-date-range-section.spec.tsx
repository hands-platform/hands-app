import { readFileSync } from 'node:fs';

import { OperationsHandoffDateRangeSection } from './operations-handoff-date-range-section';
import { classNamesIn, hrefsIn, textContent } from './operations-handoff-section-test-utils';

describe('OperationsHandoffDateRangeSection', () => {
  it('uses shared Vuexy badge atoms for the selected date range label', () => {
    const source = readFileSync('app/operations-handoff/operations-handoff-date-range-section.tsx', 'utf8');

    expect(source).toContain('StatusBadge');
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
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining([
        '/operations-handoff?range=all',
        '/operations-handoff?range=today',
        '/operations-handoff',
        '/operations-handoff?range=30d',
      ]),
    );
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-section admin-mt-16 admin-mb-16 operations-handoff-date-range-card',
        'actions',
      ]),
    );
  });
});
