import { EarningsLedgerSection } from './earnings-ledger-section';

describe('EarningsLedgerSection', () => {
  it('renders recent earning ledger rows and available actions', () => {
    const section = EarningsLedgerSection({
      rows: [
        {
          bookingHref: '/bookings/booking-1',
          bookingPaymentMethod: 'CASH',
          bookingShortId: 'booking-1',
          createdAtLabel: 'Updated just now',
          feePolicyHint: 'Fee policy: manual',
          grossAmountLabel: '1.000.000 VND',
          id: 'earning-1',
          netAmountLabel: '-80.000 VND',
          netCompanyFeeHint: 'Net company fee ready',
          payoutBatchHref: null,
          payoutBatchLabel: null,
          providerName: 'Partner One',
          providerPhone: '+84900000000',
          settlementMethodLabel: 'Partner deposit',
          settlementRef: 'DEP-1',
          signalClassName: 'signal signal-warn',
          statusHint: 'Cash fee debt blocks partner wallet until settled',
          statusLabel: 'PENDING',
          taxPolicyHint: 'Tax rule ready',
          transferRef: 'MVP-partner-1',
          platformFeeLabel: '100.000 VND platform fee',
          providerProfileId: 'partner-1',
          canCreatePayout: true,
          canDirectlyPay: true,
          withholdingAmountLabel: '20.000 VND tax withheld',
          walletEntries: ['Wallet DEBIT: -80.000 VND'],
        },
      ],
    });

    const rendered = textContent(section);

    expect(section.type).toBe('div');
    expect(rendered).toContain('Recent earnings ledger');
    expect(rendered).toContain('Partner One');
    expect(rendered).toContain('Review fee settlement');
    expect(rendered).toContain('Review payout batch');
    expect(hrefsIn(section)).toContain('/bookings/booking-1');
  });

  it('renders empty state when there are no ledger rows', () => {
    const section = EarningsLedgerSection({ rows: [] });

    expect(textContent(section)).toContain('No earnings loaded.');
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
