import { readFileSync } from 'node:fs';

import { PartnerDetailBookingGateDecisionSection } from './partner-detail-booking-gate-decision-section';

describe('PartnerDetailBookingGateDecisionSection', () => {
  it('uses the shared Vuexy badge atoms for decision policy pills', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-booking-gate-decision-section.tsx', 'utf8');
    const pageSource = readFileSync('app/partners/[id]/page.tsx', 'utf8');

    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('<span className="pill pill-info">First response window:');
    expect(source).not.toContain('<span className={`pill ${bookingGatePillClass(gate)}`}>');
    expect(source).toContain("import type { ReactNode } from 'react';");
    expect(source).toContain('readonly cashDebtLabel: ReactNode;');
    expect(pageSource).toContain('cashDebtLabel: <MoneyText amount={bookingAcceptance.cashDebt} />');
  });

  it('renders marketplace booking gate decisions as a Vuexy table', () => {
    const section = PartnerDetailBookingGateDecisionSection({
      cardClassForTone: (tone) => `card-${tone}`,
      pillClassForTone: (tone) => `pill-${tone}`,
      decision: {
        backupRadiusLabel: '5 km',
        bookableServices: '3 service(s)',
        canDirectFirstPick: true,
        canJoinMarketplace: true,
        cashDebtLabel: '-40,000 VND',
        directFirstPickReason: 'Wallet debt does not block direct first-pick.',
        gates: [
          {
            action: 'Settle cash debt',
            detail: 'Negative wallet warns before final acceptance, service start, or payout release.',
            label: 'Cash settlement',
            ok: false,
            tone: 'pending',
          },
          {
            action: 'No action',
            detail: 'Location is fresh enough for marketplace matching.',
            label: 'Location freshness',
            ok: true,
          },
        ],
        locationAge: '4m ago',
        locationFreshnessLabel: '10m',
        primaryReason: 'Cash debt needs settlement before final acceptance.',
        responseWindowLabel: '90 seconds',
        status: 'Settlement warning',
        tone: 'pending',
      },
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Marketplace booking gate decision');
    expect(rendered).toContain('Settlement warning');
    expect(rendered).toContain('Direct first-pick');
    expect(rendered).toContain('Not wallet-blocked');
    expect(rendered).toContain('First response window: 90 seconds');
    expect(rendered).toContain('Marketplace radius: 5 km');
    expect(rendered).toContain('Gate');
    expect(rendered).toContain('Status');
    expect(rendered).toContain('Detail');
    expect(rendered).toContain('Action');
    expect(rendered).toContain('Cash settlement');
    expect(rendered).toContain('WARN');
    expect(rendered).toContain(
      'Negative wallet is a settlement warning before final acceptance and service start',
    );
    expect(rendered).toContain(
      'Negative wallet warns before final acceptance, service start, or payout release.',
    );
    expect(rendered).toContain('Location freshness');
    expect(rendered).toContain('OK');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['/operations-policy']));
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-partner-detail-review-card card-pending admin-mb-16 admin-section',
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table vuexy-partner-detail-review-table',
        'vuexy-booking-table-footer vuexy-partner-detail-review-footer',
        'pill pill-warn',
        'pill pill-success',
      ]),
    );
    expect(rendered).toContain('Showing 1 to 2 of 2 entries');
  });

  it('renders an empty state when there are no gate rows', () => {
    const section = PartnerDetailBookingGateDecisionSection({
      cardClassForTone: (tone) => `card-${tone}`,
      pillClassForTone: (tone) => `pill-${tone}`,
      decision: {
        backupRadiusLabel: '5 km',
        bookableServices: '0 service(s)',
        canDirectFirstPick: true,
        canJoinMarketplace: true,
        cashDebtLabel: '0 VND',
        directFirstPickReason: 'No wallet blocker.',
        gates: [],
        locationAge: 'fresh',
        locationFreshnessLabel: '10m',
        primaryReason: 'No booking blocker.',
        responseWindowLabel: '90 seconds',
        status: 'Join clear',
        tone: 'done',
      },
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('No records found');
    expect(rendered).toContain('No marketplace booking gate rows.');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-partner-detail-review-card card-done admin-mb-16 admin-section',
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table vuexy-partner-detail-review-table',
        'vuexy-booking-table-footer vuexy-partner-detail-review-footer',
      ]),
    );
    expect(rendered).toContain('Showing 0 entries');
  });

  it('prefers shared gate detail nodes over fallback gate detail text', () => {
    const gatesWithDetailNode = [
      {
        action: 'Settle cash debt',
        detail: 'Fallback cash debt detail',
        detailNode: <span>Shared cash debt marker</span>,
        label: 'Wallet and cash debt',
        ok: false,
        tone: 'pending',
      },
    ] as unknown as Parameters<typeof PartnerDetailBookingGateDecisionSection>[0]['decision']['gates'];
    const section = PartnerDetailBookingGateDecisionSection({
      cardClassForTone: (tone) => `card-${tone}`,
      pillClassForTone: (tone) => `pill-${tone}`,
      decision: {
        backupRadiusLabel: '5 km',
        bookableServices: '1 service(s)',
        canDirectFirstPick: false,
        canJoinMarketplace: true,
        cashDebtLabel: '-40,000 VND',
        directFirstPickReason: 'Cash debt requires settlement.',
        gates: gatesWithDetailNode,
        locationAge: '4m ago',
        locationFreshnessLabel: '10m',
        primaryReason: 'Cash debt needs settlement before final acceptance.',
        responseWindowLabel: '90 seconds',
        status: 'Settlement warning',
        tone: 'pending',
      },
    });
    const rendered = normalizeSpaces(textContent(section));
    const source = readFileSync('app/partners/[id]/partner-detail-booking-gate-decision-section.tsx', 'utf8');

    expect(rendered).toContain('Shared cash debt marker');
    expect(rendered).not.toContain('Fallback cash debt detail');
    expect(source).toContain('readonly detailNode?: ReactNode;');
    expect(source).toContain('{gate.detailNode ?? gate.detail}');
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
