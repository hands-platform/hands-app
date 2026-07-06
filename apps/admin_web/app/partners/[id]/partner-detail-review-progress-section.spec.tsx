import { readFileSync } from 'node:fs';
import {
  PartnerDetailApprovalEvidenceSummarySection,
  PartnerDetailLevelPathSection,
  PartnerDetailResubmissionGuidanceSection,
  PartnerDetailReviewControlPanelSection,
  PartnerDetailReviewHistorySection,
  type PartnerApprovalEvidenceSummaryRow,
  type PartnerReviewControlPanelView,
} from './partner-detail-review-progress-section';

describe('PartnerDetailReviewControlPanelSection', () => {
  it('uses the partner detail Vuexy table panel atom for review progress shells', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-review-progress-section.tsx', 'utf8');

    expect(source).toContain('PartnerDetailVuexyTablePanel');
    expect(source).not.toContain('AdminFilterPanel');
    expect(source).not.toContain('partnerDetailReviewCardClassName');
  });

  it('uses the shared Vuexy trace summary atom for review progress metrics', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-review-progress-section.tsx', 'utf8');

    expect(source).toContain('AdminTraceSummary');
    expect(source).not.toContain('<div className="service-trace-summary admin-mt-12">');
  });

  it('uses the shared Vuexy empty-state atom', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-review-progress-section.tsx', 'utf8');

    expect(source).toContain('AdminEmptyState');
    expect(source).toContain('AdminCard');
    expect(source).toContain('AdminInlineFallback');
    expect(source).toContain('StatusBadgeFromPillClass');
    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('statusBadgeToneFromPillClass');
    expect(source).toContain('AdminTextLink');
    expect(source).not.toContain('className="text-link"');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('<strong>No records found</strong>');
    expect(source).not.toContain("<span className=\"muted\">{row.preview ?? 'No preview'}</span>");
    expect(source).not.toContain('<span className={`pill ${row.tone}`}>{row.status}</span>');
    expect(source).not.toContain(
      "<span className={`pill ${panel.reviewIssues.length ? 'pill-warn' : 'pill-success'}`}>",
    );
    expect(source).not.toContain(
      "className={`pill ${issue.severity === 'high' ? 'pill-danger' : 'pill-warn'}`}",
    );
    expect(source).not.toContain('<span className="pill pill-neutral">+{panel.reviewIssues.length - 5} more</span>');
    expect(source).not.toContain(
      '{item ? <span className={`pill ${item.tone}`}>{item.status}</span> : null}',
    );
    expect(source).not.toContain('<div className="partner-review-correction-card"');
    expect(source).not.toContain('<span className={`pill ${item.tone}`}>{item.status}</span>');
    expect(source).not.toContain('<span className={`pill ${levelPathPill(item)}`}>{item.status}</span>');
    expect(source).not.toContain(
      '<span className={`pill ${resubmissionPill(item.status)}`}>{item.status}</span>',
    );
    expect(source).not.toContain(
      '<span className={`pill ${reviewHistoryPill(row.statusLabel)}`}>{row.statusLabel}</span>',
    );
  });

  it('renders submitted dossier, hold, resubmission, and review history summary', () => {
    const section = PartnerDetailReviewControlPanelSection({
      panel: buildPanel(),
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Partner review control panel');
    expect(rendered).toContain('Partner on hold');
    expect(rendered).toContain('Current approval issues');
    expect(rendered).toContain('3 approval need(s)');
    expect(rendered).toContain('verification review');
    expect(rendered).toContain('bank MISSING');
    expect(rendered).toContain('Submitted');
    expect(rendered).toContain('Hold state');
    expect(rendered).toContain('Partner correction');
    expect(rendered).toContain('Admin gate');
    expect(rendered).toContain('Audit trail');
    expect(rendered).toContain('Open related section');
    expect(rendered).toContain('KYC identity review');
    expect(rendered).toContain('Partner must upload a clearer selfie.');
    expect(rendered).toContain('Decision area');
    expect(rendered).toContain('Status');
    expect(rendered).toContain('Operator read');
    expect(rendered).toContain('Open section');
    expect(rendered).toContain('Approval decision');
    expect(rendered).toContain('Booking access');
    expect(rendered).toContain('Settlement warning');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining([
        '#partner-connected-operations-records',
        '#partner-operator-command-queue',
        '#partner-review-history',
        '#partner-booking-gate-decision',
        '#cash-debt-origin',
      ]),
    );
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-partner-detail-review-card admin-section',
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table admin-data-table vuexy-partner-detail-review-table',
        'vuexy-booking-table-footer vuexy-partner-detail-review-footer',
        'partner-review-correction-loop',
        'card admin-card partner-review-correction-card',
        'pill pill-danger',
        'pill pill-warn',
        'pill pill-info',
      ]),
    );
  });

  it('renders compact approval evidence links while keeping finance rows separate from Level 2 approval', () => {
    const section = PartnerDetailApprovalEvidenceSummarySection({
      rows: buildApprovalEvidenceRows(),
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Partner review evidence summary');
    expect(rendered).toContain('2 approval task(s)');
    expect(rendered).toContain('Remaining');
    expect(rendered).toContain('2 item(s)');
    expect(rendered).toContain('Clear');
    expect(rendered).toContain('2 item(s)');
    expect(rendered).toContain('Next step');
    expect(rendered).toContain('KYC decision needed');
    expect(rendered).toContain('Use the linked row before account or finance follow-up.');
    expect(rendered).toContain('Required documents approved');
    expect(rendered).toContain('Withdrawal details need review');
    expect(rendered).toContain('Tax can stay deferred');
    expect(rendered).not.toContain('payout bank, and tax evidence');
    expect(rendered).toContain('Evidence');
    expect(rendered).toContain('Status');
    expect(rendered).toContain('Detail');
    expect(rendered).toContain('Action');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['#kyc', '#documents', '#bank', '#tax']));
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-partner-detail-review-card admin-section',
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table admin-data-table vuexy-partner-detail-review-table',
        'vuexy-booking-table-footer vuexy-partner-detail-review-footer',
        'pill pill-warn',
        'pill pill-success',
        'pill pill-neutral',
      ]),
    );
  });

  it('renders the partner level path as a Vuexy table', () => {
    const section = PartnerDetailLevelPathSection({
      plan: {
        currentLevel: 'Level 2',
        items: [
          {
            blocked: false,
            detail: 'Signup and KYC are complete.',
            level: 'Level 1 signup',
            operatorAction: 'No action needed.',
            ready: true,
            status: 'CLEAR',
          },
          {
            blocked: true,
            detail: 'KYC documents are still pending.',
            level: 'Level 2 activity',
            operatorAction: 'Approve required identity documents.',
            ready: false,
            status: 'REVIEW',
          },
        ],
      },
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Partner level path');
    expect(rendered).toContain('Withdrawal detail review happens when wallet withdrawal is requested.');
    expect(rendered).toContain('Level 2');
    expect(rendered).toContain('Level');
    expect(rendered).toContain('Operator action');
    expect(rendered).toContain('Level 2 activity');
    expect(rendered).toContain('Approve required identity documents.');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table admin-data-table vuexy-partner-detail-review-table',
        'vuexy-booking-table-footer vuexy-partner-detail-review-footer',
        'pill pill-success',
        'pill pill-danger',
      ]),
    );
  });

  it('renders resubmission guidance and clear empty state as Vuexy tables', () => {
    const section = PartnerDetailResubmissionGuidanceSection({
      plan: {
        items: [
          {
            operatorAction: 'Request a clearer selfie.',
            providerInstruction: 'Upload a bright selfie with your full face visible.',
            reason: 'Selfie is too dark.',
            status: 'REJECTED',
            target: 'KYC selfie',
          },
        ],
      },
    });
    const emptySection = PartnerDetailResubmissionGuidanceSection({ plan: { items: [] } });

    const rendered = normalizeSpaces(textContent(section));
    const emptyRendered = normalizeSpaces(textContent(emptySection));

    expect(rendered).toContain('Resubmission guidance');
    expect(rendered).toContain('1 item(s)');
    expect(rendered).toContain('Target');
    expect(rendered).toContain('Partner instruction');
    expect(rendered).toContain('KYC selfie');
    expect(rendered).toContain('Upload a bright selfie with your full face visible.');
    expect(emptyRendered).toContain('No records found');
    expect(emptyRendered).toContain('No resubmission request needed.');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table admin-data-table vuexy-partner-detail-review-table',
        'vuexy-booking-table-footer vuexy-partner-detail-review-footer',
        'pill pill-danger',
      ]),
    );
  });

  it('renders review history and empty state as Vuexy tables', () => {
    const section = PartnerDetailReviewHistorySection({
      totalCount: 1,
      rows: [
        {
          action: 'REJECT_KYC',
          actorLabel: 'Admin',
          atLabel: '20 Jun 2026, 09:10',
          id: 'kyc-review-log',
          preview: 'Partner must upload a clearer selfie.',
          statusLabel: 'REJECT_KYC',
          title: 'KYC identity review',
        },
      ],
    });
    const emptySection = PartnerDetailReviewHistorySection({ rows: [], totalCount: 0 });

    const rendered = normalizeSpaces(textContent(section));
    const emptyRendered = normalizeSpaces(textContent(emptySection));

    expect(rendered).toContain('Review history');
    expect(rendered).toContain('1 recent event(s)');
    expect(rendered).toContain('Review event');
    expect(rendered).toContain('Timeline');
    expect(rendered).toContain('Preview');
    expect(rendered).toContain('KYC identity review');
    expect(rendered).toContain('20 Jun 2026, 09:10');
    expect(rendered).toContain('Partner must upload a clearer selfie.');
    expect(emptyRendered).toContain('No records found');
    expect(emptyRendered).toContain('No partner review logs yet.');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table admin-data-table vuexy-partner-detail-review-table',
        'vuexy-booking-table-footer vuexy-partner-detail-review-footer',
        'pill pill-danger',
      ]),
    );
  });
});

