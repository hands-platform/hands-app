import { readFileSync } from 'node:fs';

import { PartnerDetailOperatorCommandQueueSection } from './partner-detail-operator-command-queue-section';

describe('PartnerDetailOperatorCommandQueueSection', () => {
  it('uses the partner detail Vuexy table panel atom for the operator command queue shell', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-operator-command-queue-section.tsx', 'utf8');

    expect(source).toContain('PartnerDetailVuexyTablePanel');
    expect(source).not.toContain('AdminFilterPanel');
    expect(source).not.toContain('partnerDetailReviewCardClassName');
  });

  it('uses the shared Vuexy trace summary atom for command queue metrics', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-operator-command-queue-section.tsx', 'utf8');

    expect(source).toContain('AdminTraceSummary');
    expect(source).not.toContain('<div className="service-trace-summary admin-mt-12">');
  });

  it('uses shared Vuexy badge atoms for command shortcuts and owners', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-operator-command-queue-section.tsx', 'utf8');

    expect(source).toContain('AdminFilterChipGroup');
    expect(source).toContain('StatusBadgeFromPillClass');
    expect(source).toContain('StatusBadgeLinkFromPillClass');
    expect(source).not.toContain('statusBadgeToneFromPillClass');
    expect(source).toContain('AdminTextLink');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('PillClassBadgeLink');
    expect(source).not.toContain('<div className="participant-list');
    expect(source).not.toContain('className="text-link"');
    expect(source).not.toContain('className={`pill ${pillClassForTone(command.tone)}`}');
    expect(source).not.toContain('<span className={`pill ${pillClassForTone(command.tone)}`}>{command.owner}</span>');
  });

  it('renders operator commands as a Vuexy table', () => {
    const section = PartnerDetailOperatorCommandQueueSection({
      pillClassForTone: (tone) => `pill-${tone}`,
      providerId: 'partner-1',
      queue: {
        commands: [
          {
            action: {
              href: '#wallet',
              label: 'Open wallet',
              type: 'link',
            },
            detail: 'Partner wallet must be settled before final acceptance, service start, or payout release.',
            id: 'wallet',
            label: '1',
            owner: 'Finance',
            title: 'Cash fee debt',
            tone: 'blocked',
          },
          {
            action: {
              label: 'Approve KYC',
              type: 'approve-kyc',
            },
            detail: 'KYC evidence is complete and ready for approval.',
            id: 'kyc',
            label: '2',
            owner: 'Review',
            title: 'KYC approval',
            tone: 'pending',
          },
          {
            action: {
              label: 'Hold Partner',
              type: 'hold-account',
            },
            detail: 'Partner must fix profile, KYC, or payout issues before marketplace access is restored.',
            id: 'hold-account',
            label: '3',
            owner: 'Ops',
            title: 'Partner hold',
            tone: 'blocked',
          },
        ],
        metrics: [
          {
            helper: 'Commands blocking direct and marketplace bookings.',
            label: 'Blocked',
            value: '1',
          },
        ],
        status: '1 blocked',
        tone: 'blocked',
      },
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Partner operator command queue');
    expect(rendered).toContain('1 blocked');
    expect(rendered).toContain('Blocked');
    expect(rendered).toContain('Queue');
    expect(rendered).toContain('Command');
    expect(rendered).toContain('Owner');
    expect(rendered).toContain('Action');
    expect(rendered).toContain('Next decision');
    expect(rendered).toContain('Approve KYC');
    expect(rendered).toContain('KYC approval / Review');
    expect(rendered).toContain('Decision shortcuts');
    expect(rendered).toContain(
      'Hold and reject actions open a confirmation step with a required reason for the Partner app and audit trail.',
    );
    expect(rendered).toContain('Cash fee debt');
    expect(rendered).toContain('Partner wallet must be settled before final acceptance, service start, or payout release.');
    expect(rendered).toContain('KYC approval');
    expect(rendered).toContain('KYC evidence is complete and ready for approval.');
    expect(rendered).toContain('Partner hold');
    expect(rendered).toContain('Partner must fix profile, KYC, or payout issues before marketplace access is restored.');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining([
        '#wallet',
        '#partner-approval-evidence-summary',
        '/partners/partner-1?section=full&providerId=partner-1&reviewAction=approve-kyc',
        '/partners/partner-1?section=full&confirm=block&providerId=partner-1',
      ]),
    );
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-partner-detail-review-card admin-mb-16 admin-section',
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table admin-data-table vuexy-partner-detail-review-table',
        'vuexy-booking-table-footer vuexy-partner-detail-review-footer',
        'partner-command-decision-bar is-pending',
        'partner-command-decision-button is-pending',
        'partner-command-decision-link',
        'pill pill-danger',
        'pill pill-warn pill-pending',
        'text-link',
      ]),
    );
    expect(rendered).toContain('Showing 1 to 3 of 3 entries');
  });

  it('renders an empty command table state', () => {
    const section = PartnerDetailOperatorCommandQueueSection({
      pillClassForTone: (tone) => `pill-${tone}`,
      providerId: 'partner-1',
      queue: {
        commands: [],
        metrics: [],
        status: 'Ready',
        tone: 'done',
      },
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('No records found');
    expect(rendered).toContain('No same-shift partner command is currently queued.');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table admin-data-table vuexy-partner-detail-review-table',
        'vuexy-booking-table-footer vuexy-partner-detail-review-footer',
      ]),
    );
    expect(rendered).toContain('Showing 0 entries');
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

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
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
