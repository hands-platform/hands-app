import { OperationsHandoffDateRangeSection } from './operations-handoff-date-range-section';

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

function textContent(value: unknown): string {
  if (value === null || value === undefined || typeof value === 'boolean') {
    return '';
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(textContent).join(' ');
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  return textContent(props?.children);
}

function hrefsIn(value: unknown): string[] {
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(hrefsIn);
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  const href = typeof props?.href === 'string' ? [props.href] : [];
  return [...href, ...hrefsIn(props?.children)];
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}
