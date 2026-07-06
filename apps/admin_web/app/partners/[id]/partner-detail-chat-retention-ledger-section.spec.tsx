import { readFileSync } from 'node:fs';

import {
  PartnerDetailChatRetentionLedgerSection,
  type PartnerChatRetentionRow,
  type PartnerChatRetentionSummaryItem,
} from './partner-detail-chat-retention-ledger-section';

describe('PartnerDetailChatRetentionLedgerSection', () => {
  it('uses the shared Vuexy trace summary atom for chat retention metrics', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-chat-retention-ledger-section.tsx', 'utf8');

    expect(source).toContain('AdminTraceSummary');
    expect(source).not.toContain('<div className="service-trace-summary admin-mt-12">');
  });

  it('uses the shared Vuexy badge atom for booking status', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-chat-retention-ledger-section.tsx', 'utf8');

    expect(source).toContain('StatusBadge');
    expect(source).toContain('DateTimeText');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('<span className={`pill ${statusPillClass(row.status)}`}>{row.status}</span>');
    expect(source).not.toContain('formatLatestMessageAt');
  });

  it('uses the shared Vuexy text-link atom instead of raw text-link classes', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-chat-retention-ledger-section.tsx', 'utf8');

    expect(source).toContain('AdminTextLink');
    expect(source).not.toContain('className="text-link"');
  });

  it('renders chat retention summary, row evidence, and archive links', () => {
    const section = PartnerDetailChatRetentionLedgerSection({
      description: 'Admin keeps the retained transcript for evidence review.',
      emptyMessage: 'No Partner chat retention row matched this date filter.',
      id: 'partner-chat-retention-ledger',
      rows: buildRows(),
      statusPillClass: (status) => (status === 'COMPLETED' ? 'pill-success' : 'pill-neutral'),
      summary: buildSummary(),
      title: 'Partner chat retention ledger',
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Partner chat retention ledger');
    expect(rendered).toContain('Admin keeps the retained transcript for evidence review.');
    expect(rendered).toContain('1 booking row(s)');
    expect(rendered).toContain('Retained rooms');
    expect(rendered).toContain('BK-1001 / 9 Jun 2026');
    expect(rendered).toContain('Selected');
    expect(rendered).toContain('Customer');
    expect(rendered).toContain('9 Jun 2026, 10:00');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['/bookings/BK-1001', '/chat-archive?q=BK-1001']));
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-partner-detail-review-card admin-mb-16 admin-section',
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table vuexy-partner-detail-review-table',
        'vuexy-booking-table-footer vuexy-partner-detail-review-footer',
        'service-trace-summary admin-mt-12',
        'text-link admin-ml-10',
        'pill pill-success',
      ]),
    );
    expect(rendered).toContain('Showing 1 to 1 of 1 entries');
  });

  it('renders an empty message when no chat retention rows match', () => {
    const section = PartnerDetailChatRetentionLedgerSection({
      description: 'Admin keeps the retained transcript for evidence review.',
      emptyMessage: 'No Partner chat retention row matched this date filter.',
      id: 'partner-chat-retention-ledger',
      rows: [],
      statusPillClass: () => 'pill-neutral',
      summary: buildSummary(),
      title: 'Partner chat retention ledger',
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('0 booking row(s)');
    expect(rendered).toContain('No Partner chat retention row matched this date filter.');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-partner-detail-review-card admin-mb-16 admin-section',
        'table vuexy-data-table vuexy-booking-table vuexy-partner-detail-review-table',
        'vuexy-booking-table-footer vuexy-partner-detail-review-footer',
        'muted admin-mt-12',
      ]),
    );
    expect(rendered).toContain('Showing 0 entries');
  });
});

function buildSummary(): PartnerChatRetentionSummaryItem[] {
  return [
    {
      helper: 'Partner chat rooms saved for admin evidence.',
      label: 'Retained rooms',
      value: '1',
    },
  ];
}

function buildRows(): PartnerChatRetentionRow[] {
  return [
    {
      adminRetention: 'Admin archive retained',
      adminRetentionDetail: 'Use the archive link for full message evidence.',
      bookingHref: '/bookings/BK-1001',
      bookingLabel: 'BK-1001 / 9 Jun 2026',
      chatHref: '/chat-archive?q=BK-1001',
      hasRoom: true,
      id: 'BK-1001',
      latestMessage: 'Customer asked for arrival estimate.',
      latestMessageAt: '2026-06-09T03:00:00.000Z',
      latestSender: 'Customer',
      messageCount: 3,
      mobileHidden: true,
      mobileVisibility: 'Hidden in mobile after closeout',
      mobileVisibilityDetail: 'Customer and Partner apps may hide completed or closed chats.',
      relation: 'Selected',
      requiresRoom: true,
      roleDetail: 'Customer selected this partner for final service handoff.',
      roomDetail: 'Room CR-1001 / evidence retained',
      roomStatus: '3 retained message(s)',
      serviceLabel: 'Deep tissue / customer Customer A',
      status: 'COMPLETED',
    },
  ];
}

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
