import { readFileSync } from 'node:fs';

import {
  PartnerDetailBankPayoutGateCard,
  PartnerDetailTaxProfileCard,
} from './partner-detail-finance-gate-section';

describe('partner detail finance gate sections', () => {
  it('uses the partner detail Vuexy table panel atom for finance gate shells', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-finance-gate-section.tsx', 'utf8');

    expect(source).toContain('PartnerDetailVuexyTablePanel');
    expect(source).not.toContain('AdminFilterPanel');
    expect(source).not.toContain('partnerDetailReviewCardClassName');
  });

  it('uses the shared Vuexy badge atom for finance evidence status pills', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-finance-gate-section.tsx', 'utf8');

    expect(source).toContain('AdminInlineFallback');
    expect(source).toContain('renderEvidenceValue');
    expect(source).not.toContain("value ?? 'Missing'");
    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('<span className={`pill ${financeEvidenceStatusTone(bank.status)}`}>');
    expect(source).not.toContain('<span className={`pill ${financeEvidenceStatusTone(taxProfile.status)}`}>');
  });

  it('uses the shared date time atom for withdrawal evidence timestamps', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-finance-gate-section.tsx', 'utf8');
    const pageSource = readFileSync('app/partners/[id]/page.tsx', 'utf8');

    expect(source).toContain('DateTimeText');
    expect(source).not.toContain('readonly reviewedAtLabel?: string | null;');
    expect(source).not.toContain('readonly submittedAtLabel?: string | null;');
    expect(source).not.toContain('readonly updatedAtLabel?: string | null;');
    expect(pageSource).not.toContain('reviewedAtLabel: bank.reviewedAt ? formatDate(bank.reviewedAt) : null');
    expect(pageSource).not.toContain('submittedAtLabel: bank.createdAt ? formatDate(bank.createdAt) : null');
    expect(pageSource).not.toContain('updatedAtLabel: bank.updatedAt ? formatDate(bank.updatedAt) : null');
  });

  it('renders bank payout evidence in a Vuexy table with dropdown actions', () => {
    const section = PartnerDetailBankPayoutGateCard({
      bank: {
        accountLabel: '****6789',
        bankName: 'Vietcombank',
        holderName: 'Linh Wellness',
        rejectionReason: null,
        reviewActions: [
          {
            href: '/partners/partner-1?reviewAction=approve-bank',
            kind: 'link',
            label: 'Approve bank',
            tone: 'success',
          },
        ],
        status: 'PENDING_REVIEW',
      },
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Withdrawal details');
    expect(rendered).toContain('Manual wallet withdrawal/deposit evidence');
    expect(rendered).toContain('Primary withdrawal bank');
    expect(rendered).toContain('Used by operators for manual wallet withdrawal/deposit checks.');
    expect(rendered).toContain('Vietcombank');
    expect(rendered).toContain('Linh Wellness');
    expect(rendered).toContain('Pending review');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['/partners/partner-1?reviewAction=approve-bank']));
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-partner-detail-review-card admin-section',
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table admin-data-table vuexy-partner-detail-review-table',
        'vuexy-booking-table-footer vuexy-partner-detail-review-footer',
        'pill pill-warn',
        'admin-action-dropdown action-menu-dropdown',
      ]),
    );
  });

  it('renders deferred tax evidence as an empty table state when no profile exists', () => {
    const section = PartnerDetailTaxProfileCard({ taxProfile: null });
    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Tax profile optional');
    expect(rendered).toContain('Review postponed');
    expect(rendered).toContain('No finance evidence found');
    expect(rendered).toContain('Tax profile is not required for Vietnam MVP operations.');
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

  it('keeps missing withdrawal details neutral until the wallet flow requests them', () => {
    const section = PartnerDetailBankPayoutGateCard({ bank: null });
    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Withdrawal details');
    expect(rendered).toContain('Available on request');
    expect(rendered).toContain('No withdrawal details found');
    expect(rendered).toContain('Collect bank details when the Partner requests wallet withdrawal/deposit or manual settlement.');
    expect(rendered).not.toContain('MISSING');
    expect(classNamesIn(section)).toEqual(expect.arrayContaining(['pill pill-neutral']));
  });

  it('surfaces bank correction and resubmission review states for finance operators', () => {
    const rejectedSection = PartnerDetailBankPayoutGateCard({
      bank: {
        accountLabel: '****6789',
        bankName: 'Vietcombank',
        holderName: 'Linh Wellness',
        rejectionReason: 'Account holder mismatch.',
        reviewActions: [],
        reviewStateDetail:
          'Partner app shows the rejection reason until corrected bank details are submitted again.',
        reviewStateLabel: 'Correction requested',
        status: 'REJECTED',
      },
    });
    const pendingSection = PartnerDetailBankPayoutGateCard({
      bank: {
        accountLabel: '****9876',
        bankName: 'Techcombank',
        holderName: 'Linh Wellness',
        rejectionReason: null,
        reviewActions: [],
        reviewStateDetail:
          'Partner submitted bank details after a previous correction request. Review before manual payout.',
        reviewStateLabel: 'Bank correction submitted',
        status: 'PENDING_REVIEW',
      },
    });

    expect(normalizeSpaces(textContent(rejectedSection))).toContain(
      'Correction requested Partner app shows the rejection reason until corrected bank details are submitted again.',
    );
    expect(normalizeSpaces(textContent(pendingSection))).toContain(
      'Bank correction submitted Partner submitted bank details after a previous correction request. Review before manual payout.',
    );
  });

  it('renders bank correction audit history as a compact Vuexy timeline', () => {
    const section = PartnerDetailBankPayoutGateCard({
      bank: {
        accountLabel: '****9876',
        bankName: 'Techcombank',
        holderName: 'Linh Wellness',
        rejectionReason: null,
        reviewActions: [],
        reviewTimeline: [
          {
            actorLabel: 'Admin Hoa',
            atLabel: '20 Jun 2026, 10:00',
            detail: 'Reason: account holder mismatch.',
            id: 'bank-log-1',
            title: 'Correction requested',
            tone: 'danger',
          },
          {
            actorLabel: 'Partner app',
            atLabel: '21 Jun 2026, 09:00',
            detail: 'Partner submitted corrected bank details.',
            id: 'bank-log-2',
            title: 'Bank correction submitted',
            tone: 'info',
          },
        ],
        status: 'PENDING_REVIEW',
      },
    });
    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Bank review timeline');
    expect(rendered).toContain('Correction requested 20 Jun 2026, 10:00 Reason: account holder mismatch. Actor Admin Hoa');
    expect(rendered).toContain('Bank correction submitted 21 Jun 2026, 09:00 Partner submitted corrected bank details. Actor Partner app');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'vuexy-basic-timeline partner-bank-review-timeline admin-mt-16',
        'vuexy-basic-timeline-dot is-danger',
        'vuexy-basic-timeline-dot is-info',
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
