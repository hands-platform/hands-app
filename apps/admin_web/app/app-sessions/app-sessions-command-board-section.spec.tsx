import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  AppSessionsCommandBoardSection,
  type SessionCommandCard,
} from './app-sessions-command-board-section';

describe('AppSessionsCommandBoardSection', () => {
  it('renders session command cards and active check count', () => {
    const section = AppSessionsCommandBoardSection({
      cards: buildCards(),
      checkCount: 2,
    });

    const rendered = textContent(section);

    expect(rendered).toContain('Session command board');
    expect(rendered).toContain('Live demand, Partner supply, push reachability');
    expect(rendered).toContain('2 check item(s)');
    expect(rendered).toContain('Partner supply records');
    expect(rendered).toContain('AVAILABLE');
    expect(rendered).toContain('3 live');
    expect(rendered).toContain('Compare against open matching demand');
    expect(classNamesIn(section)).toEqual(expect.arrayContaining(['pill pill-warn', 'ops-task-card ops-task-done']));
  });

  it('renders clear state when there are no check items', () => {
    const section = AppSessionsCommandBoardSection({
      cards: [],
      checkCount: 0,
    });

    const rendered = textContent(section);

    expect(rendered).toContain('Clear');
    expect(classNamesIn(section)).toEqual(expect.arrayContaining(['pill pill-success']));
  });

  it('uses the shared StatusBadge atom for the board status', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/app-sessions/app-sessions-command-board-section.tsx'),
      'utf8',
    );

    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('<span className={`pill ${checkCount ?');
  });

  it('keeps session command cards on the shared Vuexy task surface', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/app-sessions/app-sessions-command-board-section.tsx'),
      'utf8',
    );

    expect(source).toContain('AdminTaskCard');
    expect(source).toContain('AdminTaskGrid');
    expect(source).not.toContain('bodyClassName="ops-task-grid admin-mt-12"');
    expect(source).not.toContain('className={`ops-task-card');
    expect(source).not.toContain('ops-task-card-action');
  });
});

function buildCards(): SessionCommandCard[] {
  return [
    {
      action: 'Compare against open matching demand',
      detail: '2 partner session(s) were recently active but not live now.',
      status: 'AVAILABLE',
      title: 'Partner supply records',
      tone: 'ops-task-done',
      value: '3 live',
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
