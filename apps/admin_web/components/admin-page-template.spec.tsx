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

  it('renders metric cards through the shared metric grid', () => {
    const grid = AdminMetricGrid({
      metrics: [
        { helper: 'Loaded from API fallback.', label: 'Total', value: 12 },
        { helper: 'Clean route.', href: '/notifications?review=sent', label: 'Sent', value: '8' },
      ],
    });

    expect(grid.type).toBe('section');
    expect(grid.props.className).toBe('admin-metric-grid');
    expect(grid.props.children).toHaveLength(2);
  });

  it('renders a reusable admin section header with status and actions', () => {
    const header = AdminSectionHeader({
      actions: <a href="/operations-policy">Open policy</a>,
      description: 'Reusable section title for command boards and tables.',
      status: <span className="pill pill-success">Ready</span>,
      title: 'Command board',
    });

    expect(header.type).toBe('div');
    expect(header.props).toMatchObject({
      className: 'ops-section-header admin-section-header',
    });
    expect(header.props.children).toHaveLength(2);
  });
});
