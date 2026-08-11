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
      cancelHref: '/partner-controls?details=sanctions&q=linh',
      confirmLabel: 'Lift control',
      description:
        'Lift PAYOUT_HOLD control sanction for Partner Linh Wellness after the issue is resolved.',
      disabled: false,
      hiddenInputs: [
        { name: 'providerProfileId', value: 'partner-123456' },
        { name: 'sanctionId', value: 'sanction-123456' },
      ],
      sanctionId: 'sanction-123456',
      textInputs: [
        {
          label: 'Lift reason and evidence',
          maxLength: 500,
          minLength: 12,
          name: 'reason',
          placeholder: 'State what was resolved and which evidence was verified',
          required: true,
        },
      ],
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
    expect(confirmation?.textInputs).toEqual([]);
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
      '/partner-controls?details=sanctions&q=partner+1&controlAction=lift-control&sanctionId=sanction+1',
    );
    expect(partnerControlDeskCancelHref({ q: 'partner 1', status: 'OPEN' })).toBe(
      '/partner-controls?details=reports&q=partner+1&status=OPEN',
    );
  });
});
