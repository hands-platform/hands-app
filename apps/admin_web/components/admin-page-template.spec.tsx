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
      className: 'toolbar admin-page-header',
    });
  });

  it('deduplicates content wrapper classes when page sections migrate to the shared shell', () => {
    const template = AdminPageTemplate({
      children: <section>Finance rows</section>,
      contentClassName: 'finance-overview-grid admin-page-content finance-overview-grid',
      title: 'Finance overview',
    });

    expect(template.props.children[2].props.className).toBe('finance-overview-grid admin-page-content');
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
          label: 'Sent',
          value: '8',
        },
      ],
    });

    expect(grid.type).toBe('section');
    expect(grid.props.className).toBe('admin-metric-grid notification-metric-grid');
    expect(grid.props['aria-label']).toBe('Notification metrics');
    expect(grid.props.children).toHaveLength(2);
    expect(grid.props.children[1].props.className).toContain('is-success');
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
