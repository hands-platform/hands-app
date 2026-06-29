import { ProviderOnboardingController } from './provider-onboarding.controller';

describe('ProviderOnboardingController admin tax policy listing', () => {
  it('passes pagination query values to the onboarding service', () => {
    const onboarding = {
      listTaxPolicyVersions: vi.fn().mockReturnValue([]),
    };
    const controller = new ProviderOnboardingController(onboarding as never);

    controller.taxPolicyVersions('20', '40');

    expect(onboarding.listTaxPolicyVersions).toHaveBeenCalledWith({ skip: '40', take: '20' });
  });
});
