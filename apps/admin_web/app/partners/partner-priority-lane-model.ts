import type { AdminProvider } from '../../lib/admin-api';
import { partnerDetailActionHref } from './partner-daily-action-queue';
import {
  nextPartnerListAction,
  type ProviderListAction,
} from './partner-list-actions';
import type { ProviderOpsPolicy } from './partner-list-ops';
import type { PartnerChecklistLaneSectionItem } from './partner-checklist-lane-section';

export type PartnerPriorityLaneItem = {
  readonly action: ProviderListAction;
  readonly provider: AdminProvider;
};

export type PartnerPriorityLane = {
  readonly blockedCount: number;
  readonly items: readonly PartnerPriorityLaneItem[];
};

type PartnerPriorityLaneDeps = {
  readonly displayName: (provider: AdminProvider) => string;
  readonly nextAction?: (provider: AdminProvider, opsPolicy: ProviderOpsPolicy) => ProviderListAction;
};

type PartnerChecklistLaneItemDeps = {
  readonly displayName: (provider: AdminProvider) => string;
};

export function buildPartnerPriorityLane(
  providers: readonly AdminProvider[],
  opsPolicy: ProviderOpsPolicy,
  deps: PartnerPriorityLaneDeps,
): PartnerPriorityLane {
  const nextAction = deps.nextAction ?? nextPartnerListAction;
  const ordered = providers
    .map((provider) => ({ provider, action: nextAction(provider, opsPolicy) }))
    .filter((item) => item.action.tone !== 'done')
    .sort((left, right) => {
      if (left.action.priority !== right.action.priority) {
        return right.action.priority - left.action.priority;
      }
      return deps.displayName(left.provider).localeCompare(deps.displayName(right.provider));
    });

  return {
    blockedCount: ordered.filter((item) => item.action.tone === 'blocked').length,
    items: ordered.slice(0, 6),
  };
}

export function buildPartnerChecklistLaneItems(
  items: readonly PartnerPriorityLaneItem[],
  deps: PartnerChecklistLaneItemDeps,
): PartnerChecklistLaneSectionItem[] {
  return items.map((item) => ({
    actionDetail: item.action.detail,
    actionStatus: item.action.status,
    actionTone: item.action.tone,
    href: partnerDetailActionHref(item.provider, item.action),
    operatorAction: item.action.operatorAction,
    partnerId: item.provider.id,
    partnerName: deps.displayName(item.provider),
  }));
}
