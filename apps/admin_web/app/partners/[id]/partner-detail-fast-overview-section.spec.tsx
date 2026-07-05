import { PartnerDetailFastOverviewSection } from './partner-detail-fast-overview-section';
import { readFileSync } from 'node:fs';

import { DateTimeText } from '../../../components/date-time-text';

describe('PartnerDetailFastOverviewSection', () => {
  it('renders the fast overview with Vuexy KPI cards and shared admin panels', () => {
    const section = PartnerDetailFastOverviewSection({
      accountControlsHref: '/partners/partner-1?section=account-controls',
      bookingCommandRows: [{ label: 'Latest booking', value: 'Completed today' }],
      fullHref: '/partners/partner-1?section=full',
      identityRows: [
        { label: 'KYC', value: 'Approved' },
        { label: 'Joined', valueNode: <DateTimeText value="2026-06-01T00:00:00.000Z" /> },
      ],
      nextOperatorActionLinks: [{ href: '#kyc', label: 'Review KYC' }],
      nextOperatorActionNotes: ['Check today readiness before approving new work.'],
      overviewCards: [
        {
          detail: 'Can receive marketplace jobs.',
          href: '#booking-gates',
          label: 'Marketplace',
          tone: 'pill-success',
          value: 'Ready',
        },
        {
          detail: 'Wallet is clear.',
          href: '#wallet',
          label: 'Finance',
          tone: 'pill-success',
          value: 'Clear',
        },
      ],
      partnerName: 'Partner One',
      payoutReadinessRows: [{ label: 'Bank', value: 'Verified' }],
      subtitle: 'Marketplace ready',
    });

    const classNames = classNamesIn(section);

    expect(classNames).toContain('toolbar admin-page-header');
    expect(normalizedText(section)).toContain('Partner One');
    expect(normalizedText(section)).toContain('Marketplace ready');
    expect(normalizedText(section)).toContain('Joined : 1 Jun 2026, 07:00');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining(['/partners', '/partners/partner-1?section=full', '#booking-gates', '#wallet', '#kyc']),
    );
    expect(classNames.filter((className) => className === 'metric-card')).toHaveLength(2);
    expect(classNames).toContain('admin-metric-grid admin-mb-16');
    expect(classNames).toContain('detail-grid');
    expect(
      classNames.filter(
        (className) => className.split(' ').includes('card') && className.includes('partner-fast-overview-panel'),
      ),
    ).toHaveLength(4);
    const source = readFileSync('app/partners/[id]/partner-detail-fast-overview-section.tsx', 'utf8');

    expect(source).toContain('AdminMetricGrid');
    expect(source).toContain('AdminDetailGrid');
    expect(source).not.toContain('<section className="grid admin-mb-16">');
    expect(source).not.toContain('<section className="detail-grid">');
  });

  it('uses shared badge link atoms for next action pill links', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-fast-overview-section.tsx', 'utf8');

    expect(source).toContain('StatusBadgeLink');
    expect(source).not.toContain('<Link className="pill pill-info" href={link.href} key={link.href}>');
  });

  it('uses the shared Vuexy form control link for button-style overview actions', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-fast-overview-section.tsx', 'utf8');

    expect(source).toContain('AdminFormControlLink');
    expect(source).not.toContain('<Link className="button button-secondary"');
  });

  it('keeps date values renderable through shared DateTimeText nodes from the detail page', () => {
    const sectionSource = readFileSync('app/partners/[id]/partner-detail-fast-overview-section.tsx', 'utf8');
    const pageSource = readFileSync('app/partners/[id]/page.tsx', 'utf8');

    expect(sectionSource).toContain('valueNode');
    expect(pageSource).toContain('DateTimeText');
    expect(pageSource).toContain('valueNode: <DateTimeText fallback="Missing" value={provider.user?.createdAt} />');
    expect(pageSource).toContain('valueNode: <DateTimeText fallback="Missing" value={latestAccessAt} />');
    expect(pageSource).not.toContain(
      "{ label: 'Joined', value: provider.user?.createdAt ? formatDate(provider.user.createdAt) : null }",
    );
    expect(pageSource).not.toContain("{ label: 'Last access', value: latestAccessAt ? formatDate(latestAccessAt) : null }");
  });
});

function textContent(value: unknown): string {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value === 'boolean') {
    return '';
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(textContent).join(' ');
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  return textContent(props?.children);
}

function normalizedText(value: unknown): string {
  return textContent(value).replace(/\s+/g, ' ').trim();
}

function hrefsIn(value: unknown): string[] {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(hrefsIn);
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  const href = typeof props?.href === 'string' ? [props.href] : [];
  return [...href, ...hrefsIn(props?.children)];
}

function classNamesIn(value: unknown): string[] {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(classNamesIn);
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  const className = typeof props?.className === 'string' ? [props.className] : [];
  return [...className, ...classNamesIn(props?.children)];
}

function resolveElement(value: unknown): unknown {
  const record = readRecord(value);
  const props = readRecord(record?.props);
  return typeof record?.type === 'function' ? resolveElement(record.type(props)) : value;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}