function buildPanel(): PartnerReviewControlPanelView {
  return {
    status: 'Partner on hold',
    tone: 'pill-danger',
    metrics: [
      {
        label: 'Submitted',
        value: '20 Jun 2026, 09:00',
        helper: 'Latest KYC submission timestamp.',
      },
      {
        label: 'Hold state',
        value: 'On hold',
        helper: 'Missing bank evidence.',
      },
    ],
    reviewIssues: [
      { label: 'verification review', severity: 'high' },
      { label: 'bank MISSING', severity: 'medium' },
      { label: 'push missing', severity: 'medium' },
    ],
    items: [
      {
        detail: 'Basic identity is complete.',
        href: '#partner-connected-operations-records',
        id: 'submitted-dossier',
        label: 'SUBMIT',
        status: 'READY',
        title: 'Submitted dossier is complete',
        tone: 'pill-success',
      },
      {
        detail: 'Hold must be released or corrected before approval.',
        href: '#partner-operator-command-queue',
        id: 'approval-decision',
        label: 'APPROVE',
        status: 'HOLD',
        title: 'Approval decision',
        tone: 'pill-danger',
      },
      {
        detail:
          'Account hold blocks booking access until the correction is reviewed. Negative wallet is handled separately.',
        href: '#partner-booking-gate-decision',
        id: 'booking-access-state',
        label: 'BOOK',
        status: 'BLOCKED',
        title: 'Booking access',
        tone: 'pill-danger',
      },
      {
        detail:
          '120,000 VND company fee debt is a settlement warning. Marketplace visibility and participation stay visible, but final acceptance, service start, and payout release wait for settlement.',
        href: '#cash-debt-origin',
        id: 'settlement-warning',
        label: 'SETTLE',
        status: 'WARNING',
        title: 'Settlement warning',
        tone: 'pill-warn',
      },
      {
        detail: 'Missing bank evidence.',
        href: '#partner-operator-command-queue',
        id: 'account-hold-state',
        label: 'HOLD',
        status: 'ON HOLD',
        title: 'Active Partner hold',
        tone: 'pill-danger',
      },
      {
        detail: 'KYC identity review: Partner must upload a clearer selfie.',
        href: '#partner-review-history',
        id: 'resubmission-needs',
        label: 'FIX',
        status: '1 ITEM(S)',
        title: 'Partner resubmission needed',
        tone: 'pill-warn',
      },
      {
        detail: 'KYC rejected by Admin at 20 Jun 2026, 09:10.',
        href: '#partner-review-history',
        id: 'latest-review-event',
        label: 'LOG',
        status: 'REJECT_KYC',
        title: 'KYC identity review',
        tone: 'pill-info',
      },
    ],
  };
}

function buildApprovalEvidenceRows(): PartnerApprovalEvidenceSummaryRow[] {
  return [
    {
      detail: 'Status PENDING; CCCD/CMND ****1234; submitted 20 Jun 2026, 09:00.',
      href: '#kyc',
      id: 'kyc-evidence-summary',
      label: 'KYC',
      status: 'PENDING',
      title: 'KYC decision needed',
      tone: 'pill-warn',
    },
    {
      detail: '3/3 required document(s) approved.',
      href: '#documents',
      id: 'document-evidence-summary',
      label: 'DOCS',
      status: 'APPROVED',
      title: 'Required documents approved',
      tone: 'pill-success',
    },
    {
      detail: 'VCB / Linh Wellness / ****6789.',
      href: '#bank',
      id: 'bank-evidence-summary',
      label: 'BANK',
      status: 'PENDING',
      title: 'Withdrawal details need review',
      tone: 'pill-warn',
    },
    {
      detail: 'Partner has no first earning yet, so tax evidence does not block onboarding.',
      href: '#tax',
      id: 'tax-evidence-summary',
      label: 'TAX',
      status: 'DEFERRED',
      title: 'Tax can stay deferred',
      tone: 'pill-neutral',
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
