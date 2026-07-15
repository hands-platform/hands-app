import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  AppSessionsScopeSection,
  type AppSessionQuickFilter,
} from './app-sessions-scope-section';

describe('AppSessionsScopeSection', () => {
  it('renders active filter context and highlights the active quick filter', () => {
    const section = AppSessionsScopeSection({
      activeFilterHref: '/app-sessions?role=PROVIDER&state=live',
      activeFilterLabel: 'Filtered to partner sessions, live heartbeat',
      filters: {
        page: 1,
        pageSize: 10,
        platform: 'ios',
        q: '8490',
        role: 'PROVIDER',
        state: 'live',
      },
      loadedCount: 3,
      quickFilters: buildQuickFilters(),
      totalCount: 12,
    });

    const rendered = textContent(section);

    expect(section.type.name).toBe('AdminFilterPanel');
    expect(section.props).toMatchObject({
      className: 'admin-mb-16',
      title: 'App session filters',
    });
    expect(rendered).toContain('App session filters');
    expect(rendered).toContain('Filtered to partner sessions, live heartbeat. Showing 3 of 12 heartbeat record(s).');
    expect(rendered).toContain('Scope: Filtered to partner sessions, live heartbeat');
    expect(rendered).toContain('Role: Partner sessions');
    expect(rendered).toContain('State: Live heartbeat');
    expect(rendered).toContain('Platform: iOS');
    expect(rendered).toContain('Rows: 10');
    expect(rendered).toContain('Search: 8490');
    expect(rendered).toContain('Clear filters');
    expect(rendered).toContain('Quick filters');
    expect(rendered).toContain('Live partners');
    expect(rendered).toContain('Search user, phone, device, IP');
    expect(rendered).toContain('Partner sessions');
    expect(rendered).toContain('iOS');
    expect(rendered).toContain('Apply filters');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['/app-sessions', '/app-sessions?role=PROVIDER&state=live']));
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'booking-date-filter-buttons app-session-quick-filter-buttons',
        'booking-date-filter-button is-active',
      ]),
    );
  });

  it('uses the shared filter panel and form atoms for session diagnostics filters', () => {
    const source = readFileSync(join(process.cwd(), 'app/app-sessions/app-sessions-scope-section.tsx'), 'utf8');

    expect(source).toContain('AdminFilterPanel');
    expect(source).toContain('AdminFilterSummary');
    expect(source).toContain('AdminFormSearch');
    expect(source).toContain('AdminFormSelect');
    expect(source).toContain('AdminFormGrid');
    expect(source).toContain('AdminSegmentedControl');
    expect(source).not.toContain('ActionMenu');
    expect(source).not.toContain('AdminSection');
    expect(source).not.toContain('className={`pill ${item.href === activeFilterHref ?');
  });

  it('uses the shared AdminFormControlLink atom for the clear filter action', () => {
    const source = readFileSync(join(process.cwd(), 'app/app-sessions/app-sessions-scope-section.tsx'), 'utf8');

    expect(source).toContain('AdminFormControlLink');
    expect(source).not.toContain('<Link className="button button-secondary"');
  });
});

function buildQuickFilters(): AppSessionQuickFilter[] {
  return [
    {
      href: '/app-sessions',
      label: 'All sessions',
    },
    {
      href: '/app-sessions?role=PROVIDER&state=live',
      label: 'Live partners',
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
