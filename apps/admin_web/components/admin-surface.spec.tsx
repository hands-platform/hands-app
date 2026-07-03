import {
  AdminActionCard,
  AdminCard,
  AdminErrorState,
  AdminKpiCard,
  AdminLoadingState,
  AdminSection,
} from './admin-surface';

describe('Admin surface components', () => {
  it('renders a Vuexy-aligned card shell with stable aria hooks', () => {
    const card = AdminCard({
      ariaLabelledBy: 'finance-title',
      children: <p>Finance content</p>,
      className: 'finance-card',
      id: 'finance-card',
    });

    expect(card.type).toBe('section');
    expect(card.props).toMatchObject({
      'aria-labelledby': 'finance-title',
      className: 'card admin-card finance-card',
      id: 'finance-card',
    });
  });

  it('renders a reusable admin section with title, status, body, and footer', () => {
    const section = AdminSection({
      children: <div>Rows</div>,
      description: 'Vuexy section rhythm for admin operations.',
      footer: <p>Footer note</p>,
      id: 'booking-section',
      statusLabel: 'Ready',
      statusTone: 'success',
      title: 'Booking section',
    });

    expect(section.type).toBe('section');
    expect(section.props).toMatchObject({
      'aria-labelledby': 'booking-section-title',
      className: 'card admin-section',
      id: 'booking-section',
    });
    expect(section.props.children).toHaveLength(3);
    expect(section.props.children[0].props.className).toBe('ops-section-header admin-section-header');
    expect(section.props.children[0].props.children[1].props.children[0].props.tone).toBe('success');
    expect(section.props.children[1].props.className).toBe('admin-section-body');
    expect(section.props.children[2].props.className).toBe('admin-section-footer');
  });

  it('keeps KPI cards on the existing shared metric-card implementation', () => {
    const card = AdminKpiCard({
      helper: 'From payment clearing records.',
      href: '/finance-tax/payment-clearing',
      label: 'Payment queue',
      value: 8,
    });

    expect(card.type.name).toBe('MetricCard');
    expect(card.props).toMatchObject({
      helper: 'From payment clearing records.',
      href: '/finance-tax/payment-clearing',
      label: 'Payment queue',
      value: 8,
    });
  });

  it('renders a reusable clickable action card surface', () => {
    const card = AdminActionCard({
      children: <span className="pill">ready: 2</span>,
      detail: 'Operators can open this filtered queue.',
      href: '/bookings?view=matching',
      signalClassName: 'signal-warn',
      signalLabel: 'Monitor',
      title: 'Matching queue',
      value: '3 open',
    });

    expect(card.props).toMatchObject({
      className: 'card admin-action-card',
      href: '/bookings?view=matching',
    });
  });

  it('renders standard loading and error states with operational roles', () => {
    const loading = AdminLoadingState({ message: 'Checking latest booking records.' });
    const error = AdminErrorState({
      action: <a href="/bookings">Retry</a>,
      message: 'The booking API returned an error.',
    });

    expect(loading.props).toMatchObject({
      'aria-live': 'polite',
      className: 'admin-state admin-loading-state',
      role: 'status',
    });
    expect(error.props).toMatchObject({
      className: 'admin-state admin-error-state',
      role: 'alert',
    });
    expect(error.props.children[1].props.children[2].props.className).toBe('admin-state-action');
  });
});
