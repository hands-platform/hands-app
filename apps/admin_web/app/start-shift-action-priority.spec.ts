import type { AdminStartShiftAnalytics } from '../lib/admin-api';
import {
  prioritizeStartShiftActions,
  prioritizeStartShiftCommandItems,
  splitStartShiftActions,
  startShiftActionAgeing,
  startShiftActionHref,
  startShiftActionValue,
} from './start-shift-action-priority';

type StartShiftNeedsAction = AdminStartShiftAnalytics['needsAction'][number];

function action(
  key: string,
  count: number,
  oldestAt: string | null,
  slaMinutes = 60,
  overdueCount?: number,
): StartShiftNeedsAction {
  return {
    ageing: {
      fourToTwentyFourHours: 0,
      oneToFourHours: 0,
      overTwentyFourHours: count,
      underOneHour: 0,
    },
    amount: 0,
    count,
    href: `/${key}`,
    key,
    label: key,
    oldestAt,
    operatorAction: `Review ${key}`,
    ...(overdueCount === undefined ? {} : { overdueCount }),
    slaMinutes,
  };
}

describe('Start Shift action priority', () => {
  const now = Date.parse('2026-07-19T05:00:00.000Z');

  it('places breached SLA work before money risk, customer waiting, and clear queues', () => {
    const result = prioritizeStartShiftActions(
      [
        action('matching-delays', 1, '2026-07-19T04:55:00.000Z'),
        action('payment-holds', 2, '2026-07-19T04:30:00.000Z'),
        action('partner-approvals', 1, '2026-07-17T00:00:00.000Z'),
        action('notification-failures', 0, null),
      ],
      now,
    );

    expect(result.map((item) => item.action.key)).toEqual([
      'partner-approvals',
      'payment-holds',
      'matching-delays',
      'notification-failures',
    ]);
    expect(result.map((item) => item.status)).toEqual([
      'SLA overdue',
      'Money risk',
      'Customer waiting',
      'Clear',
    ]);
    expect(result.map((item) => item.tone)).toEqual(['warn', 'warn', 'warn', 'ok']);
  });

  it('keeps only the top three open queues expanded and groups the rest', () => {
    const prioritized = prioritizeStartShiftActions(
      [
        { ...action('matching-delays', 1, '2026-07-19T04:00:00.000Z', 60, 0), ageing: { fourToTwentyFourHours: 0, oneToFourHours: 0, overTwentyFourHours: 0, underOneHour: 1 } },
        { ...action('payment-holds', 2, '2026-07-19T03:00:00.000Z', 60, 1), ageing: { fourToTwentyFourHours: 0, oneToFourHours: 1, overTwentyFourHours: 0, underOneHour: 1 } },
        { ...action('cancellation-review', 3, '2026-07-19T02:00:00.000Z', 60, 2), ageing: { fourToTwentyFourHours: 1, oneToFourHours: 1, overTwentyFourHours: 0, underOneHour: 1 } },
        { ...action('refund-review', 4, '2026-07-19T01:00:00.000Z', 60, 3), ageing: { fourToTwentyFourHours: 2, oneToFourHours: 1, overTwentyFourHours: 0, underOneHour: 1 } },
        action('notification-failures', 0, null),
      ],
      now,
    );
    const queues = splitStartShiftActions(prioritized);

    expect(queues.primary).toHaveLength(3);
    expect(queues.secondary).toHaveLength(4);
    expect(queues.clear.map((item) => item.action.key)).toEqual(['notification-failures']);
  });

  it('separates current, overdue, and 24h+ legacy records into exact linked scopes', () => {
    const [prioritized] = prioritizeStartShiftActions(
      [{
        ...action('refund-review', 20, '2026-07-16T01:00:00.000Z', 240, 8),
        ageing: { fourToTwentyFourHours: 4, oneToFourHours: 5, overTwentyFourHours: 3, underOneHour: 8 },
        nextCases: {
          current: ['current-1'],
          legacy: ['legacy-1'],
          overdue: ['overdue-1'],
        },
      }],
      now,
    );
    const queues = splitStartShiftActions([prioritized!]);

    expect(queues.current[0]).toMatchObject({
      action: {
        count: 12,
        href: '/refund-review?sla=within',
        nextCases: { current: ['current-1'], legacy: [], overdue: [] },
      },
      scope: 'current',
      status: 'Current operational',
    });
    expect(queues.overdue[0]).toMatchObject({
      action: {
        count: 5,
        href: '/refund-review?sla=overdue-under-24h',
        nextCases: { current: [], legacy: [], overdue: ['overdue-1'] },
      },
      scope: 'overdue',
      status: 'Overdue operational',
    });
    expect(queues.legacy[0]).toMatchObject({
      action: {
        count: 3,
        href: '/refund-review?sla=critical',
        nextCases: { current: [], legacy: ['legacy-1'], overdue: [] },
      },
      scope: 'legacy',
      status: 'Historical backlog (24h+)',
      tone: 'danger',
    });
    expect(startShiftActionValue(queues.legacy[0]!)).toBe('3 cases');
    expect(queues.primary.reduce((total, item) => total + item.action.count, 0)).toBe(17);
  });

  it('places an overdue Finance case ahead of an empty live queue', () => {
    const result = prioritizeStartShiftCommandItems([
      {
        lane: 'Live booking command',
        status: 'Clear',
        tone: 'ok' as const,
      },
      {
        lane: 'Payment clearing review',
        overdueCount: 146,
        status: 'SLA overdue',
        tone: 'warn' as const,
      },
    ]);

    expect(result[0]?.lane).toBe('Payment clearing review');
  });

  it('uses the globally oldest record before queue counts within the same SLA priority', () => {
    const result = prioritizeStartShiftCommandItems([
      {
        lane: 'Newer larger queue',
        oldestAt: '2026-07-19T04:30:00.000Z',
        overdueCount: 20,
        status: 'SLA overdue',
        tone: 'warn' as const,
      },
      {
        lane: 'Older smaller queue',
        oldestAt: '2026-07-19T01:00:00.000Z',
        overdueCount: 1,
        status: 'SLA overdue',
        tone: 'warn' as const,
      },
    ]);

    expect(result.map((item) => item.lane)).toEqual(['Older smaller queue', 'Newer larger queue']);
  });

  it('places a live matching block ahead of an older Finance SLA breach', () => {
    const result = prioritizeStartShiftCommandItems([
      {
        isLiveBlock: true,
        lane: 'Matching delays',
        oldestAt: '2026-07-19T04:44:00.000Z',
        overdueCount: 1,
        status: 'SLA overdue',
        tone: 'warn' as const,
      },
      {
        lane: 'Payment clearing',
        oldestAt: '2026-05-12T05:00:00.000Z',
        overdueCount: 1,
        status: 'SLA overdue',
        tone: 'warn' as const,
      },
    ]);

    expect(result.map((item) => item.lane)).toEqual(['Matching delays', 'Payment clearing']);
  });

  it('places service-blocking payment risk ahead of other overdue work', () => {
    const result = prioritizeStartShiftCommandItems([
      {
        lane: 'Bank reconciliation',
        oldestAt: '2026-05-12T05:00:00.000Z',
        overdueCount: 1,
        status: 'SLA overdue',
        tone: 'warn' as const,
      },
      {
        isServiceBlock: true,
        lane: 'Payment holds',
        oldestAt: '2026-07-19T04:30:00.000Z',
        overdueCount: 1,
        status: 'SLA overdue',
        tone: 'warn' as const,
      },
    ]);

    expect(result.map((item) => item.lane)).toEqual(['Payment holds', 'Bank reconciliation']);
  });

  it('falls back to counts and stable input order when oldest timestamps are invalid', () => {
    const result = prioritizeStartShiftCommandItems([
      { lane: 'First', oldestAt: 'invalid', overdueCount: 1, status: 'SLA overdue', tone: 'warn' as const },
      { lane: 'Second', oldestAt: null, overdueCount: 3, status: 'SLA overdue', tone: 'warn' as const },
    ]);

    expect(result.map((item) => item.lane)).toEqual(['Second', 'First']);
  });

  it('uses the SLA supplied by the API instead of the compatibility fallback', () => {
    const [result] = prioritizeStartShiftActions(
      [action('payment-holds', 1, '2026-07-19T04:30:00.000Z', 20)],
      now,
    );

    expect(result?.isSlaOverdue).toBe(true);
    expect(result?.status).toBe('SLA overdue');
  });

  it('uses the exact API overdue count for status and card value', () => {
    const [result] = prioritizeStartShiftActions(
      [action('cash-reconciliation', 59, '2026-07-19T04:59:00.000Z', 1_440, 58)],
      now,
    );

    expect(result).toMatchObject({ isSlaOverdue: true, overdueCount: 58 });
    expect(result?.tone).toBe('warn');
    expect(startShiftActionValue(result!)).toBe('58 overdue / 59 total');
  });

  it('trusts an exact zero overdue count over the oldest-record fallback', () => {
    const [result] = prioritizeStartShiftActions(
      [action('partner-approvals', 1, '2026-07-17T00:00:00.000Z', 1_440, 0)],
      now,
    );

    expect(result).toMatchObject({ isSlaOverdue: false, overdueCount: 0 });
    expect(startShiftActionValue(result!)).toBe('1 item');
  });

  it('does not classify 24h records as legacy when a longer SLA says they are current', () => {
    const [result] = prioritizeStartShiftActions(
      [
        {
          ...action('partner-approvals', 4, '2026-07-17T00:00:00.000Z', 10_080, 0),
          ageing: { fourToTwentyFourHours: 0, oneToFourHours: 0, overTwentyFourHours: 4, underOneHour: 0 },
        },
      ],
      now,
    );

    const queues = splitStartShiftActions([result!]);

    expect(queues.current[0]?.action.count).toBe(4);
    expect(queues.legacy).toEqual([]);
    expect(queues.overdue).toEqual([]);
  });

  it('splits an exact queue into mutually exclusive SLA action chips', () => {
    const [result] = prioritizeStartShiftActions(
      [
        {
          ...action('cash-reconciliation', 20, '2026-07-18T00:00:00.000Z', 60, 8),
          ageing: {
            fourToTwentyFourHours: 4,
            oneToFourHours: 5,
            overTwentyFourHours: 3,
            underOneHour: 8,
          },
        },
      ],
      now,
    );

    expect(startShiftActionAgeing(result!)).toEqual([
      {
        href: '/cash-reconciliation?sla=within',
        label: 'Within SLA 12',
        tone: 'success',
      },
      {
        href: '/cash-reconciliation?sla=overdue-under-24h',
        label: 'Overdue 5',
        tone: 'warning',
      },
      {
        href: '/cash-reconciliation?sla=critical',
        label: '24h+ critical 3',
        tone: 'danger',
      },
    ]);
  });

  it('does not duplicate critical records in the generic overdue chip', () => {
    const [result] = prioritizeStartShiftActions(
      [action('cash-reconciliation', 59, '2026-07-17T00:00:00.000Z', 1_440, 58)],
      now,
    );

    expect(startShiftActionAgeing(result!)).toEqual([
      { href: '/cash-reconciliation?sla=within', label: 'Within SLA 1', tone: 'success' },
      {
        href: '/cash-reconciliation?sla=critical',
        label: '24h+ critical 58',
        tone: 'danger',
      },
    ]);
  });

  it('keeps fixed age buckets for a rolling deployment without exact overdue counts', () => {
    const [result] = prioritizeStartShiftActions(
      [
        {
          ...action('payment-holds', 6, '2026-07-18T00:00:00.000Z'),
          ageing: {
            fourToTwentyFourHours: 3,
            oneToFourHours: 2,
            overTwentyFourHours: 1,
            underOneHour: 0,
          },
        },
      ],
      now,
    );

    expect(startShiftActionAgeing(result!)).toEqual([
      { href: '/payment-holds?age=1-4h', label: '1-4h 2', tone: 'warning' },
      { href: '/payment-holds?age=4-24h', label: '4-24h 3', tone: 'warning' },
      { href: '/payment-holds?age=over-24h', label: '24h+ 1', tone: 'danger' },
    ]);
  });

  it.each([
    ['matching-delays', '/bookings?view=matching-delays&sort=oldest'],
    ['payment-holds', '/payments?range=all&review=authorized&sort=oldest'],
    [
      'cancellation-review',
      '/bookings/post-match-cancellations?view=manual-decision&dateRange=all&sort=oldest',
    ],
    ['refund-review', '/refunds?range=all&review=open&sort=oldest'],
    ['notification-failures', '/notifications?range=all&review=unresolved-failed&sort=oldest'],
    ['cash-reconciliation', '/cash-settlements?range=all&sort=oldest'],
    ['partner-approvals', '/partners?review=approval-pending&sort=oldest'],
  ])('opens the exact overdue %s queue from Start Shift', (key, href) => {
    const [prioritized] = prioritizeStartShiftActions(
      [{ ...action(key, 2, '2026-07-19T03:00:00.000Z', 60), href }],
      now,
    );

    expect(prioritized).toBeDefined();
    expect(startShiftActionHref(prioritized!)).toBe(`${href}&sla=overdue`);
  });

  it('does not narrow a queue that is still inside its SLA', () => {
    const [prioritized] = prioritizeStartShiftActions(
      [action('matching-delays', 1, '2026-07-19T04:55:00.000Z', 15)],
      now,
    );

    expect(prioritized).toBeDefined();
    expect(startShiftActionHref(prioritized!)).toBe('/matching-delays');
  });

  it('does not add an unsupported SLA filter to future action types', () => {
    const [prioritized] = prioritizeStartShiftActions(
      [action('future-queue', 1, '2026-07-18T00:00:00.000Z', 60)],
      now,
    );

    expect(prioritized).toBeDefined();
    expect(startShiftActionHref(prioritized!)).toBe('/future-queue');
  });
});
