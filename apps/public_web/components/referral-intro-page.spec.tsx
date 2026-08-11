import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ReferralIntroPage } from './referral-intro-page';

describe('ReferralIntroPage', () => {
  it('explains both referral paths in supported locales', () => {
    const korean = renderToStaticMarkup(<ReferralIntroPage locale="ko" />);
    const vietnamese = renderToStaticMarkup(<ReferralIntroPage locale="vi" />);

    expect(korean).toContain('고객 추천');
    expect(korean).toContain('마사지 테라피스트 추천');
    expect(vietnamese).toContain('Giới thiệu khách hàng');
    expect(vietnamese).toContain('Giới thiệu đối tác massage');
  });
});
