import type { AdminProvider } from '../../lib/admin-api';
import { DEFAULT_PROVIDER_OPS_POLICY } from './partner-list-ops';
import { buildPartnerDailyActionQueue, partnerDetailActionHref } from './partner-daily-action-queue';
import type { ProviderListAction } from './partner-list-actions';

function partner(id: string, displayName: string): AdminProvider {
  return {
    id,
    displayName,
  } as AdminProvider;
}

function action(
  status: string,
  priority: number,
  tone: ProviderListAction['tone'] = 'blocked',
): ProviderListAction {
  return {
    status,
    priority,
    tone,
    detail: `${status} detail`,
    operatorAction: `${status} operator action`,
  };
}

describe('partner daily action queue', () => {
  it('sorts active partner actions by urgency and keeps dispatch-ready count separate', () => {
    const alpha = partner('partner-alpha', 'Alpha Partner');
    const cashDebt = partner('partner-cash', 'Cash Debt Partner');
    const clear = partner('partner-clear', 'Clear Partner');

    const queue = buildPartnerDailyActionQueue(
      [alpha, cashDebt, clear],
      DEFAULT_PROVIDER_OPS_POLICY,
      {
        displayName: (item) => item.displayName ?? item.id,
        dispatchReady: (item) => item.id === 'partner-clear',
        nextAction: (item) => {
          if (item.id === 'partner-alpha') return action('KYC', 90);
          if (item.id === 'partner-cash') return action('CASH DEBT', 85);
          return action('CLEAR', 0, 'done');
        },
      },
    );

    expect(queue.urgentCount).toBe(2);
    expect(queue.blockedCount).toBe(2);
    expect(queue.dispatchReadyCount).toBe(1);
    expect(queue.rows.map((row) => row.provider.id)).toEqual(['partner-alpha', 'partner-cash']);
    expect(queue.rows[0]).toMatchObject({
      lane: 'KYC decision',
      sla: 'Same shift',
      tone: 'danger',
      href: '/partners/partner-alpha#kyc',
    });
    expect(queue.rows[1]).toMatchObject({
      lane: 'Cash settlement',
      sla: 'Today',
      tone: 'danger',
      href: '/partners/partner-cash#payout',
      age: 'Marketplace participation is held now.',
    });
  });

  it('maps action statuses to partner detail anchors', () => {
    expect(partnerDetailActionHref(partner('partner-1', 'Partner 1'), action('LOCATION', 66))).toBe(
      '/partners/partner-1#location',
    );
    expect(partnerDetailActionHref(partner('partner-1', 'Partner 1'), action('SUPABASE', 35))).toBe(
      '/partners/partner-1#kyc',
    );
    expect(partnerDetailActionHref(partner('partner-1', 'Partner 1'), action('UNKNOWN', 1))).toBe(
      '/partners/partner-1',
    );
  });
});
