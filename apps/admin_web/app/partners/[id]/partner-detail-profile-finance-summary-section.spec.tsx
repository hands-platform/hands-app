import {
  PartnerDetailBasicProfileCard,
  PartnerDetailLocationActivityCard,
} from './partner-detail-profile-finance-summary-section';

describe('partner detail profile and location sections', () => {
  it('renders the basic profile as a compact evidence table', () => {
    const section = PartnerDetailBasicProfileCard({
      note: 'Partner prefers evening bookings.',
      rows: [
        { label: 'Display name', value: 'Linh Wellness' },
        { label: 'Phone', value: '+84900000000' },
      ],
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Basic profile');
    expect(rendered).toContain('2 field(s)');
    expect(rendered).toContain('Display name');
    expect(rendered).toContain('Linh Wellness');
    expect(rendered).toContain('Operator note');
    expect(rendered).toContain('Partner prefers evening bookings.');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining(['admin-table-scroll', 'table vuexy-data-table', 'partner-detail-note admin-mt-12']),
    );
  });

  it('renders latest location evidence and snapshots in the same table pattern', () => {
    const section = PartnerDetailLocationActivityCard({
      coordinatesLabel: '21.02776, 105.83416',
      lastLocationLabel: '20 Jun 2026, 10:30',
      snapshots: [
        { id: 'loc-1', label: '20 Jun 2026, 10:30' },
        { id: 'loc-2', label: '20 Jun 2026, 09:15' },
      ],
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Location and activity');
    expect(rendered).toContain('2 snapshot(s)');
    expect(rendered).toContain('Last location');
    expect(rendered).toContain('Coordinates');
    expect(rendered).toContain('Recent snapshots');
    expect(rendered).toContain('21.02776, 105.83416');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining(['admin-table-scroll', 'table vuexy-data-table', 'pill pill-neutral']),
    );
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
