import { readFileSync } from 'node:fs';
import {
  PartnerDetailAgreementsCard,
  PartnerDetailBasicProfileCard,
  PartnerDetailLocationActivityCard,
  PartnerDetailRecentPayoutRecordsCard,
} from './partner-detail-profile-finance-summary-section';

describe('partner detail profile and location sections', () => {
  it('uses the partner detail Vuexy table panel atom for profile and finance shells', () => {
    const source = readFileSync(
      'app/partners/[id]/partner-detail-profile-finance-summary-section.tsx',
      'utf8',
    );

    expect(source).toContain('PartnerDetailVuexyTablePanel');
    expect(source).not.toContain('AdminFilterPanel');
    expect(source).not.toContain('partnerDetailReviewCardClassName');
  });

  it('uses the shared Vuexy empty-state atom', () => {
    const source = readFileSync(
      'app/partners/[id]/partner-detail-profile-finance-summary-section.tsx',
      'utf8',
    );

    expect(source).toContain('AdminEmptyState');
    expect(source).toContain('AdminInlineFallback');
    expect(source).toContain('StatusBadge');
    expect(source).toContain('DateTimeText');
    expect(source).not.toContain('<strong>No profile evidence found</strong>');
    expect(source).not.toContain('<span className="muted">Missing</span>');
    expect(source).not.toContain('<span className="pill pill-success">ACCEPTED</span>');
    expect(source).not.toContain('<span className="pill pill-neutral" key={snapshot.id}>');
  });

  it('renders the basic profile as a compact evidence table', () => {
    const section = PartnerDetailBasicProfileCard({
      note: 'Partner prefers evening bookings.',
      rows: [
        { label: 'Display name', value: 'Linh Wellness' },
        { label: 'Phone', value: '+84900000000' },
        { dateValue: '2026-06-13T03:15:00.000Z', label: 'Next available' },
      ],
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Basic profile');
    expect(rendered).toContain('3 field(s)');
    expect(rendered).toContain('Display name');
    expect(rendered).toContain('Linh Wellness');
    expect(rendered).toContain('13 Jun 2026, 10:15');
    expect(rendered).toContain('Operator note');
    expect(rendered).toContain('Partner prefers evening bookings.');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-partner-detail-review-card admin-section',
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table admin-data-table vuexy-partner-detail-review-table',
        'vuexy-booking-table-footer vuexy-partner-detail-review-footer',
        'partner-detail-note admin-mt-12',
      ]),
    );
  });

  it('renders latest location evidence and snapshots in the same table pattern', () => {
    const section = PartnerDetailLocationActivityCard({
      coordinatesLabel: '21.02776, 105.83416',
      lastLocationLabel: '20 Jun 2026, 10:30',
      snapshots: [
        { id: 'loc-1', label: '20 Jun 2026, 10:30', recordedAt: '2026-06-20T03:30:00.000Z' },
        { id: 'loc-2', label: '20 Jun 2026, 09:15', recordedAt: '2026-06-20T02:15:00.000Z' },
      ],
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Location and activity');
    expect(rendered).toContain('2 snapshot(s)');
    expect(rendered).toContain('Last location');
    expect(rendered).toContain('Location evidence');
    expect(rendered).toContain('Recent snapshots');
    expect(rendered).toContain('20 Jun 2026, 10:30');
    expect(rendered).toContain('20 Jun 2026, 09:15');
    expect(rendered).toContain('Partner location saved for dispatch checks.');
    expect(rendered).not.toContain('21.02776, 105.83416');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-partner-detail-review-card admin-section',
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table admin-data-table vuexy-partner-detail-review-table',
        'vuexy-booking-table-footer vuexy-partner-detail-review-footer',
        'pill pill-neutral',
      ]),
    );
  });

  it('keeps the profile location timestamp on the shared DateTimeText atom', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-profile-finance-summary-section.tsx', 'utf8');
    const pageSource = readFileSync('app/partners/[id]/page.tsx', 'utf8');

    expect(source).toContain('readonly lastLocationLabel?: ReactNode;');
    expect(pageSource).toContain('<DateTimeText fallback="Missing" value={provider.currentLocationUpdatedAt} />');
    expect(pageSource).not.toContain(
      'lastLocationLabel={\\n                provider.currentLocationUpdatedAt ? formatDate(provider.currentLocationUpdatedAt) : null\\n              }',
    );
  });

  it('renders accepted agreements as table rows', () => {
    const section = PartnerDetailAgreementsCard({
      agreements: [
        { id: 'agreement-1', label: 'Partner Terms v1' },
        { id: 'agreement-2', label: 'Privacy Policy v2' },
      ],
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Agreements');
    expect(rendered).toContain('2 accepted');
    expect(rendered).toContain('Partner Terms v1');
    expect(rendered).toContain('Privacy Policy v2');
    expect(rendered).toContain('ACCEPTED');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-partner-detail-review-card admin-section',
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table admin-data-table vuexy-partner-detail-review-table',
        'vuexy-booking-table-footer vuexy-partner-detail-review-footer',
        'pill pill-success',
      ]),
    );
  });

  it('renders recent payout evidence as summary and earning rows', () => {
    const section = PartnerDetailRecentPayoutRecordsCard({
      earningCount: 3,
      earnings: [
        {
          id: 'earning-1',
          label: 'COMPLETED: gross 400,000 VND / withholding 20,000 VND / net 380,000 VND',
        },
      ],
      payoutBatchCount: 1,
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Recent payout records');
    expect(rendered).toContain('3 earning(s)');
    expect(rendered).toContain('Recent earnings');
    expect(rendered).toContain('Recent payout batches');
    expect(rendered).toContain('COMPLETED: gross 400,000 VND');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-partner-detail-review-card admin-section',
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table admin-data-table vuexy-partner-detail-review-table',
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
