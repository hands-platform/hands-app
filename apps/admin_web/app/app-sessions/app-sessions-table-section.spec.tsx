import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { AppSessionsTableSection, type AppSessionTableRow } from './app-sessions-table-section';

describe('AppSessionsTableSection', () => {
  it('reuses the shared Admin table pagination footer atom', () => {
    const source = readFileSync(join(process.cwd(), 'app/app-sessions/app-sessions-table-section.tsx'), 'utf8');

    expect(source).toContain('AdminTablePaginationFooter');
    expect(source).not.toContain('AdminRoundedPagination');
    expect(source).not.toContain('Showing {pagination.from} to {pagination.to} of {pagination.totalRows} entries');
  });

  it('renders session rows with device and Partner links', () => {
    const section = AppSessionsTableSection({
      emptyMessage: 'No app sessions loaded.',
      pagination: pagination([buildRow()], { totalRows: 12 }),
    });

    const rendered = normalizeText(textContent(section));

    expect(rendered).toContain('Massage Partner');
    expect(rendered).toContain('Showing 1 to 1 of 12 entries');
    expect(rendered).toContain('+84900000000');
    expect(rendered).toContain('Partner');
    expect(rendered).toContain('live');
    expect(rendered).toContain('ios');
    expect(rendered).toContain('1.0.2');
    expect(rendered).toContain('Updated just now');
    expect(rendered).toContain('9 Jun 2026, 10:00');
    expect(rendered).toContain('device-123');
    expect(rendered).toContain('127.0.0.1');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['/partners/partner-1']));
    expect(classNamesIn(section)).toEqual(expect.arrayContaining(['admin-avatar-status-dot is-online']));
  });

  it('renders the empty state when there are no session rows', () => {
    const section = AppSessionsTableSection({
      emptyMessage: 'No app sessions loaded.',
      pagination: pagination([]),
    });

    expect(textContent(section)).toContain('No app sessions loaded.');
  });

  it('uses the shared StatusBadge atom for session state chips', () => {
    const source = readFileSync(join(process.cwd(), 'app/app-sessions/app-sessions-table-section.tsx'), 'utf8');

    expect(source).toContain('StatusBadge');
    expect(source).toContain('statusBadgeToneFromPillClass');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('<span className={`pill ${row.statePillClassName}`}>{row.stateLabel}</span>');
  });

  it('uses the shared DateTimeText atom for last-seen timestamps', () => {
    const source = readFileSync(join(process.cwd(), 'app/app-sessions/app-sessions-table-section.tsx'), 'utf8');

    expect(source).toContain('DateTimeText');
    expect(source).not.toContain('readonly lastSeenAtLabel: string;');
    expect(source).not.toContain('<div className="muted">{row.lastSeenAtLabel}</div>');
  });
});

function pagination(
  rows: readonly AppSessionTableRow[],
  input: { page?: number; pageSize?: number; totalRows?: number } = {},
) {
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 10;
  const totalRows = input.totalRows ?? rows.length;

  return {
    from: rows.length === 0 ? 0 : (page - 1) * pageSize + 1,
    hrefForPage: (nextPage: number) => `/app-sessions?page=${nextPage}`,
    page,
    rows,
    to: rows.length === 0 ? 0 : (page - 1) * pageSize + rows.length,
    totalPages: Math.max(1, Math.ceil(totalRows / pageSize)),
    totalRows,
  };
}

function buildRow(): AppSessionTableRow {
  return {
    appVersionLabel: '1.0.2',
    avatarStatus: 'online',
    deviceIdLabel: 'device-123',
    id: 'session-1',
    ipAddressLabel: '127.0.0.1',
    lastSeenAt: '2026-06-09T03:00:00.000Z',
    partnerHref: '/partners/partner-1',
    platformLabel: 'ios',
    relativeLastSeenLabel: 'Updated just now',
    roleLabel: 'PARTNER',
    stateLabel: 'live',
    statePillClassName: 'pill-success',
    userHref: '/partners/partner-1',
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

function normalizeText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
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
