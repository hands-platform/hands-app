import { renderToStaticMarkup } from 'react-dom/server';

import { PartnerDetailProfileOverviewCard } from './partner-detail-profile-overview-card';

describe('PartnerDetailProfileOverviewCard', () => {
  it('uses the customer profile overview structure and exposes four editable translations', () => {
    const markup = renderToStaticMarkup(
      <PartnerDetailProfileOverviewCard
        avatarStatus="online"
        bioVietnamese="Xin chao, toi la Partner tai Ha Noi."
        facts={[
          { helper: 'Partner account', label: 'Phone', value: '+84 90 000 0000' },
          { helper: 'Operating city', label: 'City', value: 'Ha Noi' },
        ]}
        name="Nguyen An"
        partnerId="partner-1"
        statusBadges={['ACTIVE', 'KYC APPROVED']}
        subtitle="Partner ID partner-1"
        translations={{
          en: 'Hello, I am a Partner in Ha Noi.',
          ja: '',
          ko: '',
          zh: '',
        }}
      />,
    );

    expect(markup).toContain('customer-detail-overview-card partner-detail-profile-overview-card');
    expect(markup).toContain('Profile and contact');
    expect(markup).toContain('Nguyen An');
    expect(markup).toContain('Vietnamese source and app translations');
    expect(markup).toContain('name="bioVi"');
    expect(markup).toContain('disabled=""');
    expect(markup).toContain('name="bioEn"');
    expect(markup).toContain('name="bioKo"');
    expect(markup).toContain('name="bioJa"');
    expect(markup).toContain('name="bioZh"');
    expect(markup).toContain('Save translations');
    expect(markup).not.toContain('image URL');
    expect(markup).not.toContain('uploaded at');
  });
});
