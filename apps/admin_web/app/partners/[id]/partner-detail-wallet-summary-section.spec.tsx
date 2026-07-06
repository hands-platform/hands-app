import { readFileSync } from 'node:fs';
import { PartnerDetailWalletSummarySection } from './partner-detail-wallet-summary-section';

describe('PartnerDetailWalletSummarySection', () => {
  it('uses the shared Vuexy trace summary atom for wallet metrics', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-wallet-summary-section.tsx', 'utf8');

    expect(source).toContain('AdminTraceSummary');
    expect(source).not.toContain('<div className="service-trace-summary admin-mt-12 partner-wallet-summary-grid">');
  });

  it('uses shared Vuexy status badges for wallet allocation chips', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-wallet-summary-section.tsx', 'utf8');

    expect(source).toContain('<StatusBadge');
    expect(source).not.toContain('<span className="pill pill-success">');
    expect(source).not.toContain('<span className="pill pill-info">');
  });

  it('uses the shared date time atom for visible ledger timestamps', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-wallet-summary-section.tsx', 'utf8');

    expect(source).toContain('DateTimeText');
    expect(source).not.toContain('formatDate,');
    expect(source).not.toContain('{formatDate(row.createdAt)}');
  });

  it('uses the shared money atom for visible wallet summary and ledger amounts', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-wallet-summary-section.tsx', 'utf8');

    expect(source).toContain('MoneyText');
    expect(source).toContain('<MoneyText amount={summary.negativeWalletReceivable} currency={summary.currency} />');
    expect(source).toContain('<MoneyText amount={summary.currentBalance} currency={summary.currency} />');
    expect(source).toContain('<MoneyText amount={row.amount} currency={row.currency} />');
    expect(source).not.toContain('formatCurrency(summary.negativeWalletReceivable');
    expect(source).not.toContain('<strong>{formatCurrency(summary.currentBalance, summary.currency)}</strong>');
    expect(source).not.toContain('<strong>{formatCurrency(row.amount, row.currency)}</strong>');
    expect(source).toContain('AdminInlineFallback');
    expect(source).not.toContain("<p className=\"muted\">{row.reference ? `Reference ${row.reference}` : 'No reference saved'}</p>");
  });

  it('renders partner wallet cards and visible ledger rows as a Vuexy table', () => {
    const section = PartnerDetailWalletSummarySection({
      summary: {
        appliedToNegativeWallet: 170_000,
        cashCompanyVatDeductions: 9_481,
        cashPartnerTaxDeductions: 42_000,
        cashPlatformFeeDeductions: 118_519,
        currency: 'VND',
        currentBalance: 830_000,
        manualAdjustmentCount: 0,
        manualBankDeposits: 1_000_000,
        negativeWalletReceivable: 0,
        partnerWalletLiability: 830_000,
        recordedAsPrepaidBalance: 830_000,
        reviewTone: 'success',
        visibleLedgerRows: [
          {
            amount: 1_000_000,
            createdAt: '2026-06-20T04:00:00.000Z',
            currency: 'VND',
            id: 'deposit-1',
            reference: 'VCB-20260620',
            type: 'PARTNER_BANK_DEPOSIT_RECEIVED',
          },
          {
            amount: -118_519,
            createdAt: '2026-06-18T04:00:00.000Z',
            currency: 'VND',
            id: 'fee-1',
            notes: 'Cash service platform fee collected.',
            type: 'CASH_BOOKING_PLATFORM_FEE_DEDUCTED',
          },
        ],
      },
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Partner wallet detail');
    expect(rendered).toContain('Current balance');
    expect(rendered).toContain('830.000 VND');
    expect(rendered).toContain('Bank deposits');
    expect(rendered).toContain('Negative wallet cleared');
    expect(rendered).toContain('Cash-service deductions');
    expect(rendered).toContain('PARTNER_BANK_DEPOSIT_RECEIVED');
    expect(rendered).toContain('VCB-20260620');
    expect(rendered).toContain('Cash service platform fee collected.');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-partner-detail-review-card admin-mb-16 admin-section',
        'service-trace-summary admin-mt-12 partner-wallet-summary-grid',
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table vuexy-partner-detail-review-table',
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
