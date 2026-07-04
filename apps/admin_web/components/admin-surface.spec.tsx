import {
  AdminActionCard,
  AdminCard,
  AdminErrorState,
  AdminKpiCard,
  AdminLinkCard,
  AdminLoadingState,
  AdminSection,
  AdminTaskCard,
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

  it('renders a reusable clickable card shell without losing admin-card styling', () => {
    const card = AdminLinkCard({
      ariaLabel: 'Open payment clearing',
      children: <span>Payment clearing</span>,
      className: 'finance-overview-control-card',
      href: '/finance-tax/payment-clearing',
    });

    expect(card.props).toMatchObject({
      'aria-label': 'Open payment clearing',
      className: 'card admin-card finance-overview-control-card',
      href: '/finance-tax/payment-clearing',
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

  it('renders the shared Vuexy ops task card surface for command boards', () => {
    const card = AdminActionCard({
      actionLabel: 'Open queue',
      className: 'ops-task-pending',
      detail: 'Operators can open this filtered queue.',
      href: '/bookings?view=matching',
      signalClassName: 'signal-warn',
      signalLabel: 'Monitor',
      title: 'Matching queue',
      value: null,
      variant: 'ops-task',
    });

    expect(card.props).toMatchObject({
      className: 'ops-task-card ops-task-pending',
      href: '/bookings?view=matching',
    });
    const children = card.props.children.filter(Boolean);

    expect(children[0].props.className).toBe('signal signal-warn');
    expect(children[1].type).toBe('h3');
    expect(children[2].type).toBe('p');
    expect(children[3].type).toBe('small');
  });

  it('supports value-first ops task cards without forcing an empty heading', () => {
    const card = AdminActionCard({
      detail: 'No marketplace participant action is needed.',
      href: '/bookings?view=marketplace',
      signalClassName: 'pill-success',
      signalLabel: 'Clear',
      value: '0',
      variant: 'ops-task',
    });
    const children = card.props.children.filter(Boolean);

    expect(children.map((child: { type: unknown }) => child.type)).toEqual(['span', 'strong', 'p']);
  });

  it('renders a static Vuexy ops task card surface for non-clickable states', () => {
    const card = AdminTaskCard({
      detail: 'First-pick, supply, customer choice, chat handoff, and wallet unblock lanes are clear.',
      signalClassName: 'signal-ok',
      signalLabel: 'Clear',
      title: 'No marketplace lane needs action',
    });

    expect(card.props.className).toBe('ops-task-card');
    expect(card.props.children.filter(Boolean).map((child: { type: unknown }) => child.type)).toEqual([
      'span',
      'h3',
      'p',
    ]);
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
