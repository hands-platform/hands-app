import type { AdminProvider } from '../../lib/admin-api';
import {
  partnerHasFirstRevenueSignal,
  partnerPayoutSetupNeedsReview,
  partnerTaxNeedsReview,
  partnerTaxPillClass,
} from './partner-finance-readiness-facts';

function partner(input: Partial<AdminProvider> = {}): AdminProvider {
  return {
    id: 'partner-001',
    displayName: 'Linh Wellness',
    status: 'ONLINE_AVAILABLE',
    ...input,
  } as AdminProvider;
}

function earning(status: string) {
  return {
    id: `earning-${status}`,
    providerProfileId: 'partner-001',
    bookingId: `booking-${status}`,
    grossAmount: 500000,
    platformFee: 120000,
    withholdingAmount: 0,
    netAmount: 380000,
    currency: 'VND',
    status,
  };
}

describe('partner finance readiness facts', () => {
  it('does not require payout tax setup before the first earning signal', () => {
    const result = partner();

    expect(partnerHasFirstRevenueSignal(result)).toBe(false);
    expect(partnerPayoutSetupNeedsReview(result)).toBe(false);
    expect(partnerTaxNeedsReview(result)).toBe(false);
    expect(partnerTaxPillClass(result)).toBe('pill-neutral');
  });

  it('requires tax profile, residential address, and agreements after first earning', () => {
    const result = partner({
      earnings: [earning('PENDING')],
      taxProfile: { id: 'tax-1', status: 'APPROVED', legalName: 'Linh Wellness', registeredAddress: 'District 1' },
      residentialAddress: '',
      agreements: [{ id: 'agreement-1', type: 'SERVICE_TERMS', version: '2026-05', acceptedAt: '2026-05-21T08:00:00.000Z' }],
    });

    expect(partnerHasFirstRevenueSignal(result)).toBe(true);
    expect(partnerPayoutSetupNeedsReview(result)).toBe(true);
    expect(partnerTaxNeedsReview(result)).toBe(false);
  });

  it('marks payout setup ready when first earning requirements are complete', () => {
    const result = partner({
      earnings: [earning('AVAILABLE')],
      taxProfile: { id: 'tax-1', status: 'APPROVED', legalName: 'Linh Wellness', registeredAddress: 'District 1' },
      residentialAddress: 'District 1, Ho Chi Minh City, Vietnam',
      agreements: [
        { id: 'terms-1', type: 'SERVICE_TERMS', version: '2026-05', acceptedAt: '2026-05-21T08:00:00.000Z' },
        { id: 'terms-2', type: 'PRIVACY', version: '2026-05', acceptedAt: '2026-05-21T08:00:00.000Z' },
        { id: 'terms-3', type: 'LOCATION', version: '2026-05', acceptedAt: '2026-05-21T08:00:00.000Z' },
        { id: 'terms-4', type: 'PAYOUT', version: '2026-05', acceptedAt: '2026-05-21T08:00:00.000Z' },
        { id: 'terms-5', type: 'TAX', version: '2026-05', acceptedAt: '2026-05-21T08:00:00.000Z' },
      ],
    });

    expect(partnerPayoutSetupNeedsReview(result)).toBe(false);
    expect(partnerTaxPillClass(result)).toBe('pill-success');
  });

  it('flags rejected or pending tax profiles for finance review', () => {
    expect(
      partnerTaxNeedsReview(
        partner({
          taxProfile: { id: 'tax-1', status: 'PENDING_REVIEW', legalName: 'Linh Wellness', registeredAddress: 'District 1' },
        }),
      ),
    ).toBe(true);
    expect(
      partnerTaxPillClass(
        partner({
          taxProfile: { id: 'tax-1', status: 'REJECTED', legalName: 'Linh Wellness', registeredAddress: 'District 1' },
        }),
      ),
    ).toBe('pill-danger');
  });
});
