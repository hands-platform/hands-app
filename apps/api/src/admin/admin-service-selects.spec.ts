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

  it('keeps the service catalog lightweight for the Admin service menu page', () => {
    expect(adminServiceCatalogSelect.payoutRules).toMatchObject({
      orderBy: [{ active: 'desc' }, { customerPrice: 'asc' }],
      select: expect.objectContaining({ customerPrice: true, providerPayoutAmount: true }),
    });
    expect(adminServiceCatalogSelect).not.toHaveProperty('providers');
    expect(adminServiceCatalogSelect).not.toHaveProperty('bookings');
    expect(adminServiceCatalogSelect).not.toHaveProperty('_count');
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
