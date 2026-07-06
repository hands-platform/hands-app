import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';

import { PartnerDetailReportsControlsSection } from './partner-detail-reports-controls-section';

describe('PartnerDetailReportsControlsSection', () => {
  it('uses the partner detail Vuexy table panel atom for reports and controls shell', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-reports-controls-section.tsx', 'utf8');

    expect(source).toContain('PartnerDetailVuexyTablePanel');
    expect(source).not.toContain('AdminFilterPanel');
    expect(source).not.toContain('partnerDetailReviewCardClassName');
  });

  it('uses the shared Vuexy empty-state atom', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-reports-controls-section.tsx', 'utf8');
    const pageSource = readFileSync('app/partners/[id]/page.tsx', 'utf8');

    expect(source).toContain('AdminEmptyState');
    expect(source).toContain('AdminDetailGrid');
    expect(source).toContain('AdminSectionHeader');
    expect(source).toContain('AdminTaskCard');
    expect(source).toContain('AdminTextLink');
    expect(source).not.toContain('className="text-link"');
    expect(source).toContain('AdminTaskCard className="partner-report-command-grid admin-mt-16"');
    expect(source).toContain('StatusBadgeFromPillClass');
    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('statusBadgeToneFromPillClass');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('<div className="detail-grid">');
    expect(source).not.toContain('<div className="ops-section-header">');
    expect(source).not.toContain('<div className="partner-report-command-grid');
    expect(source).not.toContain('className="ops-task-card');
    expect(source).not.toContain('<strong>No records found</strong>');
    expect(source).not.toContain("<span className={`pill ${payoutHold ? 'pill-danger' : 'pill-success'}`}>");
    expect(source).not.toContain('<span className="pill pill-danger">ACTIVE</span>');
    expect(source).not.toContain(
      '<span className={`pill ${reportSeverityPill(report.severity)}`}>{report.severity}</span>',
    );
    expect(source).not.toContain(
      '<span className={`pill ${reportStatusPill(report.status)}`}>{report.status}</span>',
    );
    expect(source).not.toContain(
      '<span className={`pill ${controlStatusPill(control.status)}`}>{control.status}</span>',
    );
    expect(source).toContain('AdminInlineFallback');
    expect(source).not.toContain('<span className="muted">No booking linked</span>');
    expect(source).not.toContain('<span className="muted">No action</span>');
    expect(source).toContain('DateTimeText');
    expect(source).not.toContain('readonly createdLabel: string;');
    expect(source).not.toContain('readonly timeline: string;');
    expect(source).not.toContain('{report.category} / {report.source} / {report.createdLabel}');
    expect(source).not.toContain('{payoutHold.timeline}');
    expect(source).not.toContain('{control.timeline}');
    expect(pageSource).not.toContain('createdLabel: formatDate(report.createdAt)');
    expect(pageSource).not.toContain(
      'timeline: `Started ${formatDate(payoutHold.startsAt)} / expires ${formatDate(payoutHold.expiresAt)}`',
    );
    expect(pageSource).not.toContain(
      'timeline: `Started ${formatDate(sanction.startsAt)} / expires ${formatDate(sanction.expiresAt)}`',
    );
  });

  it('renders reports and account controls as Vuexy tables', () => {
    const section = PartnerDetailReportsControlsSection({
      accountControls: [
        {
          id: 'control-1',
          liftControlHref: '/partners/partner-1?controlAction=lift',
          reason: 'Payout review pending because a customer complaint is open.',
          reportLine: 'Report: payout / HIGH',
          smallLabel: 'ctrl-1',
          expiresAt: null,
          startsAt: '2026-06-20T03:00:00.000Z',
          status: 'ACTIVE',
          type: 'PAYOUT_HOLD',
        },
      ],
      payoutHold: {
        idLabel: 'hold-1',
        reason: 'Payout review pending because a customer complaint is open.',
        expiresAt: null,
        startsAt: '2026-06-20T03:00:00.000Z',
        type: 'PAYOUT_HOLD',
      },
      providerId: 'partner-1',
      reports: [
        {
          bookingHref: '/bookings/booking-1',
          bookingLabel: 'booking-1',
          category: 'payout',
          createdAt: '2026-06-20T03:00:00.000Z',
          defaultControlType: 'ACCOUNT_BLOCK',
          details: 'Customer uploaded supporting evidence.',
          id: 'report-1',
          resolutionNote: null,
          severity: 'HIGH',
          smallLabel: 'rep-1',
          source: 'CUSTOMER',
          status: 'INVESTIGATING',
          summary: 'Partner payout complaint',
        },
      ],
      reportsDeskHref: '/partner-controls?q=partner-1',
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Reports and account controls');
    expect(rendered).toContain('State');
    expect(rendered).toContain('Control');
    expect(rendered).toContain('Timeline');
    expect(rendered).toContain('ID');
    expect(rendered).toContain('ACTIVE');
    expect(rendered).toContain('Partner payout complaint');
    expect(rendered).toContain('HIGH');
    expect(rendered).toContain('INVESTIGATING');
    expect(rendered).toContain('Report command panel');
    expect(rendered).toContain('Update report');
    expect(rendered).toContain('Apply linked control');
    expect(rendered).toContain('PAYOUT_HOLD');
    expect(rendered).toContain('Payout review pending because a customer complaint is open.');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining([
        '/partner-controls?q=partner-1',
        '/bookings/booking-1',
        '/partners/partner-1?controlAction=lift',
        '/payouts',
      ]),
    );
    const classNames = classNamesIn(section);

    expect(classNames).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-partner-detail-review-card admin-mb-16 admin-section',
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table vuexy-partner-detail-review-table',
        'vuexy-booking-table-footer vuexy-partner-detail-review-footer',
        'admin-form-select admin-form-control-labeled',
        'admin-form-date admin-form-date-picker admin-form-input-date-picker admin-form-control-labeled',
        'admin-form-textarea admin-form-control-labeled full-span',
        'admin-form-control-button button button-primary',
        'admin-form-control-link button button-secondary',
        'ops-task-card partner-report-command-grid admin-mt-16',
        'form-grid compact-form partner-report-command-form',
        'pill pill-danger',
        'admin-action-dropdown action-menu-dropdown',
      ]),
    );
    expect(classNames.filter((className) => className.startsWith('admin-form-select'))).toHaveLength(8);
    expect(classNames.filter((className) => className.startsWith('admin-form-date'))).toHaveLength(1);
    expect(classNames.filter((className) => className.startsWith('admin-form-input'))).toHaveLength(5);
    expect(classNames.filter((className) => className.includes('partner-report-form-field'))).toEqual([]);
    expect(classNames.filter((className) => className === 'admin-form-control-button button button-primary')).toHaveLength(4);
    expect(classNames.filter((className) => className.includes(' field'))).toEqual([]);
    expect(renderToStaticMarkup(section)).not.toContain('<div class="field"><span>');
    expect(renderToStaticMarkup(section)).not.toContain('<div class="field full-span"><span>');
    expect(rendered).toContain('Showing 1 to 1 of 1 entries');
  });

  it('renders an empty payout hold table when no hold is active', () => {
    const section = PartnerDetailReportsControlsSection({
      accountControls: [],
      payoutHold: null,
      providerId: 'partner-1',
      reports: [],
      reportsDeskHref: '/partner-controls?q=partner-1',
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('No payout hold');
    expect(rendered).toContain('No active payout hold is currently applied.');
    expect(rendered).toContain('No Partner reports recorded yet.');
    expect(rendered).toContain('No active or historical account control recorded yet.');
    expect(rendered).toContain('No report commands are available until a report is recorded.');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'empty-state',
        'admin-table-scroll',
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
