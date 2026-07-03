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

    expect(section.type).toBe('section');
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

    expect(textContent(section)).toContain('No finance closeout task is visible for this range.');
  });
});

function textContent(value: unknown): string {
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

function readRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}
