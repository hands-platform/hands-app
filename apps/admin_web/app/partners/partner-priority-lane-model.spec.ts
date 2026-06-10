import type { AdminProvider } from '../../lib/admin-api';
import { DEFAULT_PROVIDER_OPS_POLICY } from './partner-list-ops';
import type { ProviderListAction } from './partner-list-actions';
import {
  buildPartnerChecklistLaneItems,
  buildPartnerPriorityLane,
} from './partner-priority-lane-model';

function partner(id: string, displayName: string): AdminProvider {
  return {
    displayName,
    id,
  } as AdminProvider;
}

function action(
  status: string,
  priority: number,
  tone: ProviderListAction['tone'] = 'blocked',
): ProviderListAction {
  return {
    detail: `${status} detail`,
    operatorAction: `${status} operator action`,
    priority,
    status,
    tone,
  };
}

describe('partner priority lane model', () => {
  it('orders visible partner actions by priority and display name while excluding clear actions', () => {
    const providers = [
      partner('partner-clear', 'Clear Partner'),
      partner('partner-z', 'Zeta Partner'),
      partner('partner-a', 'Alpha Partner'),
      partner('partner-low', 'Low Partner'),
    ];

    const lane = buildPartnerPriorityLane(providers, DEFAULT_PROVIDER_OPS_POLICY, {
      displayName: (provider) => provider.displayName ?? provider.id,
      nextAction: (provider) => {
        if (provider.id === 'partner-clear') return action('CLEAR', 0, 'done');
        if (provider.id === 'partner-low') return action('PUSH', 54, 'pending');
        return action('KYC', 90);
      },
    });

    expect(lane.blockedCount).toBe(2);
    expect(lane.items.map((item) => item.provider.id)).toEqual([
      'partner-a',
      'partner-z',
      'partner-low',
    ]);
  });

  it('limits the lane to six items after sorting', () => {
    const providers = Array.from({ length: 8 }, (_, index) =>
      partner(`partner-${index}`, `Partner ${index}`),
    );

    const lane = buildPartnerPriorityLane(providers, DEFAULT_PROVIDER_OPS_POLICY, {
      displayName: (provider) => provider.displayName ?? provider.id,
      nextAction: () => action('PROFILE', 100),
    });

    expect(lane.items).toHaveLength(6);
    expect(lane.blockedCount).toBe(8);
  });

  it('maps lane rows to checklist section items with partner detail action links', () => {
    const provider = partner('partner-cash', 'Cash Partner');
    const items = buildPartnerChecklistLaneItems([
      {
        action: action('CASH DEBT', 85),
        provider,
      },
    ], {
      displayName: (item) => item.displayName ?? item.id,
    });

    expect(items).toEqual([
      {
        actionDetail: 'CASH DEBT detail',
        actionStatus: 'CASH DEBT',
        actionTone: 'blocked',
        href: '/partners/partner-cash#payout',
        operatorAction: 'CASH DEBT operator action',
        partnerId: 'partner-cash',
        partnerName: 'Cash Partner',
      },
    ]);
  });
});
