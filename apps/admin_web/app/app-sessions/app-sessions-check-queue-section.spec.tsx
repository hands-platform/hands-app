import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  AppSessionsCheckQueueSection,
  type SessionCheckQueueItem,
} from './app-sessions-check-queue-section';

describe('AppSessionsCheckQueueSection', () => {
  it('renders review count and session check cards', () => {
    const section = AppSessionsCheckQueueSection({
      items: buildItems(),
    });

    const rendered = textContent(section);

    expect(section.type.name).toBe('AdminSection');
    expect(section.props).toMatchObject({
      className: 'admin-mb-16',
      title: 'Session check queue',
    });
    expect(rendered).toContain('Session check queue');
    expect(rendered).toContain('Check old app versions, stale sessions');
    expect(rendered).toContain('2 review');
    expect(rendered).toContain('Shared app device needs account review');
    expect(rendered).toContain('SHARED DEVICE');
    expect(rendered).toContain('Review account and device notes');
    expect(classNamesIn(section)).toEqual(expect.arrayContaining(['pill pill-warn', 'ops-task-card ops-task-blocked']));
  });

  it('renders the clear state when there are no check items', () => {
    const section = AppSessionsCheckQueueSection({
      items: [],
    });

    const rendered = textContent(section);

    expect(rendered).toContain('No session check');
    expect(rendered).toContain('No visible session issue in the latest heartbeat snapshot.');
    expect(classNamesIn(section)).toEqual(expect.arrayContaining(['pill pill-success']));
    expect(classNamesIn(section)).toContain('empty-state');
  });

  it('does not claim a global clear state for an empty current-page sample', () => {
    const section = AppSessionsCheckQueueSection({
      items: [],
      scopeLabel: 'Current page',
    });

    const rendered = textContent(section);
    expect(rendered).toContain('Current page review queue');
    expect(rendered).toContain('No issue on this page');
    expect(rendered).not.toContain('No session check');
  });

  it('uses the shared StatusBadge atom for the check queue status', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/app-sessions/app-sessions-check-queue-section.tsx'),
      'utf8',
    );

    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('<span className={`pill ${items.length ?');
  });

  it('keeps session check task cards on the shared Vuexy task surface', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/app-sessions/app-sessions-check-queue-section.tsx'),
      'utf8',
    );

    expect(source).toContain('AdminTaskCard');
    expect(source).toContain('AdminTaskGrid');
    expect(source).not.toContain('<div className="ops-task-grid admin-mt-12">');
    expect(source).not.toContain('className={`ops-task-card');
    expect(source).not.toContain('ops-task-card-action');
  });
});

function buildItems(): SessionCheckQueueItem[] {
  return [
    {
      action: 'Review account and device notes',
      detail: '2 user accounts used device-123.',
      key: 'duplicate-device-123',
      status: 'SHARED DEVICE',
      title: 'Shared app device needs account review',
      tone: 'ops-task-blocked',
    },
    {
      action: 'Ask user to reopen the app',
      detail: 'Last seen 2 days ago on ios.',
      key: 'expired-session-1',
      status: 'EXPIRED',
      title: 'Customer has an old session',
      tone: 'ops-task-pending',
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
