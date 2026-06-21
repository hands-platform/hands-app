import {
  PartnerDetailBankPayoutGateCard,
  PartnerDetailTaxProfileCard,
} from './partner-detail-finance-gate-section';

describe('partner detail finance gate sections', () => {
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

    expect(rendered).toContain('Bank and payout gate');
    expect(rendered).toContain('Primary payout bank');
    expect(rendered).toContain('Vietcombank');
    expect(rendered).toContain('Linh Wellness');
    expect(rendered).toContain('PENDING_REVIEW');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['/partners/partner-1?reviewAction=approve-bank']));
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-partner-detail-review-card',
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table vuexy-partner-detail-review-table',
        'vuexy-booking-table-footer vuexy-partner-detail-review-footer',
        'pill pill-warn',
        'admin-action-dropdown action-menu-dropdown',
      ]),
    );
  });

  it('renders deferred tax evidence as an empty table state when no profile exists', () => {
    const section = PartnerDetailTaxProfileCard({ taxProfile: null });
    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Legacy tax profile');
    expect(rendered).toContain('DEFERRED');
    expect(rendered).toContain('No finance evidence found');
    expect(rendered).toContain('Tax profile is not required for Vietnam MVP operations.');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-partner-detail-review-card',
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table vuexy-partner-detail-review-table',
        'vuexy-booking-table-footer vuexy-partner-detail-review-footer',
        'pill pill-neutral',
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
