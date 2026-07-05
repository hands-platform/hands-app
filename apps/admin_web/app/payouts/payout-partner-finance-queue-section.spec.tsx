import { PayoutPartnerFinanceQueueSection } from './payout-partner-finance-queue-section';
import { readFileSync } from 'node:fs';

const sectionSource = readFileSync(new URL('./payout-partner-finance-queue-section.tsx', import.meta.url), 'utf8');

describe('PayoutPartnerFinanceQueueSection', () => {
  it('renders partner finance queue rows with partner, amount, evidence, and links', () => {
    const section = PayoutPartnerFinanceQueueSection({
      rows: [
        {
          actionLabel: 'Request corrected bank details',
          amountLabel: '750.000 VND',
          batchId: 'batch-1',
          detail: 'Bank proof does not match.',
          evidenceLabel: 'VCB / Blocked Partner',
          href: '/partners/provider-1#bank',
          id: 'batch-1-bank-correction',
          partnerLabel: 'Blocked Partner',
          title: 'Bank correction required',
          tone: 'danger',
        },
      ],
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Partner finance queue');
    expect(rendered).toContain('1 item(s)');
    expect(rendered).toContain('Blocked Partner');
    expect(rendered).toContain('750.000 VND');
    expect(rendered).toContain('Bank correction required');
    expect(hrefsIn(section)).toContain('/partners/provider-1#bank');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group payout-partner-finance-queue-section admin-mb-16 admin-section',
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table',
      ]),
    );
  });

  it('uses the shared empty-state atom for no-row messaging', () => {
    expect(sectionSource).toContain('AdminTablePanel');
    expect(sectionSource).toContain('AdminEmptyState');
    expect(sectionSource).toContain('AdminTextLink');
    expect(sectionSource).not.toContain('className="text-link"');
    expect(sectionSource).not.toContain('className="payout-partner-finance-queue-section admin-mb-16 vuexy-booking-table-card vuexy-booking-table-group"');
    expect(sectionSource).not.toContain('<div className="empty-state">');
  });

  it('uses the shared badge atom for finance signal tones', () => {
    expect(sectionSource).toContain('StatusBadge');
    expect(sectionSource).toContain('badgeToneForQueueTone');
    expect(sectionSource).not.toContain('<span className={`pill ${pillClassForTone(row.tone)}`}>{row.title}</span>');
    expect(sectionSource).not.toContain('function pillClassForTone');
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
