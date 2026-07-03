import {
  PillClassBadge,
  PillClassBadgeLink,
  StatusBadge,
  StatusBadgeLink,
  pillClassBadgeClassName,
  statusBadgeClassName,
} from './status-badge';

describe('StatusBadge', () => {
  it('maps operational tones to existing pill classes', () => {
    expect(statusBadgeClassName('success')).toBe('pill pill-success');
    expect(statusBadgeClassName('warning')).toBe('pill pill-warn');
    expect(statusBadgeClassName('danger')).toBe('pill pill-danger');
    expect(statusBadgeClassName('info')).toBe('pill pill-info');
    expect(statusBadgeClassName('neutral')).toBe('pill pill-neutral');
  });

  it('renders a stable span with optional title text', () => {
    const badge = StatusBadge({ children: 'Ready', tone: 'success', title: 'Ready for review' });

    expect(badge.type).toBe('span');
    expect(badge.props).toMatchObject({
      className: 'pill pill-success',
      title: 'Ready for review',
      children: 'Ready',
    });
  });

  it('normalizes existing pillClass values for gradual shared badge migration', () => {
    expect(pillClassBadgeClassName('pill-danger')).toBe('pill pill-danger');
    expect(pillClassBadgeClassName('pill pill-warn')).toBe('pill pill-warn');

    const badge = PillClassBadge({ children: 'High debt', pillClass: 'pill-danger' });

    expect(badge.type).toBe('span');
    expect(badge.props).toMatchObject({
      className: 'pill pill-danger',
      children: 'High debt',
    });
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
});
