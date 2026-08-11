import type { AdminStartShiftAnalytics } from '../lib/admin-api';

type StartShiftNeedsAction = AdminStartShiftAnalytics['needsAction'][number];

type StartShiftActionCategory = 'approval' | 'customer' | 'money' | 'support';

type StartShiftActionPolicy = {
  readonly category: StartShiftActionCategory;
  readonly order: number;
  readonly slaMinutes: number;
};

export type PrioritizedStartShiftAction = {
  readonly action: StartShiftNeedsAction;
  readonly category: StartShiftActionCategory;
  readonly isOpen: boolean;
  readonly isSlaOverdue: boolean;
  readonly overdueCount: number | null;
  readonly scope: 'all' | 'current' | 'legacy' | 'overdue';
  readonly status: string;
  readonly tone: 'danger' | 'info' | 'ok' | 'warn';
};

export type StartShiftActionAgeingChip = {
  readonly href?: string;
  readonly label: string;
  readonly tone: 'danger' | 'info' | 'success' | 'warning';
};

type StartShiftCommandPrioritySignals = {
  readonly impactAmount?: number;
  readonly isLiveBlock?: boolean;
  readonly mineCount?: number;
  readonly oldestAt?: string | null;
  readonly overdueCount?: number;
  readonly status: string;
  readonly tone: 'danger' | 'info' | 'ok' | 'warn';
  readonly unassignedCount?: number;
};

const START_SHIFT_ACTION_POLICIES: Readonly<Record<string, StartShiftActionPolicy>> = {
  'matching-delays': { category: 'customer', order: 0, slaMinutes: 15 },
  'payment-holds': { category: 'money', order: 1, slaMinutes: 60 },
  'cancellation-review': { category: 'customer', order: 2, slaMinutes: 120 },
  'refund-review': { category: 'money', order: 3, slaMinutes: 240 },
  'notification-failures': { category: 'support', order: 4, slaMinutes: 60 },
  'cash-reconciliation': { category: 'money', order: 5, slaMinutes: 1_440 },
  'partner-approvals': { category: 'approval', order: 6, slaMinutes: 1_440 },
};

const DEFAULT_ACTION_POLICY: StartShiftActionPolicy = {
  category: 'support',
  order: Number.MAX_SAFE_INTEGER,
  slaMinutes: 240,
};

const CATEGORY_PRIORITY: Readonly<Record<StartShiftActionCategory, number>> = {
  money: 0,
  customer: 1,
  support: 2,
  approval: 3,
};

const SLA_FILTERED_ACTION_KEYS = new Set([
  'matching-delays',
  'payment-holds',
  'cancellation-review',
  'refund-review',
  'notification-failures',
  'cash-reconciliation',
  'partner-approvals',
]);

export function prioritizeStartShiftActions(
  actions: readonly StartShiftNeedsAction[],
  nowMs = Date.now(),
): PrioritizedStartShiftAction[] {
  return actions
    .map((action) => prioritizeStartShiftAction(action, nowMs))
    .sort(compareStartShiftActions);
}

export function prioritizeStartShiftCommandItems<T extends StartShiftCommandPrioritySignals>(
  items: readonly T[],
): T[] {
  return items
    .map((item, index) => ({ index, item }))
    .sort((left, right) => {
      const priorityDifference = commandItemPriority(left.item) - commandItemPriority(right.item);
      if (priorityDifference !== 0) return priorityDifference;
      const oldestDifference = commandItemOldestMs(left.item) - commandItemOldestMs(right.item);
      if (Number.isFinite(oldestDifference) && oldestDifference !== 0) return oldestDifference;
      const overdueDifference = (right.item.overdueCount ?? 0) - (left.item.overdueCount ?? 0);
      if (overdueDifference !== 0) return overdueDifference;
      const unassignedDifference = (right.item.unassignedCount ?? 0) - (left.item.unassignedCount ?? 0);
      return unassignedDifference || left.index - right.index;
    })
    .map(({ item }) => item);
}

