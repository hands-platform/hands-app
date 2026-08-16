import { ProviderOnboardingController } from './provider-onboarding.controller';

describe('ProviderOnboardingController admin tax policy listing', () => {
  it('passes pagination query values to the onboarding service', () => {
    const onboarding = {
      listTaxPolicyVersions: vi.fn().mockReturnValue([]),
    };
    const controller = new ProviderOnboardingController(onboarding as never);

    controller.taxPolicyVersions('20', '40');

    expect(onboarding.listTaxPolicyVersions).toHaveBeenCalledWith(
      expect.objectContaining({ skip: '40', take: '20' }),
    );
  });

  it('passes the authenticated operator and simulation inputs to the service', () => {
    const onboarding = {
      simulateTaxPolicyVersion: vi.fn().mockReturnValue({ amount: 25_000 }),
    };
    const controller = new ProviderOnboardingController(onboarding as never);

    controller.simulateTaxPolicyVersion({ id: 'admin-1' } as never, 'policy-1', '500000', 'leg_massage');

    expect(onboarding.simulateTaxPolicyVersion).toHaveBeenCalledWith('admin-1', 'policy-1', {
      grossAmount: '500000',
      serviceType: 'leg_massage',
    });
  });

  it('scopes the integrity summary to the authenticated operator', () => {
    const onboarding = { taxPolicyIntegritySummary: vi.fn().mockReturnValue({ total: 0 }) };
    const controller = new ProviderOnboardingController(onboarding as never);

    controller.taxPolicyIntegritySummary({ id: 'admin-1' } as never);

    expect(onboarding.taxPolicyIntegritySummary).toHaveBeenCalledWith('admin-1');
  });

  it('passes exact audit event and evidence source filters to the service', () => {
    const onboarding = { listTaxPolicyAuditLogs: vi.fn().mockReturnValue({ items: [] }) };
    const controller = new ProviderOnboardingController(onboarding as never);

    controller.taxPolicyAuditLogs(
      { id: 'admin-1' } as never,
      'tax_policy.activated',
      'checker-1',
      'audit-1',
      '2026-08-01',
      'policy-1',
      'production',
      '1',
      '0',
      '2026-08-14',
    );

    expect(onboarding.listTaxPolicyAuditLogs).toHaveBeenCalledWith('admin-1', {
      action: 'tax_policy.activated',
      actorId: 'checker-1',
      eventId: 'audit-1',
      from: '2026-08-01',
      policyVersionId: 'policy-1',
      skip: '0',
      source: 'production',
      take: '1',
      to: '2026-08-14',
    });
  });

  it('passes integrity source, date, sort, and pagination filters to the service', () => {
    const onboarding = { taxPolicyIntegrityRecords: vi.fn().mockReturnValue({ items: [] }) };
    const controller = new ProviderOnboardingController(onboarding as never);

    controller.taxPolicyIntegrityRecords(
      { id: 'admin-1' } as never,
      '2026-08-01',
      'amount-mismatch',
      'newest',
      'production',
      '25',
      '50',
      '2026-08-14',
    );

    expect(onboarding.taxPolicyIntegrityRecords).toHaveBeenCalledWith('admin-1', {
      from: '2026-08-01',
      issue: 'amount-mismatch',
      skip: '50',
      sort: 'newest',
      source: 'production',
      take: '25',
      to: '2026-08-14',
    });
  });
});
