import {
  buildPartnerProfileOverviewFacts,
  buildPartnerPublicMediaRows,
  buildPartnerTypedDocumentRows,
  partnerProfileAvatarStatus,
  readPartnerProfileTranslations,
} from './partner-detail-profile-media-model';
import type { ProviderDetail } from './partner-detail-types';

function providerFixture(overrides: Partial<ProviderDetail> = {}): ProviderDetail {
  return overrides as ProviderDetail;
}

describe('partner detail profile and media model', () => {
  it('maps typed KYC documents to compact review rows', () => {
    const rows = buildPartnerTypedDocumentRows(
      providerFixture({
        documents: [
          {
            fileAsset: {
              contentType: 'image/jpeg',
              id: 'file-front',
              key: 'kyc/front.jpg',
            },
            id: 'document-front',
            status: 'APPROVED',
            type: 'CCCD_FRONT',
          },
          {
            id: 'document-back',
            rejectionReason: 'Image is blurred',
            status: 'REJECTED',
            type: 'CCCD_BACK',
          },
        ],
      }),
    );

    expect(rows).toMatchObject([
      {
        fileHref: '/files/file-front/open',
        previewable: true,
        statusTone: 'pill-success',
      },
      {
        fileHref: undefined,
        rejectionReason: 'Image is blurred',
        statusTone: 'pill-danger',
      },
    ]);
  });

  it('normalizes profile facts, translations, and operational avatar state', () => {
    const provider = providerFixture({
      city: 'Da Nang',
      experienceYears: 4,
      languages: ['vi', 'en'],
      legalName: 'Tran Linh',
      residentialAddress: 'Hai Chau',
      serviceStyle: 'Calm',
      specialties: ['Aroma', 'Thai'],
      user: { phone: '+84000000001' },
    });

    expect(buildPartnerProfileOverviewFacts(provider)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Legal name', value: 'Tran Linh' }),
        expect.objectContaining({ label: 'Experience', value: '4 year(s)' }),
        expect.objectContaining({ label: 'Service city', value: 'Da Nang' }),
      ]),
    );
    expect(readPartnerProfileTranslations({ en: 'English', ko: 'Korean', vi: 'Ignored' })).toEqual({
      en: 'English',
      ja: '',
      ko: 'Korean',
      zh: '',
    });
    expect(partnerProfileAvatarStatus('IN_SERVICE')).toBe('working');
    expect(partnerProfileAvatarStatus('MATCHED')).toBe('matching');
    expect(partnerProfileAvatarStatus('ONLINE')).toBe('online');
    expect(partnerProfileAvatarStatus('OFFLINE')).toBe('offline');
  });

  it('preserves public media review actions and status tones', () => {
    const rows = buildPartnerPublicMediaRows(
      providerFixture({
        id: 'partner-1',
        user: {
          fileAssets: [
            {
              contentType: 'image/jpeg',
              id: 'public-file-1',
              key: 'public/public-file-1.jpg',
              purpose: 'PROVIDER_PROFILE',
              reviewStatus: 'PENDING_REVIEW',
              url: '/files/public-file-1/open',
              visibility: 'PUBLIC',
            },
          ],
        },
      }),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      fileHref: '/files/public-file-1/open',
      previewable: true,
      reviewStatus: 'PENDING_REVIEW',
      reviewStatusTone: 'pill-warn',
    });
    expect(rows[0]?.reviewActions.map(actionHref)).toEqual([
      expect.stringContaining('reviewAction=approve-media'),
      expect.stringContaining('reviewAction=reject-media'),
    ]);
    expect(rows[0]?.reviewActions.map(actionHref)).toEqual([
      expect.stringContaining('fileId=public-file-1'),
      expect.stringContaining('fileId=public-file-1'),
    ]);
  });
});

function actionHref(action: { readonly kind: string; readonly href?: string }) {
  return action.kind === 'link' ? action.href : undefined;
}
