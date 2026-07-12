type ShiftBriefInput = {
  readonly matchingBookings: number;
  readonly activeBookings: number;
  readonly cashDebtPartners: number;
  readonly failedNotificationCount: number;
  readonly partnerIssueCount: number;
  readonly customerSignalCount: number;
};

export function buildShiftBriefItems(input: ShiftBriefInput) {
  return [
    {
      owner: 'Dispatch',
      title: `${input.matchingBookings} matching wait`,
      detail: `${input.activeBookings} active booking(s) need status continuity in this period.`,
      action: 'Open booking monitor and check the 10-minute Partner response window first.',
      href: '/bookings?view=matching',
      className: input.matchingBookings ? 'signal signal-warn' : 'signal signal-ok',
    },
    {
      owner: 'Partner Ops',
      title: `${input.partnerIssueCount} Partner facts to check`,
      detail: 'KYC, wallet, location, push device, and app session facts are grouped on Partner detail.',
      action: 'Open Partner list with operational filters.',
      href: '/partners',
      className: input.partnerIssueCount ? 'signal signal-warn' : 'signal signal-ok',
    },
    {
      owner: 'Finance',
      title: `${input.cashDebtPartners} cash wallet gate(s)`,
      detail: 'Cash bookings can create negative Partner wallet rows until HANDS fee settlement is posted.',
      action: 'Open cash settlement queue before approving more cash work.',
      href: '/cash-settlements',
      className: input.cashDebtPartners ? 'signal signal-danger' : 'signal signal-ok',
    },
    {
      owner: 'Support',
      title: `${input.customerSignalCount} recent customer record(s)`,
      detail:
        'Customer pages retain profile, bookings, chat archive, wallet-like payments, addresses, and notes.',
      action: 'Open customer list when a customer asks about a booking.',
      href: '/customers',
      className: 'signal signal-info',
    },
    {
      owner: 'Alerts',
      title: `${input.failedNotificationCount} failed delivery row(s)`,
      detail: 'Notification deliveries show failed code and disabled device context where available.',
      action: 'Retry or inspect push device state.',
      href: '/notifications?review=failed',
      className: input.failedNotificationCount ? 'signal signal-warn' : 'signal signal-ok',
    },
  ];
}
