import { readFileSync } from 'node:fs';
import { PartnerDetailKycDecisionSection } from './partner-detail-kyc-decision-section';

describe('PartnerDetailKycDecisionSection', () => {
  it('uses the partner detail Vuexy table panel atom for the KYC decision shell', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-kyc-decision-section.tsx', 'utf8');

    expect(source).toContain('PartnerDetailVuexyTablePanel');
    expect(source).not.toContain('AdminFilterPanel');
    expect(source).not.toContain('partnerDetailReviewCardClassName');
  });

  it('uses the shared Vuexy trace summary atom for KYC correction guidance', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-kyc-decision-section.tsx', 'utf8');

    expect(source).toContain('AdminTraceSummary');
    expect(source).not.toContain('<div className="service-trace-summary admin-mt-12">');
  });

  it('uses the shared Vuexy empty-state atom', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-kyc-decision-section.tsx', 'utf8');

    expect(source).toContain('AdminFilterChipGroup');
    expect(source).toContain('AdminEmptyState');
    expect(source).toContain('AdminInlineFallback');
    expect(source).toContain('StatusBadgeFromPillClass');
    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('statusBadgeToneFromPillClass');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('<div className="participant-list');
    expect(source).not.toContain('<strong>No records found</strong>');
    expect(source).not.toContain("<span className={`pill ${item.ok ? 'pill-success' : 'pill-danger'}`}>");
    expect(source).not.toContain('<span className={`pill ${kycEvidencePill(row.status)}`}>{row.status}</span>');
    expect(source).not.toContain('<span className="muted">No rejection note</span>');
  });

  it('uses the shared date time atom for evidence upload timestamps', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-kyc-decision-section.tsx', 'utf8');
    const pageSource = readFileSync('app/partners/[id]/page.tsx', 'utf8');

    expect(source).toContain('DateTimeText');
    expect(source).toContain('readonly reviewedLabel: ReactNode;');
    expect(source).toContain('readonly submittedLabel: ReactNode;');
    expect(pageSource).toContain('reviewedLabel={<DateTimeText fallback="Missing" value={provider.kyc?.reviewedAt} />}');
    expect(pageSource).toContain('submittedLabel={<DateTimeText fallback="Missing" value={provider.kyc?.submittedAt} />}');
    expect(source).not.toContain("import { formatDate } from './partner-detail-format';");
    expect(source).not.toContain("{row.uploadedAt ? formatDate(row.uploadedAt) : 'Missing'}");
    expect(pageSource).not.toContain('reviewedLabel={formatDate(provider.kyc?.reviewedAt)}');
    expect(pageSource).not.toContain('submittedLabel={formatDate(provider.kyc?.submittedAt)}');
  });

  it('prefers shared detail nodes for checklist timestamps', () => {
    const section = PartnerDetailKycDecisionSection({
      canApprove: true,
      cccdNumberLast4: '1234',
      evidence: {
        allRequiredApproved: true,
        decisionChecklist: [
          {
            detail: 'Fallback submitted date text',
            detailNode: <span>Shared submitted date marker</span>,
            label: 'KYC record submitted',
            ok: true,
          },
        ],
        nextAction: 'No KYC action required.',
        rows: [],
      },
      rejectionReason: null,
      reviewActions: [],
      reviewedLabel: 'Missing',
      status: 'APPROVED',
      submittedLabel: 'Missing',
    });
    const rendered = normalizeSpaces(textContent(section));
    const source = readFileSync('app/partners/[id]/partner-detail-kyc-decision-section.tsx', 'utf8');
    const pageSource = readFileSync('app/partners/[id]/page.tsx', 'utf8');

    expect(rendered).toContain('Shared submitted date marker');
    expect(rendered).not.toContain('Fallback submitted date text');
    expect(source).toContain('readonly detailNode?: ReactNode;');
    expect(source).toContain('item.detailNode ?? item.detail');
    expect(pageSource).toContain('Submitted <DateTimeText fallback="Missing" value={provider.kyc?.submittedAt} />.');
  });

  it('renders KYC checklist and evidence as Vuexy tables', () => {
    const section = PartnerDetailKycDecisionSection({
      canApprove: false,
      cccdNumberLast4: '1234',
      evidence: {
        allRequiredApproved: false,
        decisionChecklist: [
          {
            detail: 'CCCD front is approved.',
            label: 'CCCD front',
            ok: true,
          },
          {
            detail: 'Selfie is pending review.',
            label: 'Selfie',
            ok: false,
          },
        ],
        nextAction: 'Approve required evidence before final KYC decision.',
        rows: [
          {
            fileLabel: 'cccd-front.jpg',
            label: 'CCCD front',
            status: 'APPROVED',
            type: 'CCCD_FRONT',
            uploadedAt: '2026-06-20T09:00:00.000Z',
          },
          {
            fileLabel: 'selfie.jpg',
            label: 'Selfie',
            rejectionReason: 'Face is unclear.',
            status: 'REJECTED',
            type: 'SELFIE',
            uploadedAt: '2026-06-20T09:10:00.000Z',
          },
        ],
      },
      rejectionReason: 'Selfie image is too dark.',
      reviewActions: [
        {
          href: '/partners/partner-1?reviewAction=approve-kyc',
          kind: 'link',
          label: 'Approve KYC',
        },
      ],
      reviewedLabel: 'Missing',
      status: 'PENDING_REVIEW',
      submittedLabel: '20 Jun 2026, 09:00',
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('KYC decision');
    expect(rendered).toContain('KYC PENDING_REVIEW');
    expect(rendered).toContain('Evidence incomplete');
    expect(rendered).toContain('CCCD last 4: ****1234');
    expect(rendered).toContain('Gate');
    expect(rendered).toContain('Outcome');
    expect(rendered).toContain('Evidence');
    expect(rendered).toContain('Uploaded');
    expect(rendered).toContain('Review note');
    expect(rendered).toContain('Selfie is pending review.');
    expect(rendered).toContain('Rejection: Face is unclear.');
    expect(rendered).toContain('Partner app correction: Selfie image is too dark.');
    expect(rendered).toContain('Partner app correction guidance');
    expect(rendered).toContain(
      'Reject KYC only when the Partner must resubmit. The reason appears in the Partner app correction checklist.',
    );
    expect(rendered).toContain('Approve required evidence before final KYC decision.');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['/partners/partner-1?reviewAction=approve-kyc']));
    expect(readRecord(resolveElement(section))?.props).toMatchObject({ id: 'kyc' });
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-partner-detail-review-card admin-section',
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table admin-data-table vuexy-partner-detail-review-table',
        'vuexy-booking-table-footer vuexy-partner-detail-review-footer',
        'admin-action-dropdown action-menu-dropdown',
        'pill pill-success',
        'pill pill-danger',
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
