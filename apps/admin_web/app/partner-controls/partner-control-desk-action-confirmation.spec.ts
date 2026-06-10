import type { AdminProviderSanction } from '../../lib/admin-api';
import {
  buildPartnerControlDeskActionConfirmation,
  partnerControlDeskActionConfirmHref,
  partnerControlDeskCancelHref,
  readPartnerControlDeskConfirmationAction,
} from './partner-control-desk-action-confirmation';

const sanctions = [
  {
    id: 'sanction-123456',
    providerProfileId: 'partner-123456',
    reason: 'Outstanding payout evidence',
    startsAt: '2026-06-01T00:00:00.000Z',
    status: 'ACTIVE',
    type: 'PAYOUT_HOLD',
    providerProfile: {
      id: 'partner-123456',
      displayName: 'Linh Wellness',
      user: { phone: '+84900000000' },
    },
  },
  {
    id: 'lifted-sanction-123456',
    providerProfileId: 'partner-123456',
    reason: 'Resolved warning',
    startsAt: '2026-06-02T00:00:00.000Z',
    status: 'LIFTED',
    type: 'WARNING',
  },
] as readonly AdminProviderSanction[];

describe('partner control desk action confirmation', () => {
  it('builds a lift confirmation for an active account control', () => {
    const confirmation = buildPartnerControlDeskActionConfirmation(
      sanctions,
      'lift-control',
      'sanction-123456',
      { q: 'linh', sanction: 'ACTIVE' },
    );

    expect(confirmation).toEqual({
      action: 'lift-control',
      cancelHref: '/partner-controls?q=linh&sanction=ACTIVE',
      confirmLabel: 'Lift control',
      description:
        'Lift PAYOUT_HOLD control sanction for Partner Linh Wellness after the issue is resolved.',
      disabled: false,
      hiddenInputs: [
        { name: 'providerProfileId', value: 'partner-123456' },
        { name: 'sanctionId', value: 'sanction-123456' },
      ],
      sanctionId: 'sanction-123456',
      title: 'Lift control sanction?',
      tone: 'warning',
    });
  });

  it('disables lift confirmation for closed controls', () => {
    const confirmation = buildPartnerControlDeskActionConfirmation(
      sanctions,
      'lift-control',
      'lifted-sanction-123456',
    );

    expect(confirmation?.description).toBe('Control is already lifted.');
    expect(confirmation?.disabled).toBe(true);
    expect(confirmation?.tone).toBe('neutral');
  });

  it('returns null for unsupported actions or unloaded controls', () => {
    expect(buildPartnerControlDeskActionConfirmation(sanctions, null, 'sanction-123456')).toBeNull();
    expect(buildPartnerControlDeskActionConfirmation(sanctions, 'lift-control', 'missing')).toBeNull();
  });

  it('reads actions and preserves filter state in URLs', () => {
    expect(readPartnerControlDeskConfirmationAction('lift-control')).toBe('lift-control');
    expect(readPartnerControlDeskConfirmationAction('delete-control')).toBeNull();
    expect(
      partnerControlDeskActionConfirmHref({
        q: 'partner 1',
        sanction: 'ACTIVE',
        sanctionId: 'sanction 1',
        severity: 'HIGH',
        status: 'OPEN',
      }),
    ).toBe(
      '/partner-controls?controlAction=lift-control&sanctionId=sanction+1&q=partner+1&status=OPEN&severity=HIGH&sanction=ACTIVE',
    );
    expect(partnerControlDeskCancelHref({ q: 'partner 1', status: 'OPEN' })).toBe(
      '/partner-controls?q=partner+1&status=OPEN',
    );
  });
});
