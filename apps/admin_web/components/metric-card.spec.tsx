import { MetricCard } from './metric-card';

describe('MetricCard', () => {
  it('renders a static metric card when no link target is provided', () => {
    const card = MetricCard({
      helper: 'Loaded for admin review.',
      label: 'Total',
      value: 12,
    });

    expect(card.type).toBe('div');
    expect(card.props).toMatchObject({
      className: 'card',
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
      className: 'card',
      href: '/notifications?review=failed',
    });
  });
});
