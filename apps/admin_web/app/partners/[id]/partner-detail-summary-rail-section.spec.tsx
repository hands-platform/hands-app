import {
  PartnerDetailSummaryRailSection,
} from './partner-detail-summary-rail-section';
import { readFileSync } from 'fs';
import type {
  PartnerDetailSummaryRailItem,
  PartnerDetailUsageRegionSummary,
} from './partner-detail-summary-rail-model';

const modelSource = readFileSync('app/partners/[id]/partner-detail-summary-rail-model.ts', 'utf8');
const pageSource = readFileSync('app/partners/[id]/page.tsx', 'utf8');

describe('PartnerDetailSummaryRailSection', () => {
  it('uses the shared Vuexy trace summary atom for summary rail links', () => {
    const source = readFileSync(__filename.replace('.spec.tsx', '.tsx'), 'utf8');

    expect(source).toContain('AdminTraceSummary');
    expect(source).toContain('AdminSummaryCardGrid');
    expect(source).toContain("import { AdminCard, AdminSection } from '../../../components/admin-surface';");
    expect(source).not.toContain('<div className="service-trace-summary partner-detail-summary-rail-grid">');
    expect(source).not.toContain('<div className="partner-detail-usage-summary-grid">');
    expect(source).not.toContain('<section className="partner-detail-usage-summary admin-mt-12">');
  });

  it('builds the summary rail on the shared Vuexy AdminSection surface', () => {
    const source = readFileSync(__filename.replace('.spec.tsx', '.tsx'), 'utf8');

    expect(source).toContain("import { AdminCard, AdminSection } from '../../../components/admin-surface';");
    expect(source).toContain('<AdminSection');
    expect(source).toContain('className="partner-detail-section-band admin-mb-16"');
    expect(source).toContain('bodyClassName="partner-detail-section-band-body"');
    expect(source).toContain('headerClassName="partner-detail-section-band-header"');
    expect(source).not.toContain('<section className="partner-detail-section-band admin-mb-16"');
  });

  it('renders summary rail items with links and status label', () => {
    const section = PartnerDetailSummaryRailSection({
      description: 'Fast facts for operators before opening the full partner record.',
      id: 'partner-summary',
      items: buildItems(),
      statusLabel: 'Above-fold summary',
      title: 'Partner operator first read',
      usageSummary: buildUsageSummary(),
    });

    const rendered = textContent(section);

    expect(rendered).toContain('Partner operator first read');
    expect(rendered).toContain('Fast facts for operators before opening the full partner record.');
    expect(rendered).toContain('Above-fold summary');
    expect(rendered).toContain('Identity');
    expect(rendered).toContain('Massage Partner');
    expect(rendered).toContain('Wallet and payout');
    expect(rendered).toContain('Payout gate clear.');
    expect(rendered).toContain('Usage and region summary');
    expect(rendered).toContain('No live GPS polling');
    expect(rendered).toContain('Primary booking region');
    expect(rendered).toContain('District 1, Ho Chi Minh City');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['#partner-master-facts', '#payout']));
    expect(classNamesIn(section)).toEqual(expect.arrayContaining([
      'card admin-section partner-detail-section-band admin-mb-16',
      'ops-section-header admin-section-header partner-detail-section-band-header',
      'admin-section-body partner-detail-section-band-body',
      'card admin-card partner-detail-usage-summary admin-mt-12',
      'admin-summary-card-grid partner-detail-usage-summary-grid',
      'card admin-card admin-summary-card',
      'partner-detail-usage-region-list',
    ]));
  });

  it('uses a shared badge atom for the summary rail status label', () => {
    const source = readFileSync(__filename.replace('.spec.tsx', '.tsx'), 'utf8');

    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('<span className="pill pill-info">{statusLabel}</span>');
  });

  it('keeps cash debt rail money values on the shared MoneyText atom', () => {
    expect(modelSource).toContain("import type { ReactNode } from 'react';");
    expect(modelSource).toContain('readonly value: ReactNode;');
    expect(modelSource).toContain('readonly detail: ReactNode;');
    expect(modelSource).not.toContain('readonly cashDebtLabel: string;');
    expect(pageSource).toContain('cashDebtLabel: <MoneyText amount={cashFeeDebtTotal} />');
    expect(pageSource).not.toContain('cashDebtLabel: formatCurrency(cashFeeDebtTotal)');
  });

  it('keeps payout unpaid net detail money on the shared MoneyText atom', () => {
    expect(modelSource).toContain('readonly unpaidNetDetail?: ReactNode;');
    expect(pageSource).toContain(
      "unpaidNetDetail: payoutOps.cards.find((card) => card.title === 'Unpaid net')?.detailNode",
    );
    expect(pageSource).not.toContain(
      "unpaidNetDetail: payoutOps.cards.find((card) => card.title === 'Unpaid net')?.detail,",
    );
  });

  it('keeps operator first-read dates on the shared DateTimeText atom', () => {
    expect(modelSource).toContain('readonly joinedAtLabel: ReactNode;');
    expect(modelSource).toContain('readonly latestStaffNoteDetail?: ReactNode;');
    expect(modelSource).toContain('readonly locationRecordedAtLabel?: ReactNode;');
    expect(pageSource).toContain('joinedAtLabel: <DateTimeText fallback="Missing" value={provider.user?.createdAt} />');
    expect(pageSource).toContain('<DateTimeText fallback="Missing" value={partnerOpsNotes[0].createdAt} />');
    expect(pageSource).toContain('<DateTimeText fallback="Missing" value={provider.currentLocationUpdatedAt} />');
    expect(pageSource).not.toContain('joinedAtLabel: formatDate(provider.user?.createdAt)');
    expect(pageSource).not.toContain('locationRecordedAtLabel: provider.currentLocationUpdatedAt\\n      ? formatDate(provider.currentLocationUpdatedAt)');
  });

  it('passes usage summary timestamps into shared DateTimeText atoms', () => {
    const source = readFileSync(__filename.replace('.spec.tsx', '.tsx'), 'utf8');

    expect(source).toContain('detailDateTimeValue: item.detailDateTimeValue');
    expect(source).toContain('usageSummaryDetail(region)');
    expect(source).toContain('<DateTimeText');
  });
});

function buildItems(): PartnerDetailSummaryRailItem[] {
  return [
    {
      detail: '+84900000000 / joined 9 Jun 2026',
      href: '#partner-master-facts',
      label: 'Identity',
      value: 'Massage Partner',
    },
    {
      detail: 'Payout gate clear.',
      href: '#payout',
      label: 'Wallet and payout',
      value: 'READY',
    },
  ];
}

function buildUsageSummary(): PartnerDetailUsageRegionSummary {
  return {
    helper: 'Built from stored app sessions and booking address snapshots. No live GPS polling.',
    items: [
      {
        detailDateTimePrefix: 'Latest ',
        detailDateTimeSuffix: '.',
        detailDateTimeValue: '2026-06-13T03:02:00.000Z',
        detail: 'Latest 13 Jun 2026, 03:02.',
        label: 'App sessions',
        value: '1',
      },
      {
        detail: 'Most common service area from stored booking addresses.',
        label: 'Primary booking region',
        value: 'District 1, Ho Chi Minh City',
      },
    ],
    regionRows: [
      {
        detailDateTimePrefix: 'Latest booking ',
        detailDateTimeSuffix: '.',
        detailDateTimeValue: '2026-06-13T03:02:00.000Z',
        detail: 'Latest booking 13 Jun 2026, 03:02.',
        label: 'District 1, Ho Chi Minh City',
        value: '2',
      },
    ],
    title: 'Usage and region summary',
  };
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
