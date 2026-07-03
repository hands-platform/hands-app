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
    const content = card.props.children.props.children[1].props.children;
    expect(content[0].props.children).toBe('Total');
    expect(content[1].props.children).toBe(12);
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
});
