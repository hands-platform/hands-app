import {
  adminBookingServiceSummarySelect,
  adminProviderServiceSummarySelect,
  adminServiceCatalogSelect,
  adminServiceMutationSelect,
  adminServicePayoutRuleMutationSelect,
  adminServicePayoutRuleWithServiceSelect,
} from './admin-service-selects';

describe('admin service selects', () => {
  it('keeps booking and provider service summaries connected to active payout rules', () => {
    expect(adminBookingServiceSummarySelect.service.select.payoutRules).toMatchObject({
      where: { active: true },
      orderBy: { customerPrice: 'asc' },
      select: expect.objectContaining({ customerPrice: true, providerPayoutAmount: true }),
    });
    expect(adminProviderServiceSummarySelect.service.select.payoutRules.select).toBe(
      adminBookingServiceSummarySelect.service.select.payoutRules.select,
    );
  });

  it('keeps the service catalog bounded while exposing operational booking context', () => {
    expect(adminServiceCatalogSelect.providers).toMatchObject({
      take: 50,
      select: expect.objectContaining({ providerProfileId: true, active: true }),
    });
    expect(adminServiceCatalogSelect.bookings).toMatchObject({
      take: 8,
      select: expect.objectContaining({ booking: expect.any(Object) }),
    });
    expect(adminServiceCatalogSelect._count).toMatchObject({
      select: { providers: true, bookings: true },
    });
  });

  it('keeps mutation selects reusable for service payout rule writes', () => {
    expect(adminServiceMutationSelect.payoutRules).toMatchObject({
      select: adminServicePayoutRuleMutationSelect,
    });
    expect(adminServicePayoutRuleWithServiceSelect).toMatchObject({
      service: { select: adminServiceMutationSelect },
    });
  });
});
