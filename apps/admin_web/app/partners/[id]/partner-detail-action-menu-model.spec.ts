import { describe, expect, it } from 'vitest';

import {
  buildPartnerDetailAccountActionMenuItems,
  buildPartnerDetailDeviceActionMenuItems,
  partnerDetailReviewActionConfirmHref,
} from './partner-detail-action-menu-model';

describe('partner detail action menu model', () => {
  it('keeps partner approval disabled until profile and KYC are ready', () => {
    const actions = buildPartnerDetailAccountActionMenuItems(
      {
        blocked: false,
        id: 'partner 1',
        kycStatus: 'PENDING',
        profileComplete: true,
        verificationStatus: 'PENDING',
      },
      'approval-pending',
    );

    expect(actions[0]).toMatchObject({
      disabled: true,
      label: 'Approve partner',
    });
    expect(actions[0]?.kind === 'link' ? actions[0].href : '').toContain(
      'decisionQueue=approval-pending',
    );
  });

  it('switches account and device controls to unblock actions when held', () => {
    expect(
      buildPartnerDetailAccountActionMenuItems(
        {
          blocked: true,
          id: 'partner-1',
          kycStatus: 'APPROVED',
          profileComplete: true,
          verificationStatus: 'APPROVED',
        },
        null,
      ).at(-1),
    ).toMatchObject({ label: 'Unblock account', tone: 'warning' });

    expect(
      buildPartnerDetailDeviceActionMenuItems('partner-1', {
        blocked: true,
        enabled: true,
        id: 'device-1',
      }),
    ).toEqual([
      expect.objectContaining({
        href: expect.stringContaining('deviceAction=unblock-device'),
        label: 'Unblock',
      }),
    ]);
  });

  it('keeps review confirmation inside the dossier workspace', () => {
    expect(
      partnerDetailReviewActionConfirmHref('partner 1', 'reject-bank', {
        bankAccountId: 'bank-1',
      }),
    ).toBe(
      '/partners/partner%201?section=dossier&providerId=partner+1&reviewAction=reject-bank&bankAccountId=bank-1',
    );
  });
});
