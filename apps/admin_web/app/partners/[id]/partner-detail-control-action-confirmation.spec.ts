import type { AdminProvider } from '../../../lib/admin-api';
import {
  buildPartnerControlActionConfirmation,
  partnerControlActionConfirmHref,
  readPartnerControlConfirmationAction,
} from './partner-detail-control-action-confirmation';

const partner = {
  id: 'partner-detail-123456',
  displayName: 'Linh Wellness',
  sanctions: [
    {
      id: 'sanction-123456',
      providerProfileId: 'partner-detail-123456',
      type: 'PAYOUT_HOLD',
      status: 'ACTIVE',
      reason: 'Outstanding cash settlement',
      startsAt: '2026-06-01T00:00:00.000Z',
    },
    {
      id: 'lifted-sanction-123456',
      providerProfileId: 'partner-detail-123456',
      type: 'WARNING',
      status: 'LIFTED',
      reason: 'Resolved profile issue',
      startsAt: '2026-06-02T00:00:00.000Z',
    },
  ],
} as AdminProvider;

describe('partner detail control action confirmation', () => {
  it('builds a lift control confirmation for an active account control', () => {
    const confirmation = buildPartnerControlActionConfirmation(partner, 'lift-control', 'sanction-123456');

    expect(confirmation).toEqual({
      action: 'lift-control',
      cancelHref: '/partners/partner-detail-123456?section=access&access=controls#partner-reports-controls',
      confirmLabel: 'Lift control',
      description:
        'Lift PAYOUT_HOLD control sanction for Partner Linh Wellness after the report or control issue is resolved.',
      disabled: false,
      hiddenInputs: [
        { name: 'providerProfileId', value: partner.id },
        { name: 'sanctionId', value: 'sanction-123456' },
      ],
      providerId: partner.id,
      sanctionId: 'sanction-123456',
      title: 'Lift control for Linh Wellness?',
      tone: 'warning',
    });
  });

  it('disables confirmation when the control is already lifted', () => {
    const confirmation = buildPartnerControlActionConfirmation(partner, 'lift-control', 'lifted-sanction-123456');

    expect(confirmation?.description).toBe('Control is already lifted.');
    expect(confirmation?.disabled).toBe(true);
    expect(confirmation?.tone).toBe('neutral');
  });

  it('returns null for unsupported actions or missing controls', () => {
    expect(buildPartnerControlActionConfirmation(partner, null, 'sanction-123456')).toBeNull();
    expect(buildPartnerControlActionConfirmation(partner, 'lift-control', 'missing')).toBeNull();
  });

  it('reads supported actions and encodes confirmation URLs', () => {
    expect(readPartnerControlConfirmationAction('lift-control')).toBe('lift-control');
    expect(readPartnerControlConfirmationAction('delete-control')).toBeNull();
    expect(partnerControlActionConfirmHref('partner 1', 'sanction 1')).toBe(
      '/partners/partner%201?controlAction=lift-control&sanctionId=sanction+1&access=controls&section=access#partner-reports-controls',
    );
  });
});
