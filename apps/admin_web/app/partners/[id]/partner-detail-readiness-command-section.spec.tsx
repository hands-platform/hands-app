import { readFileSync } from 'node:fs';

import {
  PartnerAcceptanceRepairCommandSection,
  PartnerDetailReadinessSnapshotSection,
} from './partner-detail-readiness-command-section';

describe('partner detail readiness command sections', () => {
  it('uses the shared Vuexy trace summary atom for dispatch repair metrics', () => {
    const source = readFileSync(
      new URL('./partner-detail-readiness-command-section.tsx', import.meta.url),
      'utf8',
    );

    expect(source).toContain('AdminTraceSummary');
    expect(source).not.toContain('<div className="service-trace-summary admin-mt-12">');
    expect(source).not.toContain('function TraceSummaryItem');
  });

  it('uses the shared Vuexy badge atom for readiness status pills', () => {
    const source = readFileSync(
      new URL('./partner-detail-readiness-command-section.tsx', import.meta.url),
      'utf8',
    );

    expect(source).toContain('StatusBadge');
    expect(source).toContain('AdminTextLink');
    expect(source).not.toContain('className="text-link"');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('<span className={`pill ${partnerOpsPillClass(badge.tone)}`}');
    expect(source).not.toContain(
      '<span className={`pill ${partnerOpsPillClass(snapshot.tone)}`}>{snapshot.gate.label}</span>',
    );
    expect(source).not.toContain(
      '<span className={`pill ${partnerOpsPillClass(step.tone)}`}>{partnerOpsStepLabel(step.tone)}</span>',
    );
  });

  it('renders the readiness gate as a Vuexy table', () => {
    const section = PartnerDetailReadinessSnapshotSection({
      snapshot: {
        badges: [
          {
            detail: 'Negative wallet warns before final acceptance and service start.',
            detailNode: <span>Shared cash debt atom marker</span>,
            label: 'Cash debt warning',
            tone: 'pending',
          },
          {
            detail: 'Latest location is fresh.',
            label: 'Location fresh',
            tone: 'done',
          },
        ],
        gate: {
          detail: 'Wallet is negative, but marketplace visibility stays open.',
          helper: 'Settle before final acceptance.',
          label: 'GATE',
          title: 'Settlement warning',
        },
        status: 'Settlement warning',
        tone: 'pending',
      },
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Partner readiness snapshot');
    expect(rendered).toContain('Settlement warning');
    expect(rendered).toContain('Cash debt warning');
    expect(rendered).toContain('Shared cash debt atom marker');
    expect(rendered).toContain('Location fresh');
    expect(rendered).toContain('Gate');
    expect(rendered).toContain('Readiness');
    expect(rendered).toContain('Operator helper');
    expect(rendered).toContain('Wallet is negative, but marketplace visibility stays open.');
    expect(rendered).toContain('Settle before final acceptance.');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-partner-detail-review-card admin-mb-16 admin-section',
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table vuexy-partner-detail-review-table',
        'vuexy-booking-table-footer vuexy-partner-detail-review-footer',
        'pill pill-warn',
      ]),
    );
    expect(rendered).toContain('Showing 1 to 1 of 1 entries');
  });

  it('keeps readiness badge details open to shared React atoms', () => {
    const source = readFileSync(
      new URL('./partner-detail-readiness-command-section.tsx', import.meta.url),
      'utf8',
    );
    const pageSource = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

    expect(source).toContain('readonly detailNode?: ReactNode;');
    expect(source).toContain('{badge.detailNode ? <span className="sr-only">{badge.detailNode}</span> : null}');
    expect(pageSource).toContain('Partner owes HANDS <MoneyText amount={cashDebt} />');
    expect(pageSource).toContain('detailNode:');
  });

  it('renders dispatch repair steps as a Vuexy command table', () => {
    const section = PartnerAcceptanceRepairCommandSection({
      command: {
        customerImpact: 'Customer choices stay visible, but final acceptance waits for settlement.',
        marketplaceRouting: 'Marketplace visibility stays open as a warning state.',
        operatorDecision: 'Clear settlement before final acceptance.',
        partnerAppMessage: 'Settle wallet balance before final acceptance or service start.',
        status: 'Settlement warning',
        steps: [
          {
            actionLabel: 'Open wallet',
            blocker: 'Negative wallet',
            href: '/partners/partner-1#wallet',
            operatorAction: 'Collect outstanding cash fee before final acceptance.',
            owner: 'Finance',
            reason: 'Partner wallet is below zero.',
            tone: 'pending',
          },
          {
            actionLabel: 'Review activity',
            blocker: 'Location freshness',
            href: '/partners/partner-1#app-activity',
            operatorAction: 'No action needed.',
            owner: 'Dispatch',
            reason: 'Latest location ping is still valid.',
            tone: 'done',
          },
        ],
        tone: 'pending',
      },
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Dispatch repair command');
    expect(rendered).toContain('Settlement warning');
    expect(rendered).toContain('Partner app message');
    expect(rendered).toContain('Customer impact');
    expect(rendered).toContain('Operator decision');
    expect(rendered).toContain('Marketplace routing');
    expect(rendered).toContain('Step');
    expect(rendered).toContain('Owner / blocker');
    expect(rendered).toContain('Reason');
    expect(rendered).toContain('Operator action');
    expect(rendered).toContain('Status');
    expect(rendered).toContain('Action');
    expect(rendered).toContain('Finance : Negative wallet');
    expect(rendered).toContain('Operator check');
    expect(rendered).toContain('Dispatch : Location freshness');
    expect(rendered).toContain('Clear');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining(['/partners/partner-1#wallet', '/partners/partner-1#app-activity']),
    );
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-partner-detail-review-card ops-task-pending admin-mb-16 admin-section',
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table vuexy-partner-detail-review-table',
        'vuexy-booking-table-footer vuexy-partner-detail-review-footer',
        'pill pill-warn',
        'pill pill-success',
        'text-link',
      ]),
    );
    expect(rendered).toContain('Showing 1 to 2 of 2 entries');
  });

  it('keeps an empty table state when repair steps are missing', () => {
    const section = PartnerAcceptanceRepairCommandSection({
      command: {
        customerImpact: 'No impact.',
        marketplaceRouting: 'No reroute needed.',
        operatorDecision: 'Ready.',
        partnerAppMessage: 'Ready for new bookings.',
        status: 'Ready',
        steps: [],
        tone: 'done',
      },
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('No records found');
    expect(rendered).toContain('No repair command steps loaded.');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'table vuexy-data-table vuexy-booking-table vuexy-partner-detail-review-table',
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
