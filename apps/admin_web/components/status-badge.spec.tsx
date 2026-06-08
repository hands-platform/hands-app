import { StatusBadge, statusBadgeClassName } from './status-badge';

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
});
