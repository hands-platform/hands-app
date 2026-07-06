import { PartnerDetailFinanceFollowUpSection } from './partner-detail-finance-follow-up-section';
import { readFileSync } from 'node:fs';

const sectionSource = readFileSync(new URL('./partner-detail-finance-follow-up-section.tsx', import.meta.url), 'utf8');

describe('PartnerDetailFinanceFollowUpSection', () => {
  it('uses the shared Vuexy badge atom for finance follow-up item state', () => {
    expect(sectionSource).toContain('StatusBadge');
    expect(sectionSource).not.toContain('PillClassBadge');
    expect(sectionSource).not.toContain('<span className={`pill ${pillClassForTone(row.tone)}`}>{row.title}</span>');
  });

  it('uses the shared Vuexy text-link atom instead of raw text-link classes', () => {
    expect(sectionSource).toContain('AdminTextLink');
    expect(sectionSource).not.toContain('className="text-link"');
  });

  it('uses the partner detail Vuexy table panel atom for the finance follow-up surface', () => {
    expect(sectionSource).toContain('PartnerDetailVuexyTablePanel');
    expect(sectionSource).not.toContain('AdminFilterPanel');
    expect(sectionSource).not.toContain('partnerDetailReviewCardClassName');
  });

  it('renders finance follow-up rows with Vuexy table styling', () => {
    const section = PartnerDetailFinanceFollowUpSection({
      rows: [
        {
          actionLabel: 'Collect deposit or approved offset',
          amountLabel: '250.000 VND',
          detail: 'Partner still owes HANDS from cash-service fee/tax settlement.',
          evidenceLabel: 'Negative wallet receivable',
          href: '/cash-settlements',
          id: 'negative-wallet-receivable',
          title: 'Negative wallet recovery',
          tone: 'danger',
        },
        {
          actionLabel: 'Ready for withdrawal review',
          amountLabel: '830.000 VND',
          detail: 'Positive wallet balance is available for admin-reviewed manual withdrawal.',
          evidenceLabel: 'Approved bank details',
          href: '#bank',
          id: 'withdrawal-ready',
          title: 'Withdrawal readiness',
          tone: 'success',
        },
      ],
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Partner finance follow-up');
    expect(rendered).toContain('2 active item(s)');
    expect(rendered).toContain('Negative wallet recovery');
    expect(rendered).toContain('250.000 VND');
    expect(rendered).toContain('Withdrawal readiness');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['/cash-settlements', '#bank']));
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-partner-detail-review-card admin-mb-16 admin-section',
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table vuexy-partner-detail-review-table',
        'vuexy-booking-table-footer vuexy-partner-detail-review-footer',
      ]),
    );
  });

  it('uses the shared empty-state atom for no-row messaging', () => {
    expect(sectionSource).toContain('AdminEmptyState');
    expect(sectionSource).not.toContain('<div className="empty-state">');
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
