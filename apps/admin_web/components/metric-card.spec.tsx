import { MetricCard } from './metric-card';
import { MapPinned } from 'lucide-react';

describe('MetricCard', () => {
  it('renders a static metric card when no link target is provided', () => {
    const card = MetricCard({
      helper: 'Loaded for admin review.',
      label: 'Total',
      value: 12,
    });

    expect(card.type).toBe('div');
    expect(card.props).toMatchObject({
      className: 'card admin-kpi-card',
    });
    expect(card.props.children.props.className).toBe('metric-card');
    const content = card.props.children.props.children[1].props.children.filter(Boolean);
    expect(content[0].props.children).toBe('All records');
    expect(content[1].props.children).toBe('Total');
    expect(content[2].props.className).toBe('metric-card-value');
    expect(content[2].props.children[0].props.className).toBe('sr-only');
    expect(content[2].props.children[0].props.children).toEqual(['Total', ': ']);
    expect(content[2].props.children[1]).toBe(12);
    expect(content[2].type).toBe('div');
  });

  it('renders a linked metric card when an href is provided', () => {
    const card = MetricCard({
      helper: 'Open the retry queue.',
      href: '/notifications?review=failed',
      label: 'Needs retry',
      value: '3',
    });

    expect(card.type).toBeDefined();
    expect(card.props).toMatchObject({
      className: 'card admin-kpi-card',
      href: '/notifications?review=failed',
    });
  });

  it('allows page-specific classes and explicit icons while keeping the shared metric content shell', () => {
    const card = MetricCard({
      className: 'vietnam-overview-metric is-info',
      helper: 'Stored address points.',
      icon: MapPinned,
      iconSize: 18,
      label: 'Mapped points',
      value: '42',
    });

    expect(card.props).toMatchObject({
      className: 'card admin-kpi-card vietnam-overview-metric is-info',
    });
    expect(card.props.children.props.className).toBe('metric-card');
    expect(card.props.children.props.children[0].props.children.type).toBe(MapPinned);
    expect(card.props.children.props.children[0].props.children.props.size).toBe(18);
  });

  it('renders an operator scope pill before KPI labels when provided', () => {
    const card = MetricCard({
      helper: '10 booking create attempts need review.',
      kind: 'risk',
      label: 'Create blocks',
      scope: 'Today',
      value: 10,
    });

    const content = card.props.children.props.children[1].props.children;

    expect(content[0].props.className).toBe('metric-card-scope is-risk');
    expect(content[0].props.children).toBe('Today');
    expect(content[1].props.children).toBe('Create blocks');
  });

  it('infers the scope from helper copy when the label is generic', () => {
    const card = MetricCard({
      helper: 'Payout batches in the selected range.',
      label: 'Total batches',
      value: 8,
    });

    const content = card.props.children.props.children[1].props.children;

    expect(content[0].props.className).toBe('metric-card-scope is-period');
    expect(content[0].props.children).toBe('Selected range');
  });

  it('uses helper risk language when inferring the card kind', () => {
    const card = MetricCard({
      helper: 'Failed delivery callbacks need review today.',
      label: 'Callbacks',
      value: 3,
    });

    const content = card.props.children.props.children[1].props.children;

    expect(content[0].props.className).toBe('metric-card-scope is-risk');
    expect(content[0].props.children).toBe('Today');
  });

  it('uses a filter-oriented fallback instead of the vague current view label', () => {
    const card = MetricCard({
      helper: 'Loaded for operator review.',
      label: 'Open items',
      value: 5,
    });

    const content = card.props.children.props.children[1].props.children;

    expect(content[0].props.children).toBe('Current filters');
  });

  it('omits the scope badge when a parent already labels the period', () => {
    const card = MetricCard({ helper: 'Period outcome.', label: 'Completed', scope: null, value: 4 });
    const content = card.props.children.props.children[1].props.children;

    expect(content[0]).toBeNull();
  });
});
