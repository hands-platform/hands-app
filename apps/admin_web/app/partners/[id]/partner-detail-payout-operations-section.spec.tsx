import { readFileSync } from 'node:fs';

import { PartnerDetailPayoutOperationsSection } from './partner-detail-payout-operations-section';

describe('PartnerDetailPayoutOperationsSection', () => {
  it('uses shared Vuexy badge atoms for payout operation statuses', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-payout-operations-section.tsx', 'utf8');
    const pageSource = readFileSync('app/partners/[id]/page.tsx', 'utf8');

    expect(source).toContain('AdminDetailGrid');
    expect(source).toContain('StatusBadge');
    expect(source).toContain("import type { ReactNode } from 'react';");
    expect(source).toContain('readonly amountLine: ReactNode;');
    expect(source).toContain('readonly title: ReactNode;');
    expect(source).toContain('readonly totalNetLabel: ReactNode;');
    expect(source).toContain('readonly walletLines: readonly ReactNode[];');
    expect(pageSource).toContain('Gross <MoneyText amount={earning.grossAmount} />');
    expect(pageSource).toContain('<MoneyText amount={earning.platformFee} />');
    expect(pageSource).toContain('<MoneyText amount={earning.withholdingAmount} />');
    expect(pageSource).toContain('<MoneyText amount={batch.totalNetAmount} />');
    expect(source).not.toContain('PillClassBadge');
    expect(source).toContain('AdminSectionHeader');
    expect(source).toContain('AdminTaskCard');
    expect(source).not.toContain('<div className="detail-grid admin-mt-16">');
    expect(source).not.toContain('<div className="ops-section-header">');
    expect(source).not.toContain('className={`ops-task-card');
    expect(source).not.toContain('<span className={`pill ${pillClassForTone(card.tone)}`}>{card.status}</span>');
    expect(source).not.toContain('<span className="pill pill-danger">HELD</span>');
    expect(source).not.toContain('<span className="pill pill-warn">GATE</span>');
    expect(source).not.toContain('<span className={`pill ${payoutBatchPill(batch.status)}`}>{batch.status}</span>');
  });

  it('uses the shared date time atom for payout hold timing', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-payout-operations-section.tsx', 'utf8');
    const pageSource = readFileSync('app/partners/[id]/page.tsx', 'utf8');

    expect(source).toContain('DateTimeText');
    expect(source).not.toContain('readonly expiresAtLabel: string;');
    expect(source).not.toContain('readonly startsAtLabel: string;');
    expect(source).not.toContain('Started {operations.hold.startsAtLabel}');
    expect(source).not.toContain('Expires {operations.hold.expiresAtLabel}');
    expect(pageSource).not.toContain('expiresAtLabel: formatDate(payoutOps.hold.expiresAt)');
    expect(pageSource).not.toContain('startsAtLabel: formatDate(payoutOps.hold.startsAt)');
  });

  it('renders payout holds, blockers, earnings, and payout batches as Vuexy tables', () => {
    const section = PartnerDetailPayoutOperationsSection({
      cardClassForTone: (tone) => `card-${tone}`,
      earningsRows: [
        {
          amountLine: 'Gross 400,000 VND / withholding 20,000 VND / net 380,000 VND',
          detailLine: 'Completed booking on 20 Jun 2026.',
          id: 'earning-1',
          settlementNotes: 'Cash fee was deducted from wallet.',
          settlementRef: 'settlement-1',
          smallLabel: 'Review',
          statusLabel: 'UNPAID',
          title: 'Completed massage service',
          walletLines: ['Wallet debit 40,000 VND', 'Wallet balance -15,000 VND'],
        },
      ],
      hasCashFeeDebt: true,
      operations: {
        blockers: ['Negative wallet balance blocks payout release.'],
        cards: [
          {
            action: 'Settle before payout',
            detail: 'Partner wallet is below zero.',
            status: 'BLOCKED',
            title: 'Wallet debt',
            tone: 'blocked',
          },
        ],
        hold: {
          expiresAt: '2026-06-21T09:00:00.000Z',
          reason: 'Open customer report blocks payout release.',
          startsAt: '2026-06-20T09:00:00.000Z',
        },
        status: 'Payout locked',
        tone: 'blocked',
      },
      partnerControlsHref: '#partner-controls',
      payoutBatchRows: [
        {
          createdLine: 'Created 20 Jun 2026, 10:00',
          href: '/payouts?payoutId=batch-1',
          id: 'batch-1',
          paidLine: 'Paid 20 Jun 2026, 11:00',
          status: 'PAID',
          totalNetLabel: '380,000 VND',
        },
      ],
      pillClassForTone: (tone) => `pill-${tone}`,
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Payout operations');
    expect(rendered).toContain('Payout locked');
    expect(rendered).toContain('Active payout hold');
    expect(rendered).toContain('Open customer report blocks payout release.');
    expect(rendered).toContain('Negative wallet balance blocks payout release.');
    expect(rendered).toContain('Recent earnings');
    expect(rendered).toContain('Cash debt queue');
    expect(rendered).toContain('Completed massage service');
    expect(rendered).toContain('Settlement ref settlement-1');
    expect(rendered).toContain('Recent payout batches');
    expect(rendered).toContain('380,000 VND');
    expect(rendered).toContain('Hold');
    expect(rendered).toContain('Gate');
    expect(rendered).toContain('Earning');
    expect(rendered).toContain('Batch');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining(['#partner-controls', '/cash-settlements', '/earnings', '/payouts', '/payouts?payoutId=batch-1']),
    );
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-partner-detail-review-card admin-mb-16 admin-section',
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table vuexy-partner-detail-review-table',
        'vuexy-booking-table-footer vuexy-partner-detail-review-footer',
        'pill pill-danger',
        'pill pill-warn',
        'pill pill-success',
      ]),
    );
  });

  it('renders empty earning and payout batch states as table rows', () => {
    const section = PartnerDetailPayoutOperationsSection({
      cardClassForTone: (tone) => `card-${tone}`,
      earningsRows: [],
      hasCashFeeDebt: false,
      operations: {
        blockers: [],
        cards: [],
        hold: null,
        status: 'Payout ready',
        tone: 'done',
      },
      partnerControlsHref: '#partner-controls',
      payoutBatchRows: [],
      pillClassForTone: (tone) => `pill-${tone}`,
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('No records found');
    expect(rendered).toContain('No earnings yet. Payout eligibility starts after the first completed service.');
    expect(rendered).toContain('No payout batch has been created for this partner yet.');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-partner-detail-review-card admin-mb-16 admin-section',
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table vuexy-partner-detail-review-table',
        'vuexy-booking-table-footer vuexy-partner-detail-review-footer',
      ]),
    );
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
