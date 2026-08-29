import { readFileSync } from 'node:fs';

import {
  AppSessionsBreakdownSection,
  type AppSessionPlatformRow,
  type AppSessionRoleRow,
  type AppSessionVersionRow,
} from './app-sessions-breakdown-section';

describe('AppSessionsBreakdownSection', () => {
  it('uses the shared Vuexy detail grid atom', () => {
    const source = readFileSync('app/app-sessions/app-sessions-breakdown-section.tsx', 'utf8');

    expect(source).toContain('AdminDetailGrid');
    expect(source).not.toContain('<section className="detail-grid admin-mb-16"');
  });

  it('uses the shared Vuexy table section atom for breakdown tables', () => {
    const source = readFileSync('app/app-sessions/app-sessions-breakdown-section.tsx', 'utf8');

    expect(source).toContain('AdminTableSection');
    expect(source).not.toContain('AdminSection');
    expect(source).not.toContain('className="vuexy-booking-table-card vuexy-booking-table-group"');
  });

  it('renders role, platform, and app version breakdown rows', () => {
    const section = AppSessionsBreakdownSection({
      platformRows: buildPlatformRows(),
      roleRows: buildRoleRows(),
      versionRows: buildVersionRows(),
    });

    const rendered = textContent(section);

    expect(rendered).toContain('Role split');
    expect(rendered).toContain('PARTNER');
    expect(rendered).toContain('2 live / 5 total');
    expect(rendered).toContain('1 recent, 1 stale, 1 expired');
    expect(rendered).toContain('Platform and version');
    expect(rendered).toContain('ios');
    expect(rendered).toContain('4 session(s)');
    expect(rendered).toContain('Version 1.8.0');
    expect(rendered).toContain('2 live, 1 customer, 3 partner');
    expect(classNames(section)).toEqual(
      expect.arrayContaining([
        'card admin-section vuexy-booking-table-card vuexy-booking-table-group',
        'ops-section-header admin-section-header',
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table admin-data-table',
      ]),
    );
  });

  it('limits visible version rows to the first four versions', () => {
    const section = AppSessionsBreakdownSection({
      platformRows: [],
      roleRows: [],
      versionRows: [
        ...buildVersionRows(),
        { customer: 0, live: 0, partner: 1, total: 1, version: '1.7.9' },
        { customer: 1, live: 0, partner: 0, total: 1, version: '1.7.8' },
        { customer: 1, live: 0, partner: 0, total: 1, version: '1.7.7' },
      ],
    });

    const rendered = textContent(section);

    expect(rendered).toContain('Version 1.8.0');
    expect(rendered).toContain('Version 1.7.9');
    expect(rendered).not.toContain('Version 1.7.7');
  });

  it('labels breakdowns as current-page evidence for a partial dataset', () => {
    const rendered = textContent(AppSessionsBreakdownSection({
      platformRows: [],
      roleRows: [],
      scopeLabel: 'Current page',
      versionRows: [],
    }));

    expect(rendered).toContain('Current page role split');
    expect(rendered).toContain('Current page platform and version');
  });
});

function buildRoleRows(): AppSessionRoleRow[] {
  return [
    {
      expired: 1,
      live: 2,
      recent: 1,
      role: 'PARTNER',
      stale: 1,
      total: 5,
    },
  ];
}

function buildPlatformRows(): AppSessionPlatformRow[] {
  return [
    {
      live: 2,
      platform: 'ios',
      total: 4,
    },
  ];
}

function buildVersionRows(): AppSessionVersionRow[] {
  return [
    {
      customer: 1,
      live: 2,
      partner: 3,
      total: 4,
      version: '1.8.0',
    },
    {
      customer: 2,
      live: 1,
      partner: 0,
      total: 2,
      version: '1.8.1',
    },
  ];
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

function classNames(value: unknown): string[] {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(classNames);
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  const className = typeof props?.className === 'string' ? [props.className] : [];
  return [...className, ...classNames(props?.children)];
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
