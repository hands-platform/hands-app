import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FinanceCloseoutTaskBoardSection } from './finance-closeout-task-board-section';
import { renderToStaticMarkup } from 'react-dom/server';

describe('FinanceCloseoutTaskBoardSection', () => {
  it('renders closeout tasks with their status, detail, and operator action', () => {
    const section = FinanceCloseoutTaskBoardSection({
      tasks: [
        {
          action: 'Open payment holds before handoff.',
          className: 'ops-task-pending',
          detail: 'Authorized payments should remain held until service completion.',
          href: '/payments?review=authorized',
          pillClass: 'pill-warn',
          status: '2 HOLD(S)',
          title: 'Payment hold review',
        },
      ],
    });

    const rendered = textContent(section);
    const hrefs = hrefsIn(section);

    expect(section.type.name).toBe('AdminSection');
    expect(section.props).toMatchObject({
      bodyClassName: 'ops-task-grid',
      className: 'admin-mb-16',
      title: 'Closeout reconciliation board',
    });
    expect(rendered).toContain('Closeout reconciliation board');
    expect(rendered).toContain('Payment hold review');
    expect(rendered).toContain('2 HOLD(S)');
    expect(rendered).toContain('Open payment holds before handoff.');
    expect(hrefs).toContain('/operations-handoff');
  });

  it('normalizes legacy task pill classes without duplicating the pill prefix', () => {
    const section = FinanceCloseoutTaskBoardSection({
      tasks: [
        {
          action: 'Open payment holds before handoff.',
          className: 'ops-task-pending',
          detail: 'Authorized payments should remain held until service completion.',
          href: '/payments?review=authorized',
          pillClass: 'pill pill-warn',
          status: '2 HOLD(S)',
          title: 'Payment hold review',
        },
      ],
    });

    const markup = renderToStaticMarkup(section);

    expect(markup).toContain('class="pill pill-warn"');
    expect(markup).not.toContain('pill pill pill-warn');
  });

  it('renders an empty state when there are no closeout tasks', () => {
    const section = FinanceCloseoutTaskBoardSection({ tasks: [] });
    const markup = renderToStaticMarkup(section);

    expect(markup).toContain('No finance closeout task is visible for this range.');
    expect(markup).toContain('class="empty-state');
  });

  it('keeps closeout task links on the shared Vuexy action surface', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/finance-closeout/finance-closeout-task-board-section.tsx'),
      'utf8',
    );

    expect(source).toContain('AdminActionCard');
    expect(source).toContain('StatusBadge');
    expect(source).toContain("import { AdminTextLink } from '../../components/admin-text-link';");
    expect(source).toContain('<AdminTextLink');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('className={`ops-task-card');
    expect(source).not.toContain('className="text-link"');
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
  return textContent([props?.title, props?.description, props?.statusLabel, props?.actions, props?.children]);
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
  return [...href, ...hrefsIn([props?.actions, props?.children])];
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
