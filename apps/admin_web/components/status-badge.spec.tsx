import { PillClassBadge, StatusBadge, pillClassBadgeClassName, statusBadgeClassName } from './status-badge';

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
});
