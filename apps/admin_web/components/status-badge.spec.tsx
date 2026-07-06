import { readFileSync } from 'node:fs';

import {
  AdminAttentionBadge,
  AdminSignal,
  StatusBadge,
  StatusBadgeButton,
  StatusBadgeFromPillClass,
  StatusBadgeLink,
  StatusBadgeLinkFromPillClass,
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
      ariaDisabled: true,
      children: 'Ready',
      className: 'vietnam-map-cluster-panel-badge',
      tone: 'success',
      title: 'Ready for review',
    });

    expect(badge.type).toBe('span');
    expect(badge.props).toMatchObject({
      'aria-disabled': true,
      className: 'pill pill-success vietnam-map-cluster-panel-badge',
      title: 'Ready for review',
      children: 'Ready',
    });
  });

  it('keeps only the requested Vuexy pill tone when legacy tone classes are passed during migration', () => {
    const badge = StatusBadge({
      children: 'Ready',
      className: 'pill-danger booking-status-chip',
      tone: 'success',
    });
    const link = StatusBadgeLink({
      children: 'Open',
      className: 'pill pill-warn finance-chip',
      href: '/finance-tax',
      tone: 'info',
    });

    expect(badge.props.className).toBe('pill pill-success booking-status-chip');
    expect(link.props.className).toBe('pill pill-info finance-chip');
  });

  it('does not export legacy pill-class badge components', () => {
    const source = readFileSync('components/status-badge.tsx', 'utf8');

    expect(source).not.toContain('export function pillClassBadgeClassName');
    expect(source).not.toContain('export function PillClassBadge');
    expect(source).not.toContain('export function PillClassBadgeLink');
    expect(source).not.toContain('type PillClassBadgeProps');
    expect(source).not.toContain('type PillClassBadgeLinkProps');
  });

  it('maps legacy pill classes to tone-based badge atoms', () => {
    expect(statusBadgeToneFromPillClass('pill-danger')).toBe('danger');
    expect(statusBadgeToneFromPillClass('pill-blocked')).toBe('danger');
    expect(statusBadgeToneFromPillClass('pill pill-warn')).toBe('warning');
    expect(statusBadgeToneFromPillClass('pill-pending')).toBe('warning');
    expect(statusBadgeToneFromPillClass('pill-success')).toBe('success');
    expect(statusBadgeToneFromPillClass('pill-done')).toBe('success');
    expect(statusBadgeToneFromPillClass('signal signal-ok')).toBe('success');
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

  it('renders shared adapter badges from legacy pill class tones while preserving extra classes', () => {
    const badge = StatusBadgeFromPillClass({
      children: 'Blocked',
      className: 'dashboard-chip',
      pillClass: 'pill pill-danger admin-ml-6',
    });
    const link = StatusBadgeLinkFromPillClass({
      children: 'Open',
      href: '/bookings',
      pillClass: 'pill-warn dashboard-link',
    });

    expect(badge.props).toMatchObject({
      className: 'pill pill-danger admin-ml-6 dashboard-chip',
      children: 'Blocked',
    });
    expect(link.props).toMatchObject({
      className: 'pill pill-warn dashboard-link',
      href: '/bookings',
      children: 'Open',
    });
  });

  it('renders tone-based badge buttons for Vuexy pill actions', () => {
    const button = StatusBadgeButton({
      children: 'Confirm',
      disabled: true,
      title: 'Confirm action',
      tone: 'danger',
      type: 'submit',
    });

    expect(button.type).toBe('button');
    expect(button.props).toMatchObject({
      className: 'pill pill-danger',
      disabled: true,
      title: 'Confirm action',
      type: 'submit',
      children: 'Confirm',
    });
  });

  it('keeps aria-label on tone-based badge links for blocked record navigation', () => {
    const link = StatusBadgeLink({
      ariaLabel: 'Open blocked record',
      children: 'Open',
      href: '/bookings?view=blocked-create',
      tone: 'warning',
    });

    expect(link.props).toMatchObject({
      'aria-label': 'Open blocked record',
      className: 'pill pill-warn',
      href: '/bookings?view=blocked-create',
      children: 'Open',
    });
  });

  it('keeps download attributes on shared badge links for export actions', () => {
    const link = StatusBadgeLink({
      children: 'Export CSV',
      download: 'finance-export.csv',
      href: '/finance-tax/export.csv',
      tone: 'success',
    });

    expect(link.props).toMatchObject({
      className: 'pill pill-success',
      download: 'finance-export.csv',
      href: '/finance-tax/export.csv',
      children: 'Export CSV',
    });
  });

  it('keeps aria-current on shared badge links for active filter navigation', () => {
    const link = StatusBadgeLink({
      ariaCurrent: 'page',
      children: 'Failed sends',
      href: '/notifications?review=failed',
      tone: 'warning',
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
