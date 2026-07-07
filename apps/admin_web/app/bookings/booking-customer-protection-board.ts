import type { BookingCommandTone } from './booking-command-display';

export type BookingCustomerProtectionFacts<TBooking> = {
  readonly cancelledUnresolved: readonly TBooking[];
  readonly cashDebt: readonly TBooking[];
  readonly completedCloseout: readonly TBooking[];
  readonly expiredUnresolved: readonly TBooking[];
  readonly noShowUnresolved: readonly TBooking[];
};

export type BookingCustomerProtectionLane<TBooking> = {
  readonly bookings: readonly TBooking[];
  readonly detail: string;
  readonly href: string;
  readonly operatorAction: string;
  readonly status: string;
  readonly title: string;
  readonly tone: BookingCommandTone;
};

export function bookingCustomerProtectionBoardFromFacts<TBooking>(
  facts: BookingCustomerProtectionFacts<TBooking>,
): BookingCustomerProtectionLane<TBooking>[] {
  return [
    {
      title: 'Cancelled payment release',
      status: facts.cancelledUnresolved.length ? 'Release/refund' : 'Clear',
      tone: facts.cancelledUnresolved.length ? 'danger' : 'ok',
      detail:
        facts.cancelledUnresolved.length > 0
          ? 'Customer cancelled, but the linked payment is not released or refunded yet.'
          : 'Cancelled bookings have no unresolved payment hold in the current snapshot.',
      operatorAction: 'Open payment queue and close customer money movement before support follow-up.',
      href: '/bookings?view=payment',
      bookings: facts.cancelledUnresolved,
    },
    {
      title: 'Expired matching closeout',
      status: facts.expiredUnresolved.length ? 'Timeout review' : 'Clear',
      tone: facts.expiredUnresolved.length ? 'danger' : 'ok',
      detail:
        facts.expiredUnresolved.length > 0
          ? 'Matching expired before final Partner selection, but payment still needs an outcome.'
          : 'Expired bookings have payment release/refund state aligned.',
      operatorAction: 'Release the hold, confirm customer notification, and check retry/alert history.',
      href: '/bookings?view=expired',
      bookings: facts.expiredUnresolved,
    },
    {
      title: 'No-show outcome',
      status: facts.noShowUnresolved.length ? 'Evidence needed' : 'Clear',
      tone: facts.noShowUnresolved.length ? 'warn' : 'ok',
      detail:
        facts.noShowUnresolved.length > 0
          ? 'No-show bookings still need a payment, fee, or customer support decision.'
          : 'No-show bookings have no unresolved payment in the current snapshot.',
      operatorAction: 'Review chat, arrival/location evidence, customer response, then decide payment handling.',
      href: '/bookings?view=no-show',
      bookings: facts.noShowUnresolved,
    },
    {
      title: 'Completed service reconciliation',
      status: facts.completedCloseout.length ? 'Closeout missing' : 'Clear',
      tone: facts.completedCloseout.length ? 'danger' : 'ok',
      detail:
        facts.completedCloseout.length > 0
          ? 'Completed bookings are missing capture, earning, tax, platform fee, or wallet impact records.'
          : 'Completed bookings are reconciled against payment and wallet requirements.',
      operatorAction: 'Run or inspect closeout before payout, tax, and review workflows continue.',
      href: '/bookings?view=closeout',
      bookings: facts.completedCloseout,
    },
    {
      title: 'Cash fee debt',
      status: facts.cashDebt.length ? 'Partner blocked' : 'Clear',
      tone: facts.cashDebt.length ? 'danger' : 'ok',
      detail:
        facts.cashDebt.length > 0
          ? 'Cash bookings created negative wallet balances that require settlement before final acceptance, service start, or payout release.'
          : 'No cash booking currently creates an unpaid HANDS fee debt blocker.',
      operatorAction:
        'Collect Partner fee deposit or settle from available earnings before final acceptance, service start, or payout release.',
      href: '/bookings?view=cash-debt',
      bookings: facts.cashDebt,
    },
  ];
}
