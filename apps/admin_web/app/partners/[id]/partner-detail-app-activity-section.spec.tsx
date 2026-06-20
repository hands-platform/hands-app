import { PartnerDetailAppActivitySection } from './partner-detail-app-activity-section';

describe('PartnerDetailAppActivitySection', () => {
  it('renders recent app activity as a Vuexy table', () => {
    const section = PartnerDetailAppActivitySection({
      summary: [
        {
          helper: 'Latest app session.',
          label: 'Last login',
          value: '20 Jun 2026, 10:00',
        },
      ],
      rows: [
        {
          atLabel: '20 Jun 2026, 10:10',
          detail: 'Partner refreshed working location before receiving new requests.',
          key: 'location-1',
          title: 'Location updated',
          type: 'LOCATION',
        },
      ],
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Recent app and operations activity');
    expect(rendered).toContain('1 event(s)');
    expect(rendered).toContain('Last login');
    expect(rendered).toContain('20 Jun 2026, 10:00');
    expect(rendered).toContain('Type');
    expect(rendered).toContain('Activity');
    expect(rendered).toContain('Timeline');
    expect(rendered).toContain('LOCATION');
    expect(rendered).toContain('Location updated');
    expect(rendered).toContain('Partner refreshed working location before receiving new requests.');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining(['admin-table-scroll', 'table vuexy-data-table', 'pill pill-info']),
    );
  });

  it('renders the empty activity state inside the table', () => {
    const section = PartnerDetailAppActivitySection({
      summary: [],
      rows: [],
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('0 event(s)');
    expect(rendered).toContain('No activity matched this date filter');
    expect(rendered).toContain('Clear the date filter or choose a wider range');
    expect(classNamesIn(section)).toEqual(expect.arrayContaining(['admin-table-scroll', 'table vuexy-data-table']));
  });
});

function textContent(value: unknown): string {
  value = resolveElement(value);
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

function classNamesIn(value: unknown): string[] {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(classNamesIn);
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  const className = typeof props?.className === 'string' ? [props.className] : [];
  return [...className, ...classNamesIn(props?.children)];
}

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function resolveElement(value: unknown): unknown {
  const record = readRecord(value);
  const props = readRecord(record?.props);
  return typeof record?.type === 'function' ? resolveElement(record.type(props)) : value;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}
