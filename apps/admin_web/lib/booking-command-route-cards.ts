export type BookingCommandRouteCard = {
  readonly action: string;
  readonly detail: string;
  readonly href: string;
  readonly label: string;
  readonly owner: string;
  readonly value: string;
};

export type BookingCommandRouteCountKey =
  | 'cash-debt'
  | 'chat-repair'
  | 'closeout'
  | 'customer-choice'
  | 'first-pick'
  | 'marketplace';

export type BookingCommandRouteLane = {
  readonly detail: string;
  readonly href: string;
  readonly status: string;
};

export type BookingCommandRouteTopAction = {
  readonly actionLabel: string;
  readonly href: string;
  readonly operatorAction: string;
  readonly owner: string;
  readonly priority: string;
};

type BookingCommandSummaryInput = {
  readonly activeView: {
    readonly label: string;
    readonly operatorHint: string;
    readonly view: string;
  };
  readonly blockedCreateCount: number;
  readonly blockedCreateDetail: string;
  readonly lanes: {
    readonly dispatch?: BookingCommandRouteLane;
    readonly handoff?: BookingCommandRouteLane;
    readonly payment?: BookingCommandRouteLane;
    readonly protection?: BookingCommandRouteLane;
  };
  readonly topAction?: BookingCommandRouteTopAction;
  readonly visibleBookingCount: number;
};

type BookingOperatorRouteInput = {
  readonly blockedCreateCount: number;
  readonly blockedCreateDetail: string;
  readonly bookingViewCounts: ReadonlyMap<string, number>;
  readonly topAction?: BookingCommandRouteTopAction;
};

export function buildBookingCommandSummaryCards(input: BookingCommandSummaryInput) {
  return [
    {
      label: 'Current lane',
      value: input.activeView.label,
      detail: `${input.visibleBookingCount} visible booking(s). ${input.activeView.operatorHint}`,
      owner: 'Shift lead',
      action: 'Confirm the active queue before opening records.',
      href: `/bookings?view=${input.activeView.view}`,
    },
    {
      label: 'Top operator action',
      value: input.topAction?.priority ?? 'Clear',
      detail: input.topAction?.operatorAction ?? 'No immediate booking action is waiting in this view.',
      owner: input.topAction?.owner ?? 'Shift lead',
      action: input.topAction?.actionLabel ?? 'Monitor',
      href: input.topAction?.href ?? '/bookings?view=active',
    },
    {
      label: 'Dispatch pressure',
      value: input.lanes.dispatch?.status ?? 'Stable',
      detail: input.lanes.dispatch?.detail ?? 'Booking demand and partner supply records are loaded.',
      owner: 'Dispatch',
      action: 'Watch first-pick, marketplace, and customer choice flow.',
      href: input.lanes.dispatch?.href ?? '/bookings?view=matching',
    },
    {
      label: 'Customer protection',
      value: input.lanes.protection?.status ?? 'Clear',
      detail: input.lanes.protection?.detail ?? 'Customer handoff, chat, and cancellation evidence are loaded.',
      owner: 'Support',
      action: 'Check chat, cancellation, expired, and no-show evidence.',
      href: input.lanes.protection?.href ?? '/bookings?view=attention',
    },
    {
      label: 'Payment closeout',
      value: input.lanes.payment?.status ?? 'Ready',
      detail: input.lanes.payment?.detail ?? 'Payment, cash debt, and closeout checks are loaded.',
      owner: 'Finance',
      action: 'Close payment, refund, wallet, tax, and fee settlement gaps.',
      href: input.lanes.payment?.href ?? '/bookings?view=payment',
    },
    {
      label: 'Handoff quality',
      value: input.lanes.handoff?.status ?? 'Clear',
      detail: input.lanes.handoff?.detail ?? 'Partner location and chat handoff checks are loaded.',
      owner: 'Support',
      action: 'Confirm service handoff has chat and location evidence.',
      href: input.lanes.handoff?.href ?? '/bookings?view=location',
    },
    {
      label: 'Blocked create attempts',
      value: `${input.blockedCreateCount}`,
      detail: input.blockedCreateDetail,
      owner: 'Product ops',
      action: 'Review rejected address snapshot or booking creation attempts.',
      href: '/bookings?view=blocked-create',
    },
  ] satisfies readonly BookingCommandRouteCard[];
}

export function buildBookingOperatorRouteCards(input: BookingOperatorRouteInput) {
  return [
    {
      label: 'Handle first',
      value: input.topAction?.priority ?? 'Clear',
      detail: input.topAction?.operatorAction ?? 'No urgent booking action is waiting right now.',
      owner: input.topAction?.owner ?? 'Shift lead',
      action: input.topAction?.actionLabel ?? 'Monitor queue',
      href: input.topAction?.href ?? '/bookings?view=active',
    },
    routeCountCard(
      'First-pick wait',
      input.bookingViewCounts,
      'first-pick',
      'Preferred Partner has the first response window while the marketplace remains open in parallel.',
      'Dispatch',
      'Watch the direct Partner response window.',
    ),
    routeCountCard(
      'Marketplace pool',
      input.bookingViewCounts,
      'marketplace',
      'Partners within the booking-address radius can participate and remain visible to the customer.',
      'Dispatch',
      'Confirm 10km Partner participation is healthy.',
    ),
    routeCountCard(
      'Customer choice',
      input.bookingViewCounts,
      'customer-choice',
      'Customer fallback choice is required when first-pick does not validly win under API rules.',
      'Support',
      'Help customers finish final Partner selection.',
    ),
    routeCountCard(
      'Chat repair',
      input.bookingViewCounts,
      'chat-repair',
      'Matched or started service records that need chat-room integrity checked.',
      'Support',
      'Repair missing or disconnected booking chat rooms.',
    ),
    routeCountCard(
      'Cash debt gate',
      input.bookingViewCounts,
      'cash-debt',
      'Cash bookings can create Partner fee debt that blocks final acceptance, service start, and payout release.',
      'Finance',
      'Confirm partner fee collection or wallet debt state.',
    ),
    routeCountCard(
      'Closeout',
      input.bookingViewCounts,
      'closeout',
      'Completed bookings needing earning, tax, wallet, or evidence closeout checks.',
      'Finance',
      'Finish settlement and closeout evidence.',
    ),
    {
      label: 'Create rejections',
      value: `${input.blockedCreateCount}`,
      detail: input.blockedCreateDetail,
      owner: 'Product ops',
      action: 'Inspect blocked booking create audit records.',
      href: '/bookings?view=blocked-create',
    },
  ] satisfies readonly BookingCommandRouteCard[];
}

function routeCountCard(
  label: string,
  counts: ReadonlyMap<string, number>,
  view: BookingCommandRouteCountKey,
  detail: string,
  owner: string,
  action: string,
): BookingCommandRouteCard {
  return {
    label,
    value: `${counts.get(view) ?? 0}`,
    detail,
    owner,
    action,
    href: `/bookings?view=${view}`,
  };
}
