import { OperationsHandoffDateRangeSection } from './operations-handoff-date-range-section';
import { hrefsIn, textContent } from './operations-handoff-section-test-utils';

describe('OperationsHandoffDateRangeSection', () => {
  it('renders the selected range label and handoff range links', () => {
    const section = OperationsHandoffDateRangeSection({ range: 'today' });

    expect(section.type).toBe('section');
    expect(textContent(section)).toContain('Today (Vietnam)');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining([
        '/operations-handoff',
        '/operations-handoff?range=today',
        '/operations-handoff?range=7d',
        '/operations-handoff?range=30d',
      ]),
    );
  });
});
