import { readFileSync } from 'node:fs';

import { PartnerDetailAcceptanceUnblockPlaybookSection } from './partner-detail-acceptance-unblock-playbook-section';

describe('PartnerDetailAcceptanceUnblockPlaybookSection', () => {
  it('uses the partner detail Vuexy table panel atom for the unblock playbook shell', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-acceptance-unblock-playbook-section.tsx', 'utf8');

    expect(source).toContain('PartnerDetailVuexyTablePanel');
    expect(source).not.toContain('AdminFilterPanel');
    expect(source).not.toContain('partnerDetailReviewCardClassName');
  });

  it('uses shared Vuexy badge atoms instead of raw unblock playbook pill spans', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-acceptance-unblock-playbook-section.tsx', 'utf8');

    expect(source).toContain('StatusBadgeFromPillClass');
    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('statusBadgeToneFromPillClass');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('<span className={`pill ${pillClassForTone(step.tone)}`}>{step.status}</span>');
    expect(source).not.toContain('<span className="pill pill-info">{step.owner}</span>');
  });

  it('uses the shared Vuexy text-link atom instead of raw text-link classes', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-acceptance-unblock-playbook-section.tsx', 'utf8');

    expect(source).toContain('AdminTextLink');
    expect(source).not.toContain('className="text-link"');
  });

  it('renders active-work repair steps as a Vuexy table', () => {
    const section = PartnerDetailAcceptanceUnblockPlaybookSection({
      pillClassForTone: (tone) => `pill-${tone}`,
      steps: [
        {
          action: 'Settle wallet',
          bookingBlocked: false,
          bookingImpact:
            'Marketplace visibility and participation stay open; final acceptance and service start wait for settlement.',
          detail: 'Cash fee debt is below zero and must be collected.',
          href: '#wallet',
          id: 'cash-debt',
          owner: 'Finance',
          payoutImpact: 'Payout release stays locked while balance is negative.',
          status: 'Settlement warning',
          step: '1',
          title: 'Clear cash fee debt',
          tone: 'pending',
        },
        {
          action: 'Review KYC',
          bookingBlocked: false,
          bookingImpact: 'No dispatch block after approval.',
          detail: 'KYC record is pending operator review.',
          href: '#kyc',
          id: 'kyc',
          owner: 'KYC',
          payoutImpact: 'Payout can continue after review clears.',
          status: 'Operator check',
          step: '2',
          title: 'Approve identity',
          tone: 'pending',
        },
      ],
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Partner active-work repair playbook');
    expect(rendered).toContain(
      'Only the Partner items that still need operator repair.',
    );
    expect(rendered).not.toContain('tax stays deferred until first earning and then blocks payout');
    expect(rendered).toContain('0 booking blocker(s)');
    expect(rendered).toContain('Step');
    expect(rendered).toContain('Repair item');
    expect(rendered).toContain('Operator read');
    expect(rendered).toContain('Booking effect');
    expect(rendered).toContain('Status');
    expect(rendered).toContain('Open');
    expect(rendered).toContain('Clear cash fee debt');
    expect(rendered).toContain('Cash fee debt is below zero and must be collected.');
    expect(rendered).toContain(
      'Marketplace visibility and participation stay open; final acceptance and service start wait for settlement.',
    );
    expect(rendered).toContain('Settlement warning');
    expect(rendered).toContain('Approve identity');
    expect(rendered).toContain('Operator check');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['#wallet', '#kyc']));
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-partner-detail-review-card admin-mb-16 admin-section',
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table admin-data-table vuexy-partner-detail-review-table',
        'vuexy-booking-table-footer vuexy-partner-detail-review-footer',
        'pill pill-success',
        'pill pill-info',
        'pill pill-warn pill-pending',
        'text-link',
      ]),
    );
    expect(rendered).toContain('Showing 1 to 2 of 2 entries');
  });

  it('renders an empty playbook state in the table', () => {
    const section = PartnerDetailAcceptanceUnblockPlaybookSection({
      pillClassForTone: (tone) => `pill-${tone}`,
      steps: [],
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('0 booking blocker(s)');
    expect(rendered).toContain('No records found');
    expect(rendered).toContain('No marketplace or payout unblock steps are currently required.');
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