function commandItemOldestMs(item: StartShiftCommandPrioritySignals) {
  const parsed = item.oldestAt ? Date.parse(item.oldestAt) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function splitStartShiftActions(
  actions: readonly PrioritizedStartShiftAction[],
  primaryLimit = 3,
) {
  const current: PrioritizedStartShiftAction[] = [];
  const overdue: PrioritizedStartShiftAction[] = [];
  const legacy: PrioritizedStartShiftAction[] = [];

  for (const item of actions.filter((candidate) => candidate.isOpen)) {
    const counts = startShiftActionScopeCounts(item);
    if (counts.current > 0) current.push(scopedStartShiftAction(item, 'current', counts.current));
    if (counts.overdue > 0) overdue.push(scopedStartShiftAction(item, 'overdue', counts.overdue));
    if (counts.legacy > 0) legacy.push(scopedStartShiftAction(item, 'legacy', counts.legacy));
  }

  const operational = [...overdue, ...current];
  return {
    clear: actions.filter((item) => !item.isOpen),
    current,
    legacy,
    overdue,
    primary: operational.slice(0, primaryLimit),
    secondary: operational.slice(primaryLimit),
  };
}

export function startShiftActionHref(item: PrioritizedStartShiftAction) {
  if (item.scope !== 'all') return item.action.href;
  if (!item.isSlaOverdue || !SLA_FILTERED_ACTION_KEYS.has(item.action.key)) {
    return item.action.href;
  }

  const href = new URL(item.action.href, 'http://hands-admin.local');
  href.searchParams.set('sla', 'overdue');
  return `${href.pathname}${href.search}${href.hash}`;
}

export function startShiftActionValue(item: PrioritizedStartShiftAction) {
  if (item.scope !== 'all') {
    return `${item.action.count} ${item.action.count === 1 ? 'case' : 'cases'}`;
  }
  if (item.isSlaOverdue && item.overdueCount !== null) {
    return `${item.overdueCount} overdue / ${item.action.count} total`;
  }
  return `${item.action.count} item${item.action.count === 1 ? '' : 's'}`;
}

export function startShiftActionAgeing(
  item: PrioritizedStartShiftAction,
): StartShiftActionAgeingChip[] {
  if (item.scope !== 'all') return [];
  if (item.overdueCount !== null) {
    const criticalCount = Math.min(
      item.action.ageing.overTwentyFourHours,
      item.overdueCount,
    );
    const overdueCount = item.overdueCount - criticalCount;
    const withinSlaCount = item.action.count - item.overdueCount;

    return [
      {
        count: withinSlaCount,
        label: 'Within SLA',
        sla: 'within',
        tone: 'success' as const,
      },
      {
        count: overdueCount,
        label: 'Overdue',
        sla: 'overdue-under-24h',
        tone: 'warning' as const,
      },
      {
        count: criticalCount,
        label: '24h+ critical',
        sla: 'critical',
        tone: 'danger' as const,
      },
    ]
      .filter((bucket) => bucket.count > 0)
      .map((bucket) => ({
        href: startShiftActionFilterHref(item, { sla: bucket.sla }),
        label: `${bucket.label} ${bucket.count}`,
        tone: bucket.tone,
      }));
  }

  const ageing = item.action.ageing;
  return [
    { age: 'under-1h', count: ageing.underOneHour, label: '0-1h', tone: 'info' as const },
    { age: '1-4h', count: ageing.oneToFourHours, label: '1-4h', tone: 'warning' as const },
    { age: '4-24h', count: ageing.fourToTwentyFourHours, label: '4-24h', tone: 'warning' as const },
    { age: 'over-24h', count: ageing.overTwentyFourHours, label: '24h+', tone: 'danger' as const },
  ]
    .filter((bucket) => bucket.count > 0)
    .map((bucket) => ({
      href: startShiftActionFilterHref(item, { age: bucket.age }),
      label: `${bucket.label} ${bucket.count}`,
      tone: bucket.tone,
    }));
}

function startShiftActionFilterHref(
  item: PrioritizedStartShiftAction,
  filter: { readonly age?: string; readonly sla?: string },
) {
  if (filter.sla && !SLA_FILTERED_ACTION_KEYS.has(item.action.key)) return undefined;
  const href = new URL(item.action.href, 'http://hands-admin.local');
  if (filter.age) href.searchParams.set('age', filter.age);
  if (filter.sla) href.searchParams.set('sla', filter.sla);
  return `${href.pathname}${href.search}${href.hash}`;
}

function prioritizeStartShiftAction(
  action: StartShiftNeedsAction,
  nowMs: number,
): PrioritizedStartShiftAction {
  const policy = START_SHIFT_ACTION_POLICIES[action.key] ?? DEFAULT_ACTION_POLICY;
  const slaMinutes = action.slaMinutes > 0 ? action.slaMinutes : policy.slaMinutes;
  const oldestMs = action.oldestAt ? Date.parse(action.oldestAt) : Number.NaN;
  const isOpen = action.count > 0;
  const overdueCount = normalizeOverdueCount(action.overdueCount, action.count);
  const isSlaOverdue =
    isOpen &&
    (overdueCount !== null
      ? overdueCount > 0
      : Number.isFinite(oldestMs) && nowMs - oldestMs >= slaMinutes * 60_000);

  return {
    action,
    category: policy.category,
    isOpen,
    isSlaOverdue,
    overdueCount,
    scope: 'all',
    status: startShiftActionStatus(policy.category, isOpen, isSlaOverdue),
    tone: startShiftActionTone(policy.category, isOpen, isSlaOverdue),
  };
}

function startShiftActionScopeCounts(item: PrioritizedStartShiftAction) {
  const total = item.action.count;
  const legacy = item.overdueCount !== null
    ? Math.min(total, item.action.ageing.overTwentyFourHours, item.overdueCount)
    : Math.min(total, item.action.ageing.overTwentyFourHours);
  if (item.overdueCount !== null) {
    const overdue = Math.max(0, item.overdueCount - legacy);
    return { current: Math.max(0, total - legacy - overdue), legacy, overdue };
  }

  const overdue = Math.min(
    Math.max(0, total - legacy),
    item.action.ageing.oneToFourHours + item.action.ageing.fourToTwentyFourHours,
  );
  return { current: Math.max(0, total - legacy - overdue), legacy, overdue };
}

function scopedStartShiftAction(
  item: PrioritizedStartShiftAction,
  scope: 'current' | 'legacy' | 'overdue',
  count: number,
): PrioritizedStartShiftAction {
  const href = startShiftActionFilterHref(item, {
    sla: scope === 'current' ? 'within' : scope === 'overdue' ? 'overdue-under-24h' : 'critical',
  });
  const keepsOldest = scope === 'legacy'
    || (scope === 'overdue' && item.action.ageing.overTwentyFourHours === 0)
    || (scope === 'current' && !item.isSlaOverdue);

  return {
    ...item,
    action: {
      ...item.action,
      ageing: { fourToTwentyFourHours: 0, oneToFourHours: 0, overTwentyFourHours: 0, underOneHour: 0 },
      amount: count === item.action.count ? item.action.amount : 0,
      count,
      href: href ?? item.action.href,
      nextCases: item.action.nextCases
        ? {
            current: scope === 'current' ? item.action.nextCases.current : [],
            legacy: scope === 'legacy' ? item.action.nextCases.legacy : [],
            overdue: scope === 'overdue' ? item.action.nextCases.overdue : [],
          }
        : undefined,
      oldestAt: keepsOldest ? item.action.oldestAt : null,
      overdueCount: scope === 'current' ? 0 : count,
    },
    isSlaOverdue: scope !== 'current',
    overdueCount: scope === 'current' ? 0 : count,
    scope,
    status:
      scope === 'current'
        ? 'Current operational'
        : scope === 'overdue'
          ? 'Overdue operational'
          : 'Historical backlog (24h+)',
    tone:
      scope === 'legacy'
        ? item.category === 'money'
          ? 'danger'
          : item.tone === 'ok'
            ? 'info'
            : item.tone
        : scope === 'overdue'
          ? 'warn'
          : item.tone,
  };
}

function commandItemPriority(item: StartShiftCommandPrioritySignals) {
  const status = item.status.toLowerCase();
  if (status.includes('unavailable') || status.includes('failed')) return 0;
  if ((item.overdueCount ?? 0) > 0 || status.includes('sla overdue')) return 1;
  if ((item.unassignedCount ?? 0) > 0 || status.includes('needs owner')) return 2;
  if ((item.mineCount ?? 0) > 0 || status.includes('my queue')) return 3;
  if (item.isLiveBlock || item.tone === 'danger') return 4;
  if ((item.impactAmount ?? 0) > 0) return 5;
  if (item.tone === 'warn') return 6;
  return 7;
}

function normalizeOverdueCount(value: number | undefined, totalCount: number) {
  if (!Number.isFinite(value) || value === undefined) return null;
  return Math.min(Math.max(0, Math.trunc(value)), Math.max(0, totalCount));
}

function compareStartShiftActions(
  left: PrioritizedStartShiftAction,
  right: PrioritizedStartShiftAction,
) {
  if (left.isOpen !== right.isOpen) return left.isOpen ? -1 : 1;
  if (left.isSlaOverdue !== right.isSlaOverdue) return left.isSlaOverdue ? -1 : 1;

  if (left.isSlaOverdue && right.isSlaOverdue) {
    const oldestDifference = actionOldestMs(left.action) - actionOldestMs(right.action);
    if (oldestDifference !== 0) return oldestDifference;
  }

  const categoryDifference = CATEGORY_PRIORITY[left.category] - CATEGORY_PRIORITY[right.category];
  if (categoryDifference !== 0) return categoryDifference;

  return actionPolicy(left.action.key).order - actionPolicy(right.action.key).order;
}

function actionOldestMs(action: StartShiftNeedsAction) {
  const parsed = action.oldestAt ? Date.parse(action.oldestAt) : Number.POSITIVE_INFINITY;
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

function actionPolicy(key: string) {
  return START_SHIFT_ACTION_POLICIES[key] ?? DEFAULT_ACTION_POLICY;
}

function startShiftActionStatus(
  category: StartShiftActionCategory,
  isOpen: boolean,
  isSlaOverdue: boolean,
) {
  if (!isOpen) return 'Clear';
  if (isSlaOverdue) return 'SLA overdue';
  if (category === 'money') return 'Money risk';
  if (category === 'customer') return 'Customer waiting';
  if (category === 'approval') return 'Approval waiting';
  return 'Delivery review';
}

function startShiftActionTone(
  category: StartShiftActionCategory,
  isOpen: boolean,
  isSlaOverdue: boolean,
) {
  if (!isOpen) return 'ok' as const;
  if (isSlaOverdue) return 'warn' as const;
  if (category === 'approval') return 'info' as const;
  return 'warn' as const;
}
