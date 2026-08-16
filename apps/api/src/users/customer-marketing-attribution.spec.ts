import {
  customerAppSessionMetadata,
  normalizeCustomerMarketingAttribution,
} from './customer-marketing-attribution';

describe('customer marketing attribution', () => {
  it('normalizes bounded paid attribution fields', () => {
    expect(
      normalizeCustomerMarketingAttribution({
        source: ' Google Ads ',
        campaignId: ' launch-hcm ',
        medium: ' cpc ',
        capturedAt: '2026-07-23T08:00:00+07:00',
      }),
    ).toEqual({
      source: 'google',
      campaignId: 'launch-hcm',
      medium: 'cpc',
      capturedAt: '2026-07-23T01:00:00.000Z',
    });
  });

  it('rejects unsupported or incomplete attribution', () => {
    expect(
      normalizeCustomerMarketingAttribution({
        source: 'untrusted-network',
        capturedAt: '2026-07-23T01:00:00.000Z',
      }),
    ).toBeNull();
    expect(normalizeCustomerMarketingAttribution({ source: 'google' })).toBeNull();
  });

  it('keeps first-touch attribution and discards unrecognized metadata keys', () => {
    expect(
      customerAppSessionMetadata(
        {
          marketingAttribution: {
            source: 'meta',
            campaignId: 'first-touch',
            capturedAt: '2026-07-20T01:00:00.000Z',
          },
          existingFlag: true,
        },
        {
          marketingAttribution: {
            source: 'tiktok',
            campaignId: 'later-touch',
            capturedAt: '2026-07-23T01:00:00.000Z',
          },
          currentFlag: true,
        },
      ),
    ).toEqual({
      marketingAttribution: {
        source: 'meta',
        campaignId: 'first-touch',
        capturedAt: '2026-07-20T01:00:00.000Z',
      },
    });
  });
});
