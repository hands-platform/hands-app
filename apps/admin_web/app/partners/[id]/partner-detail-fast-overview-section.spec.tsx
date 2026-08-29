import { readFileSync } from 'node:fs';

import { PartnerDetailFastOverviewSection } from './partner-detail-fast-overview-section';

describe('PartnerDetailFastOverviewSection', () => {
  it('renders a bounded command view instead of inferred KPI cards', () => {
    const section = PartnerDetailFastOverviewSection({
      accountControlsHref: '/partner-controls?details=sanctions&q=partner-1',
      actionIssueCount: 6,
      actionItems: [
        {
          area: 'Approval',
          completion: 'KYC is approved.',
          href: '/partners/partner-1?section=dossier&dossier=approval',
          id: 'kyc-approval',
          impact: 'Partner cannot accept a booking.',
          nextAction: 'Review KYC',
          problem: 'KYC approval',
          status: 'KYC not submitted',
          tone: 'pill-warn',
        },
      ],
      activityItems: [{ detail: 'No linked booking record.', label: 'Latest booking' }],
      chatHref: '/chat-archive?q=partner-1',
      currentStatus: 'Partner set offline',
      fullHref: '/partners/partner-1?section=full',
      partnerName: 'Partner One',
      phone: '+84900000000',
      subtitle: '+84900000000 / Ho Chi Minh City',
      workItems: [
        {
          detail: 'KYC review is incomplete.',
          href: '/partners/partner-1?section=dossier&dossier=approval',
          label: 'Approval',
          status: 'Needs review',
          tone: 'pill-warn',
        },
      ],
      workspaceLinks: [
        {
          detail: 'One unresolved issue.',
          href: '/partners/partner-1?section=dossier&dossier=approval',
          label: 'Approval & profile',
          status: '1 open',
          tone: 'pill-warn',
        },
      ],
    });

    expect(normalizedText(section)).toContain('Partner One');
    expect(normalizedText(section)).toContain('Action required');
    expect(normalizedText(section)).toContain('Can work now?');
    expect(normalizedText(section)).toContain('Partner work areas');
    expect(normalizedText(section)).toContain('6 open');
    expect(normalizedText(section)).toContain('+5 more issues');
    expect(normalizedText(section)).toContain('Review all issues');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining([
        'tel:+84900000000',
        '/chat-archive?q=partner-1',
        '/partners/partner-1?section=full',
        '/partners/partner-1?section=dossier&dossier=approval',
      ]),
    );

    const source = readFileSync('app/partners/[id]/partner-detail-fast-overview-section.tsx', 'utf8');
    expect(source).not.toContain('AdminMetricGrid');
    expect(source).not.toContain('AdminDetailGrid');
    expect(source).toContain('actionItems.map');
    expect(source).toContain('workspaceLinks.map');
  });

  it('keeps shared controls and ReactNode money/date values', () => {
    const sectionSource = readFileSync('app/partners/[id]/partner-detail-fast-overview-section.tsx', 'utf8');
    const overviewSource = readFileSync('app/partners/[id]/partner-detail-fast-overview.tsx', 'utf8');

    expect(sectionSource).toContain('AdminFormControlLink');
    expect(sectionSource).toContain('ActionMenu');
    expect(sectionSource).toContain('readonly detail: ReactNode;');
    expect(overviewSource).toContain("import { MoneyText } from '../../../components/money-text';");
    expect(overviewSource).toContain('<MoneyText amount={cashDebt} /> owed by Partner.');
    expect(overviewSource).toContain('DateTimeText');
  });

  it('keeps identity visible while replacing policy-dependent readiness with an alert', () => {
    const section = PartnerDetailFastOverviewSection({
      accountControlsHref: '/partner-controls?details=sanctions&q=partner-1',
      actionIssueCount: 0,
      actionItems: [],
      activityItems: [{ detail: 'No linked booking record.', label: 'Latest booking' }],
      chatHref: '/chat-archive?q=partner-1',
      currentStatus: 'ONLINE_AVAILABLE',
      fullHref: '/partners/partner-1?section=full',
      operationalPolicyAvailable: false,
      operationalPolicyFailureStatus: 500,
      partnerName: 'Partner One',
      policyRetryHref: '/partners/partner-1',
      subtitle: '+84900000000 / Ho Chi Minh City',
      workItems: [
        {
          detail: 'This fallback decision must stay hidden.',
          href: '/partners/partner-1?section=access&access=readiness',
          label: 'Availability',
          status: 'Ready',
          tone: 'pill-success',
        },
      ],
      workspaceLinks: [],
    });

    expect(normalizedText(section)).toContain('Partner One');
    expect(normalizedText(section)).toContain('Operational policy unavailable');
    expect(normalizedText(section)).toContain('Pause matching and readiness decisions');
    expect(normalizedText(section)).not.toContain('This fallback decision must stay hidden.');
    expect(hrefsIn(section)).toContain('/partners/partner-1');
  });
});

function textContent(value: unknown): string {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value === 'boolean') return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(textContent).join(' ');
  return textContent(readRecord(readRecord(value)?.props)?.children);
}

function normalizedText(value: unknown): string {
  return textContent(value).replace(/\s+/g, ' ').trim();
}

function hrefsIn(value: unknown): string[] {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(hrefsIn);
  const props = readRecord(readRecord(value)?.props);
  return [...(typeof props?.href === 'string' ? [props.href] : []), ...hrefsIn(props?.children)];
}

function resolveElement(value: unknown): unknown {
  const record = readRecord(value);
  const props = readRecord(record?.props);
  return typeof record?.type === 'function' ? resolveElement(record.type(props)) : value;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
