import { readFileSync } from 'node:fs';

import { AdminMetricGrid, AdminPageTemplate, AdminSectionHeader } from './admin-page-template';

describe('AdminPageTemplate', () => {
  it('renders a standard admin header with optional actions and metrics', () => {
    const template = AdminPageTemplate({
      actions: <a href="/notifications">Open queue</a>,
      children: <section>Notification rows</section>,
      description: 'Shared page shell for operational admin pages.',
      metrics: [{ helper: 'Needs operator review.', label: 'Retry queue', value: 3 }],
      title: 'Notifications',
    });

    expect(template.props.children).toHaveLength(3);
    expect(template.props.children[0].props).toMatchObject({
      className: 'admin-page-header admin-page-header-toolbar',
    });
    expect(template.props.children[0].props.children[0].props.className).toBe('admin-page-header-copy');
    expect(template.props.children[0].props.children[1].props.className).toBe('admin-page-header-actions');
    expect(template.props.children[0].props.children[1].props['aria-label']).toBe('Page actions');
    expect(template.props.children[0].props.children[1].props['data-empty']).toBeUndefined();
  });

  it('keeps the same page header slots when a page has no actions', () => {
    const template = AdminPageTemplate({
      children: <section>Calendar board</section>,
      title: 'Calendar',
    });

    const header = template.props.children[0];

    expect(header.props.children).toHaveLength(2);
    expect(header.props.children[0].props.className).toBe('admin-page-header-copy');
    expect(header.props.children[1].props.className).toBe('admin-page-header-actions');
    expect(header.props.children[1].props['aria-label']).toBe('Page actions');
    expect(header.props.children[1].props['data-empty']).toBe('true');
  });

  it('allows an operational page to set a stable desktop metric layout', () => {
    const template = AdminPageTemplate({
      children: <section>Delivery records</section>,
      metrics: [{ label: 'Needs retry', value: 3 }],
      metricsClassName: 'notification-action-metric-grid',
      title: 'Notifications',
    });

    expect(template.props.children[1].props.className).toBe('notification-action-metric-grid');
  });

  it('deduplicates content wrapper classes when page sections migrate to the shared shell', () => {
    const template = AdminPageTemplate({
      children: <section>Finance rows</section>,
      contentClassName: 'finance-overview-grid admin-page-content finance-overview-grid',
      title: 'Finance overview',
    });

    expect(template.props.children[2].props.className).toBe('finance-overview-grid admin-page-content');
  });

  it('scopes shared page header typography to direct title copy slots', () => {
    const css = readFileSync('app/globals.css', 'utf8');

    expect(css).toContain('.admin-page-header-copy {');
    expect(css).toContain('.admin-page-header-copy > h1');
    expect(css).toContain('.admin-page-header-copy > p');
    expect(css).toContain('.admin-page-header-toolbar {');
    expect(css).toContain('grid-template-columns: minmax(240px, 1fr) minmax(0, min(560px, 62%));');
    expect(css).toContain('.admin-page-header-actions {');
    expect(css).toContain('justify-self: end;');
    expect(css).toContain('max-width: min(100%, 560px);');
    expect(css).toContain('.admin-page-header-actions .text-link {');
    expect(css).toContain(".admin-page-header-actions[data-empty='true']");
    expect(css).not.toContain('.admin-page-header h1');
    expect(css).not.toContain('.admin-page-header p');
    expect(css).not.toContain('.admin-page-header > div > h1');
    expect(css).not.toContain('.admin-page-header > div > p');
    expect(css).not.toContain('.admin-page-header.toolbar');
  });

  it('does not keep page-specific top-level toolbar overrides for shared page headers', () => {
    const css = readFileSync('app/globals.css', 'utf8');
    const staleHeaderOverrides = css.match(/^\.[\w-]+-page\s*>\s*\.toolbar\b/gm) ?? [];
    const staleContentOverrides = css.match(/^\.(booking-monitor|notification-monitor)\s*>\s*\.toolbar\b/gm) ?? [];

    expect([...staleHeaderOverrides, ...staleContentOverrides]).toEqual([]);
  });

  it('normalizes page header terminology through the shared shell', () => {
    const labels = [
      AdminPageTemplate({ children: <section />, title: 'Customer Management' }),
      AdminPageTemplate({ children: <section />, title: 'Usage Overview' }),
      AdminPageTemplate({ children: <section />, title: 'Service catalog' }),
      AdminPageTemplate({ children: <section />, title: 'Setup' }),
    ].map((template) => normalizeSpaces(textContent(template.props.children[0])));

    expect(labels).toEqual([
      'Customers',
      'Customer Usage Overview',
      'Service Catalog',
      'Setup Readiness',
    ]);
  });

  it('renders metric cards through the shared metric grid', () => {
    const grid = AdminMetricGrid({
      ariaLabel: 'Notification metrics',
      className: 'notification-metric-grid',
      metrics: [
        { helper: 'Loaded from API fallback.', label: 'Total', value: 12 },
        {
          className: 'is-success',
          helper: 'Clean route.',
          href: '/notifications?review=sent',
          iconSize: 18,
          kind: 'period',
          label: 'Sent',
          scope: 'Today',
          value: '8',
        },
      ],
    });

    expect(grid.type).toBe('section');
    expect(grid.props.className).toBe('admin-metric-grid notification-metric-grid');
    expect(grid.props['aria-label']).toBe('Notification metrics');
    expect(grid.props.children).toHaveLength(2);
    expect(grid.props.children[1].props.className).toContain('is-success');
    expect(grid.props.children[1].props.kind).toBe('period');
    expect(grid.props.children[1].props.scope).toBe('Today');
  });

  it('renders metric values through the shared Vuexy date atom when raw timestamps are provided', () => {
    const grid = AdminMetricGrid({
      metrics: [
        {
          helper: 'Newest loaded message',
          label: 'Latest message',
          value: 'None',
          valueDateTimeFallback: 'None',
          valueDateTimeValue: '2026-06-29T01:20:00.000Z',
        },
      ],
    });

    const rendered = normalizeSpaces(textContent(grid));
    const classes = classNamesIn(grid);

    expect(rendered).toContain('Latest message');
    expect(rendered).toContain('29 Jun 2026, 08:20');
    expect(rendered).toContain('Newest loaded message');
    expect(rendered).not.toContain('None');
    expect(classes).toContain('date-time-text');
  });

  it('keeps duplicate metric labels on unique React keys during overview migrations', () => {
    const grid = AdminMetricGrid({
      metrics: [
        { helper: 'Open booking queue.', label: 'Open', value: 4 },
        { helper: 'Open finance queue.', label: 'Open', value: 2 },
      ],
    });

    expect(grid.props.children.map((child: { key: string }) => child.key)).toEqual(['Open-0', 'Open-1']);
  });

  it('deduplicates shared Vuexy shell class tokens during page migrations', () => {
    const grid = AdminMetricGrid({
      className: 'admin-metric-grid usage-overview-grid admin-metric-grid',
      metrics: [{ helper: 'Needs operator review.', label: 'Open', value: 4 }],
    });
    const header = AdminSectionHeader({
      className: 'ops-section-header admin-section-header admin-mt-16 admin-section-header',
      title: 'Command board',
    });

    expect(grid.props.className).toBe('admin-metric-grid usage-overview-grid');
    expect(header.props.className).toBe('ops-section-header admin-section-header admin-mt-16');
  });

  it('renders a reusable admin section header with status and actions', () => {
    const header = AdminSectionHeader({
      actions: <a href="/operations-policy">Open policy</a>,
      className: 'admin-mt-16',
      description: 'Reusable section title for command boards and tables.',
      descriptionId: 'command-board-description',
      status: <span className="pill pill-success">Ready</span>,
      title: 'Command board',
      titleId: 'command-board-title',
    });

    expect(header.type).toBe('div');
    expect(header.props).toMatchObject({
      className: 'ops-section-header admin-section-header admin-mt-16',
    });
    expect(header.props.children[0].props.children[0].props.id).toBe('command-board-title');
    expect(header.props.children[0].props.children[1].props.id).toBe('command-board-description');
    expect(header.props.children).toHaveLength(2);
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

function normalizeSpaces(value: string) {
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
