import {
  buildBookingCommandSummaryCards,
  buildBookingOperatorRouteCards,
  type BookingCommandRouteTopAction,
} from '../../lib/booking-command-route-cards';
import type { BookingCommandCenterLane } from './booking-command-center-board';
import { actionOrderLabel, type BookingActionPriority } from './booking-command-display';
import type { BookingMonitorViewOption } from './booking-monitor-options';
import type { BookingPageView } from './booking-page-params';

type BookingMonitorTopAction = {
  readonly href: string;
  readonly operatorAction: string;
  readonly owner: string;
  readonly priority: BookingActionPriority;
};

type BuildBookingMonitorCommandRouteModelInput = {
  readonly activeView: Pick<BookingMonitorViewOption, 'label' | 'operatorHint'>;
  readonly blockedCreateCount: number;
  readonly blockedCreateDetail: string;
  readonly bookingViewCounts: ReadonlyMap<string, number>;
  readonly commandCenter: readonly BookingCommandCenterLane[];
  readonly topNextAction?: BookingMonitorTopAction;
  readonly view: BookingPageView;
  readonly visibleBookingCount: number;
};

export function buildBookingMonitorCommandRouteModel({
  activeView,
  blockedCreateCount,
  blockedCreateDetail,
  bookingViewCounts,
  commandCenter,
  topNextAction,
  view,
  visibleBookingCount,
}: BuildBookingMonitorCommandRouteModelInput) {
  const topAction = bookingCommandRouteTopAction(topNextAction);
  const lanes = {
    dispatch: bookingCommandLaneByTitle(commandCenter, 'Dispatch pressure', 0),
    handoff: bookingCommandLaneByTitle(commandCenter, 'Handoff quality', 3),
    payment: bookingCommandLaneByTitle(commandCenter, 'Payment closeout', 2),
    protection: bookingCommandLaneByTitle(commandCenter, 'Customer protection', 1),
  };

  return {
    commandSummaryCards: buildBookingCommandSummaryCards({
      activeView: {
        label: activeView.label,
        operatorHint: activeView.operatorHint,
        view,
      },
      blockedCreateCount,
      blockedCreateDetail,
      lanes,
      topAction,
      visibleBookingCount,
    }),
    operatorRouteCards: buildBookingOperatorRouteCards({
      blockedCreateCount,
      blockedCreateDetail,
      bookingViewCounts,
      topAction,
    }),
  };
}

function bookingCommandRouteTopAction(
  topNextAction: BookingMonitorTopAction | undefined,
): BookingCommandRouteTopAction | undefined {
  if (!topNextAction) {
    return undefined;
  }

  return {
    actionLabel: actionOrderLabel(topNextAction.priority),
    href: topNextAction.href,
    operatorAction: topNextAction.operatorAction,
    owner: topNextAction.owner,
    priority: topNextAction.priority,
  };
}

function bookingCommandLaneByTitle(
  lanes: readonly BookingCommandCenterLane[],
  title: string,
  fallbackIndex: number,
) {
  return lanes.find((lane) => lane.title === title) ?? lanes[fallbackIndex];
}
