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
      loadedCount: 3,
      quickFilters: buildQuickFilters(),
      totalCount: 12,
    });

    const rendered = textContent(section);

    expect(section.type.name).toBe('AdminSection');
    expect(section.props).toMatchObject({
      bodyClassName: 'actions admin-mt-12 admin-justify-start',
      className: 'admin-mb-16',
      title: 'Session scope',
    });
    expect(rendered).toContain('Session scope');
    expect(rendered).toContain('Filtered to partner sessions, live heartbeat. Showing 3 of 12 heartbeat record(s).');
    expect(rendered).toContain('Clear filters');
    expect(rendered).toContain('Live partners');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['/app-sessions', '/app-sessions?role=PROVIDER&state=live']));
    expect(classNamesIn(section)).toEqual(expect.arrayContaining(['pill pill-success', 'pill pill-info']));
  });

  it('uses the shared ActionMenu atom for quick filter pills', () => {
    const source = readFileSync(join(process.cwd(), 'app/app-sessions/app-sessions-scope-section.tsx'), 'utf8');

    expect(source).toContain('ActionMenu');
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
