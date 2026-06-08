import { buildMatchingPlaybook } from './matching-playbook';

describe('operations policy matching playbook', () => {
  it('builds the marketplace flow from live policy display values', () => {
    const displayValues: Record<string, string> = {
      'matching.provider_response_window_minutes': '10 min',
      'matching.marketplace_partner_radius_meters': '10 km',
      'matching.marketplace_partner_invitation_limit': '50',
      'matching.marketplace_open_mode': 'Open marketplace immediately',
      'matching.preferred_accept_mode': 'Customer final confirmation',
      'wallet.negative_balance_gate': 'Block marketplace participation while negative',
      'notification.partner_alert_channel': 'In-app first',
    };

    const playbook = buildMatchingPlaybook((key) => displayValues[key] ?? `missing:${key}`);

    expect(playbook).toHaveLength(6);
    expect(playbook.map((item) => item.title)).toEqual([
      'Customer picks one first-pick partner',
      'First-pick partner response window starts',
      'Marketplace partners can participate by policy',
      'Customer sees available partner choices',
      'Wallet and control gates protect operations',
      'Matched chat and service execution',
    ]);
    expect(playbook[2].detail).toContain('50 partners inside 10 km');
    expect(playbook[4].tags[0]).toEqual({
      label: 'Block marketplace participation while negative',
      tone: 'pill-danger',
    });
    expect(JSON.stringify(playbook)).not.toContain('missing:');
  });
});
