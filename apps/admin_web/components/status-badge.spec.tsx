import {
  AdminAttentionBadge,
  AdminSignal,
  PillClassBadge,
  PillClassBadgeLink,
  StatusBadge,
  StatusBadgeLink,
  pillClassBadgeClassName,
  statusBadgeClassName,
  statusBadgeToneFromPillClass,
} from './status-badge';

describe('StatusBadge', () => {
  it('maps operational tones to existing pill classes', () => {
    expect(statusBadgeClassName('success')).toBe('pill pill-success');
    expect(statusBadgeClassName('warning')).toBe('pill pill-warn');
    expect(statusBadgeClassName('danger')).toBe('pill pill-danger');
    expect(statusBadgeClassName('info')).toBe('pill pill-info');
    expect(statusBadgeClassName('neutral')).toBe('pill pill-neutral');
    expect(statusBadgeClassName('primary')).toBe('pill pill-primary');
  });

  it('renders a stable span with optional title text', () => {
    const badge = StatusBadge({
      children: 'Ready',
      className: 'vietnam-map-cluster-panel-badge',
      tone: 'success',
      title: 'Ready for review',
    });

    expect(badge.type).toBe('span');
    expect(badge.props).toMatchObject({
      className: 'pill pill-success vietnam-map-cluster-panel-badge',
      title: 'Ready for review',
      children: 'Ready',
    });
  });

  it('normalizes existing pillClass values for gradual shared badge migration', () => {
    expect(pillClassBadgeClassName('pill-danger')).toBe('pill pill-danger');
    expect(pillClassBadgeClassName('pill pill-warn')).toBe('pill pill-warn');

    const badge = PillClassBadge({
      children: 'High debt',
      className: 'vietnam-map-cluster-panel-badge is-region',
      pillClass: 'pill-danger',
    });

    expect(badge.type).toBe('span');
    expect(badge.props).toMatchObject({
      className: 'pill pill-danger vietnam-map-cluster-panel-badge is-region',
      children: 'High debt',
    });
  });

  it('maps legacy pill classes to tone-based badge atoms', () => {
    expect(statusBadgeToneFromPillClass('pill-danger')).toBe('danger');
    expect(statusBadgeToneFromPillClass('pill pill-warn')).toBe('warning');
    expect(statusBadgeToneFromPillClass('pill-success')).toBe('success');
    expect(statusBadgeToneFromPillClass('pill-info')).toBe('info');
    expect(statusBadgeToneFromPillClass('pill-neutral')).toBe('neutral');
    expect(statusBadgeToneFromPillClass('pill-primary')).toBe('primary');
    expect(statusBadgeToneFromPillClass('unknown')).toBe('neutral');
  });

  it('renders tone-based badge links for Vuexy pill navigation', () => {
    const link = StatusBadgeLink({
      children: 'Open',
      href: '/partners/partner-1',
      title: 'Open partner record',
      tone: 'info',
    });

    expect(link.props).toMatchObject({
      className: 'pill pill-info',
      href: '/partners/partner-1',
      title: 'Open partner record',
      children: 'Open',
    });
  });

  it('renders existing pill class badge links during gradual migration', () => {
    const link = PillClassBadgeLink({
      ariaLabel: 'Open blocked record',
      children: 'Open',
      href: '/bookings?view=blocked-create',
      pillClass: 'pill-warn',
    });

    expect(link.props).toMatchObject({
      'aria-label': 'Open blocked record',
      className: 'pill pill-warn',
      href: '/bookings?view=blocked-create',
      children: 'Open',
    });
  });

  it('keeps download attributes on shared badge links for export actions', () => {
    const link = PillClassBadgeLink({
      children: 'Export CSV',
      download: 'finance-export.csv',
      href: '/finance-tax/export.csv',
      pillClass: 'pill-success',
    });

    expect(link.props).toMatchObject({
      className: 'pill pill-success',
      download: 'finance-export.csv',
      href: '/finance-tax/export.csv',
      children: 'Export CSV',
    });
  });

  it('keeps aria-current on shared badge links for active filter navigation', () => {
    const link = PillClassBadgeLink({
      ariaCurrent: 'page',
      children: 'Failed sends',
      href: '/notifications?review=failed',
      pillClass: 'pill-warn',
    });

    expect(link.props).toMatchObject({
      'aria-current': 'page',
      className: 'pill pill-warn',
      href: '/notifications?review=failed',
      children: 'Failed sends',
    });
  });

  it('renders admin attention counts with the Vuexy topbar badge class', () => {
    const badge = AdminAttentionBadge({
      children: 7,
      title: 'Operation alerts',
    });

    expect(badge.type).toBe('span');
    expect(badge.props).toMatchObject({
      className: 'topbar-attention-badge',
      title: 'Operation alerts',
      children: 7,
    });
  });

  it('renders compact operational signal chips from a shared Vuexy atom', () => {
    const signal = AdminSignal({
      children: 'Cash fee debt',
      className: 'payment-ops-signal',
      tone: 'warn',
      title: 'Needs settlement',
    });

    expect(signal.type).toBe('span');
    expect(signal.props).toMatchObject({
      className: 'signal signal-warn payment-ops-signal',
      title: 'Needs settlement',
      children: 'Cash fee debt',
    });
  });

  it('deduplicates class names when legacy signal classes are passed during migration', () => {
    const signal = AdminSignal({
      children: 'Monitor',
      className: 'signal-warn ops-signal',
      tone: 'warn',
    });

    expect(signal.props).toMatchObject({
      className: 'signal signal-warn ops-signal',
      children: 'Monitor',
    });
  });
});
