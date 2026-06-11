import {
  actionOrderLabel,
  bookingDashboardTone,
  commandToneClass,
  commandToneLabel,
  commandToneWeight,
  stagePillClass,
} from './booking-command-display';

describe('booking command display helpers', () => {
  it('maps command tones to signal and pill classes', () => {
    expect(commandToneClass('danger')).toBe('signal-warn');
    expect(commandToneClass('warn')).toBe('signal-warn');
    expect(commandToneClass('info')).toBe('signal-info');
    expect(commandToneClass('ok')).toBe('signal-ok');

    expect(stagePillClass('danger')).toBe('pill-danger');
    expect(stagePillClass('warn')).toBe('pill-warn');
    expect(stagePillClass('info')).toBe('pill-info');
    expect(stagePillClass('ok')).toBe('pill-success');
  });

  it('maps command tones to dashboard states, labels, and sort weights', () => {
    expect(bookingDashboardTone('danger')).toBe('danger');
    expect(bookingDashboardTone('warn')).toBe('warn');
    expect(bookingDashboardTone('info')).toBe('info');
    expect(bookingDashboardTone('ok')).toBe('ok');

    expect(commandToneLabel('danger')).toBe('Immediate check');
    expect(commandToneLabel('warn')).toBe('Monitor');
    expect(commandToneLabel('info')).toBe('Info');
    expect(commandToneLabel('ok')).toBe('Clear');

    expect(commandToneWeight('danger')).toBeGreaterThan(commandToneWeight('warn'));
    expect(commandToneWeight('warn')).toBeGreaterThan(commandToneWeight('info'));
    expect(commandToneWeight('info')).toBeGreaterThan(commandToneWeight('ok'));
  });

  it('maps action priorities to operator labels', () => {
    expect(actionOrderLabel('P0')).toBe('Same-shift');
    expect(actionOrderLabel('P1')).toBe('Active watch');
    expect(actionOrderLabel('P2')).toBe('Follow-up');
    expect(actionOrderLabel('P3')).toBe('Routine');
  });
});
