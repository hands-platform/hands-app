import { adminCountLabel } from '../../lib/admin-copy';

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
      detail: `${adminCountLabel(input.activeBookings, 'active booking')} ${input.activeBookings === 1 ? 'needs' : 'need'} status continuity in this period.`,
      action: 'Open booking monitor and check the 10-minute Partner response window first.',
      status: input.matchingBookings ? 'Needs review' : 'Clear',
      href: '/bookings?view=matching',
      className: input.matchingBookings ? 'signal signal-warn' : 'signal signal-ok',
    },
    {
      owner: 'Partner Ops',
      title: `${input.partnerIssueCount} Partner facts to check`,
      detail: 'KYC, wallet, location, push device, and app session facts are grouped on Partner detail.',
      action: 'Open Partner list with operational filters.',
      status: input.partnerIssueCount ? 'Review' : 'Clear',
      href: '/partners',
      className: input.partnerIssueCount ? 'signal signal-warn' : 'signal signal-ok',
    },
    {
      owner: 'Finance',
      title: adminCountLabel(input.cashDebtPartners, 'cash wallet gate'),
      detail: 'Cash bookings can create negative Partner wallet rows until HANDS fee settlement is posted.',
      action: 'Open cash settlement queue before approving more cash work.',
      status: input.cashDebtPartners ? 'Settle' : 'Clear',
      href: '/cash-settlements',
      className: input.cashDebtPartners ? 'signal signal-danger' : 'signal signal-ok',
    },
    {
      owner: 'Support',
      title: adminCountLabel(input.customerSignalCount, 'recent customer record'),
      detail:
        'Customer pages retain profile, bookings, chat archive, wallet-like payments, addresses, and notes.',
      action: 'Open customer list when a customer asks about a booking.',
      status: input.customerSignalCount ? 'Reference' : 'No rows',
      href: '/customers',
      className: 'signal signal-info',
    },
    {
      owner: 'Alerts',
      title: adminCountLabel(input.failedNotificationCount, 'failed delivery row'),
      detail: 'Notification deliveries show failed code and disabled device context where available.',
      action: 'Retry or inspect push device state.',
      status: input.failedNotificationCount ? 'Retry/check' : 'Clear',
      href: '/notifications?review=failed',
      className: input.failedNotificationCount ? 'signal signal-warn' : 'signal signal-ok',
    },
  ];
}
