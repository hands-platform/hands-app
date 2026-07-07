import type { AdminBookingDetail } from '../../../lib/admin-api';
import { bookingAddressRadiusContract } from './booking-address-radius-contract';
import type { bookingMarketplacePartnerSupply } from './booking-marketplace-supply';

type MarketplaceSupply = ReturnType<typeof bookingMarketplacePartnerSupply>;

function booking(input: Partial<AdminBookingDetail>): AdminBookingDetail {
  return {
    id: 'booking-address-radius-contract',
    status: 'OPEN_MATCHING',
    ...input,
  } as AdminBookingDetail;
}

function marketplaceSupply(input: Partial<MarketplaceSupply> = {}): MarketplaceSupply {
  return {
    eligibleCount: 2,
    policyPin: {
      label: 'Service address saved',
      lat: 10.762622,
      legacyDriftMeters: 12,
      lng: 106.660172,
      source: 'BookingAddressSnapshot',
    },
    radiusMeters: 10000,
    rows: [{ id: 'partner-1' }, { id: 'partner-2' }],
    ...input,
  } as MarketplaceSupply;
}

function visibleContractText(contract: ReturnType<typeof bookingAddressRadiusContract>) {
  return [
    contract.status,
    ...contract.metrics.flatMap((metric) => [metric.label, metric.value, metric.helper]),
    ...contract.cards.flatMap((card) => [card.title, card.status, card.detail, card.action]),
  ].join(' ');
}

describe('bookingAddressRadiusContract', () => {
  it('uses operator-facing confirmed address copy instead of diagnostic snapshot wording', () => {
    const contract = bookingAddressRadiusContract(
      booking({
        addressSnapshot: {
          addressText: 'District 1 address',
          createdAt: '2026-06-14T01:00:00.000Z',
          latitude: 10.762622,
          longitude: 106.660172,
        } as AdminBookingDetail['addressSnapshot'],
      }),
      marketplaceSupply(),
    );

    expect(contract.status).toBe('Confirmed address locked');
    expect(contract.metrics[0]).toMatchObject({
      label: 'Distance pin source',
      value: 'confirmed service address',
    });
    expect(contract.cards[0]).toMatchObject({
      title: 'Confirmed service address',
      status: 'Required data ready',
    });
    expect(visibleContractText(contract)).not.toMatch(/\bsnapshot\b/i);
  });
});
