import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';

import { ServiceActionNoticeSection } from './service-action-notice-section';

const sectionSource = readFileSync(new URL('./service-action-notice-section.tsx', import.meta.url), 'utf8');

describe('ServiceActionNoticeSection', () => {
  it('renders service action results through the shared Vuexy notice card tone', () => {
    const section = ServiceActionNoticeSection({
      notice: {
        actionHref: '/services?evidence=foot',
        actionLabel: 'Open service change evidence',
        detail: 'The service menu was saved.',
        title: 'Service saved',
        tone: 'success',
      },
    });
    const markup = renderToStaticMarkup(section);

    expect(markup).toContain('card admin-card admin-notice-card admin-notice-success admin-mb-16');
    expect(markup).toContain('Service saved');
    expect(markup).toContain('The service menu was saved.');
    expect(markup).toContain('Open service change evidence');
    expect(sectionSource).toContain('AdminNoticeCard');
    expect(sectionSource).toContain("tone={notice.tone === 'success' ? 'success' : 'danger'}");
    expect(sectionSource).not.toContain('admin-notice-card ${noticeClassName}');
    expect(sectionSource).not.toContain("const noticeClassName = isSuccess ? 'admin-notice-success' : 'admin-notice-danger'");
  });
});
