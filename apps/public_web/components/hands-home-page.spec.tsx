import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  getCustomerStoryOffset,
  normalizeCustomerStoryOffset,
} from './customer-stories-section';
import { getFeatureRailOffset } from './home-editorial-sections';
import { HandsHomePage } from './hands-home-page';
import { HandsSiteFooter, HandsSiteHeader } from './hands-site-chrome';
import { PartnerRecruitmentPage } from './partner-recruitment-page';

describe('HandsHomePage', () => {
  it('keeps the Korean navigation and renders the Creative Wellness clone', () => {
    const html = renderToStaticMarkup(<HandsHomePage />);

    expect(html).toContain('HANDS 마사지 테라피스트');
    expect(html).toContain('새로운 소식');
    expect(html).toContain('마사지 테라피스트 지원');
    expect(html).toContain('Elite Personal');
    expect(html).toContain('Stronger Together');
    expect(html).toContain('Real human connection drives real results');
    expect(html).toContain('hero-video-card');
    expect(html).toContain('how-showcase');
    expect(html).toContain('customer-stories-section');
    expect(html).toContain('Testimonials');
    expect(html).toContain('Built on the idea that human-to-human');
    expect(html).toContain('The right investment');
    expect(html).toContain('Expert coaching made for your real-world lifestyle');
    expect(html).not.toContain('home-final-cta');
    expect(html).not.toContain('id="download"');
  });

  it('renders Japanese navigation and launch copy', () => {
    const html = renderToStaticMarkup(<HandsHomePage locale="ja" />);

    expect(html).toContain('HANDSパートナー');
    expect(html).toContain('今いる場所が');
    expect(html).toContain('会社紹介');
  });

  it('uses the compact interview video card on partner recruitment', () => {
    const html = renderToStaticMarkup(<PartnerRecruitmentPage />);

    expect(html).toContain('recruitment-hero-video');
    expect(html).toContain('/images/recruitment/partner-interview.png');
    expect(html).toContain('Câu chuyện từ đối tác HANDS');
  });

  it('keeps compact navigation and renders the HANDS footer menu', () => {
    const header = renderToStaticMarkup(<HandsSiteHeader locale="ko" />);
    const footer = renderToStaticMarkup(<HandsSiteFooter locale="ko" />);

    expect(header).toContain('mobile-nav');
    expect(header).not.toContain('href="/ko/#how"');
    expect(header).not.toContain('href="/ko/safety"');
    expect(footer).toContain('Wellness, wherever you are.');
    expect(footer).toContain('회사 소개');
    expect(footer).toContain('신고 및 분쟁 처리');
    expect(footer).toContain('파트너 운영정책');
    expect(footer).toContain('사업자 정보');
    expect(footer).toContain('href="/ko/legal/privacy"');
    expect(footer).not.toContain('대표: 정보 등록 예정');
    expect(footer).toContain('© 2026 HANDS');
  });

  it('moves the two customer-story rows in opposite directions with page scroll', () => {
    expect(getCustomerStoryOffset(300, 1734, 0)).toBeCloseTo(-97.8);
    expect(getCustomerStoryOffset(300, 1734, 1)).toBeCloseTo(-1636.2);
    expect(normalizeCustomerStoryOffset(120, 1000)).toBe(-880);
  });

  it('clamps the sticky feature rail to its measured track width', () => {
    expect(getFeatureRailOffset(100, 200, 1000, 2100)).toBe(0);
    expect(getFeatureRailOffset(700, 200, 1000, 2100)).toBe(-1050);
    expect(getFeatureRailOffset(2000, 200, 1000, 2100)).toBe(-2100);
  });
});
