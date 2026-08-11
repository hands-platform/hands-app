import type { AdminBooking } from '../../lib/admin-api';
import {
  bookingDispatchPartnerShortcutBookingFact,
  bookingDispatchPartnerShortcutFacts as collectBookingDispatchPartnerShortcutFacts,
  type BookingDispatchPartnerShortcutFacts,
} from './booking-dispatch-partner-shortcut-facts';
import type { BookingMonitorDispatchPartnerShortcut } from './booking-monitor-matching-escalation-section';
import { bookingMarketplaceCountFacts } from './booking-marketplace-count-facts';
import { bookingPreferredAwaitingDecision as bookingFirstPickPending } from './booking-preferred-provider-state';

export function buildBookingDispatchPartnerShortcuts(
  bookings: readonly AdminBooking[],
  nowMs: number,
): BookingMonitorDispatchPartnerShortcut[] {
  return buildBookingDispatchPartnerShortcutsFromFacts(
    collectBookingDispatchPartnerShortcutFacts(
      bookings.map((booking) =>
        bookingDispatchPartnerShortcutBookingFact(booking, nowMs, {
          ...bookingMarketplaceCountFacts(booking),
          firstPickPending: bookingFirstPickPending(booking),
        }),
      ),
    ),
  );
}

export function buildBookingDispatchPartnerShortcutsFromFacts(
  facts: BookingDispatchPartnerShortcutFacts,
): BookingMonitorDispatchPartnerShortcut[] {
  return [
    {
      title: 'Partner handoff',
      value: 'Open',
      detail: 'Full Partner command view with direct, marketplace, KYC, wallet, location, and alert lanes.',
      href: '/partners',
      tone: facts.openMatching.length ? 'info' : 'ok',
    },
    {
      title: 'Direct-ready Partners',
      value: facts.firstPickWaiting.length.toString(),
      detail: 'Use when preferred Partners must answer inside the response window.',
      href: '/partners?review=ready-now',
      tone: facts.firstPickWaiting.length ? 'warn' : 'ok',
    },
    {
      title: 'Marketplace-ready',
      value: facts.noPartnerSupply.length.toString(),
      detail: 'Use when open matching has no marketplace supply or customer options.',
      href: '/partners?review=ready-now',
      tone: facts.noPartnerSupply.length ? 'warn' : 'ok',
    },
    {
      title: 'Acceptance blockers',
      value: facts.customerSelection.length.toString(),
      detail: 'Repair KYC, bank, wallet, location, push, or control gates before dispatch pressure rises.',
      href: '/partners?review=available-blocked',
      tone: facts.customerSelection.length ? 'info' : 'ok',
    },
    {
      title: 'Cash fee debt',
      value: facts.cashDebt.length.toString(),
      detail: 'Cash bookings can create negative Partner wallets that block final acceptance, service start, and payout release.',
      href: '/cash-settlements',
      tone: facts.cashDebt.length ? 'danger' : 'ok',
    },
    {
      title: 'Location refresh',
      value: facts.locationChecks.length.toString(),
      detail: 'Live booking location checks should send operators to Partner location freshness review.',
      href: '/partners?review=available-blocked-location',
      tone: facts.locationChecks.length ? 'warn' : 'ok',
    },
    {
      title: 'Policy controls',
      value: 'Edit',
      detail: 'Tune response window, marketplace radius, invitation limits, and stale location rules.',
      href: '/operations-policy',
      tone: 'info',
    },
  ];
}
