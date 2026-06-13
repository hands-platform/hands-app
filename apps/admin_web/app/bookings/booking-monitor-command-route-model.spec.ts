import type { BookingCommandCenterLane } from './booking-command-center-board';
import { buildBookingMonitorCommandRouteModel } from './booking-monitor-command-route-model';

function lane(title: string, status: string): BookingCommandCenterLane {
  return {
    title,
    status,
    detail: `${title} detail`,
    href: `/bookings?view=${title.toLowerCase().replaceAll(' ', '-')}`,
    metrics: [],
    tone: 'ok',
  };
}

describe('buildBookingMonitorCommandRouteModel', () => {
  it('builds command summary cards from named command center lanes', () => {
    const model = buildBookingMonitorCommandRouteModel({
      activeView: {
        label: 'Active only',
        operatorHint: 'Watch live dispatch.',
      },
      blockedCreateCount: 2,
      blockedCreateDetail: 'Two blocked create attempts.',
      bookingViewCounts: new Map([['first-pick', 4]]),
      commandCenter: [
        lane('Payment closeout', 'Payment watch'),
        lane('Dispatch pressure', 'Dispatch watch'),
        lane('Handoff quality', 'Handoff clear'),
        lane('Customer protection', 'Protect now'),
      ],
      topNextAction: {
        href: '/bookings/b1',
        operatorAction: 'Call customer.',
        owner: 'Support',
        priority: 'P0',
      },
      view: 'active',
      visibleBookingCount: 5,
    });

    expect(model.commandSummaryCards.map((card) => [card.label, card.value])).toEqual([
      ['Current lane', 'Active only'],
      ['Top operator action', 'P0'],
      ['Dispatch pressure', 'Dispatch watch'],
      ['Customer protection', 'Protect now'],
      ['Payment closeout', 'Payment watch'],
      ['Handoff quality', 'Handoff clear'],
      ['Blocked create attempts', '2'],
    ]);
    expect(model.commandSummaryCards[1]).toMatchObject({
      action: 'Same-shift',
      href: '/bookings/b1',
      owner: 'Support',
    });
  });

  it('keeps operator route card count fallbacks when no top action exists', () => {
    const model = buildBookingMonitorCommandRouteModel({
      activeView: {
        label: 'All bookings',
        operatorHint: 'Investigate all records.',
      },
      blockedCreateCount: 0,
      blockedCreateDetail: 'No blocked create attempts.',
      bookingViewCounts: new Map([
        ['first-pick', 1],
        ['marketplace', 2],
        ['customer-choice', 3],
      ]),
      commandCenter: [],
      view: 'all',
      visibleBookingCount: 6,
    });

    expect(model.operatorRouteCards[0]).toMatchObject({
      label: 'Handle first',
      value: 'Clear',
    });
    expect(model.operatorRouteCards.map((card) => [card.label, card.value]).slice(1, 4)).toEqual([
      ['First-pick wait', '1'],
      ['Marketplace pool', '2'],
      ['Customer choice', '3'],
    ]);
  });
});
