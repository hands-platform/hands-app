import { AppSessionsTableSection, type AppSessionTableRow } from './app-sessions-table-section';

describe('AppSessionsTableSection', () => {
  it('renders session rows with device and Partner links', () => {
    const section = AppSessionsTableSection({
      emptyMessage: 'No app sessions loaded.',
      rows: [buildRow()],
    });

    const rendered = textContent(section);

    expect(rendered).toContain('Massage Partner');
    expect(rendered).toContain('+84900000000');
    expect(rendered).toContain('Partner');
    expect(rendered).toContain('live');
    expect(rendered).toContain('ios');
    expect(rendered).toContain('1.0.2');
    expect(rendered).toContain('Updated just now');
    expect(rendered).toContain('2026-06-09 10:00');
    expect(rendered).toContain('device-123');
    expect(rendered).toContain('127.0.0.1');
    expect(rendered).toContain('Open Partner');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['/partners/partner-1']));
  });

  it('renders the empty state when there are no session rows', () => {
    const section = AppSessionsTableSection({
      emptyMessage: 'No app sessions loaded.',
      rows: [],
    });

    expect(textContent(section)).toContain('No app sessions loaded.');
  });
});

function buildRow(): AppSessionTableRow {
  return {
    appVersionLabel: '1.0.2',
    deviceIdLabel: 'device-123',
    id: 'session-1',
    ipAddressLabel: '127.0.0.1',
    lastSeenAtLabel: '2026-06-09 10:00',
    partnerHref: '/partners/partner-1',
    platformLabel: 'ios',
    relativeLastSeenLabel: 'Updated just now',
    roleLabel: 'PARTNER',
    stateLabel: 'live',
    statePillClassName: 'pill-success',
    userLabel: 'Massage Partner',
    userPhoneLabel: '+84900000000',
  };
}

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

function hrefsIn(value: unknown): string[] {
  value = resolveElement(value);
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
