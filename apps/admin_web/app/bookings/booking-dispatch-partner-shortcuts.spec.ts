import type { AdminBooking } from '../../lib/admin-api';
import { buildBookingDispatchPartnerShortcutsFromFacts } from './booking-dispatch-partner-shortcuts';

const booking = {} as AdminBooking;

describe('buildBookingDispatchPartnerShortcutsFromFacts', () => {
  it('builds the partner command shortcuts from grouped dispatch facts', () => {
    const shortcuts = buildBookingDispatchPartnerShortcutsFromFacts({
      cashDebt: [booking],
      customerSelection: [booking, booking],
      firstPickWaiting: [booking],
      locationChecks: [],
      noPartnerSupply: [booking, booking, booking],
      openMatching: [booking],
    });

    expect(shortcuts.map((shortcut) => [shortcut.title, shortcut.value, shortcut.tone])).toEqual([
      ['Partner handoff', 'Open', 'info'],
      ['Direct-ready partners', '1', 'warn'],
      ['Marketplace-ready', '3', 'warn'],
      ['Acceptance blockers', '2', 'info'],
      ['Cash fee debt', '1', 'danger'],
      ['Location refresh', '0', 'ok'],
      ['Policy controls', 'Edit', 'info'],
    ]);
    expect(shortcuts.map((shortcut) => shortcut.href)).toContain('/operations-policy');
  });

  it('uses quiet tones when no dispatch pressure facts are present', () => {
    const shortcuts = buildBookingDispatchPartnerShortcutsFromFacts({
      cashDebt: [],
      customerSelection: [],
      firstPickWaiting: [],
      locationChecks: [],
      noPartnerSupply: [],
      openMatching: [],
    });

    expect(shortcuts.slice(0, 6).map((shortcut) => shortcut.tone)).toEqual([
      'ok',
      'ok',
      'ok',
      'ok',
      'ok',
      'ok',
    ]);
  });
});
