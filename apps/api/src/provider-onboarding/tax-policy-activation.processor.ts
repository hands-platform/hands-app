import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ProviderOnboardingService } from './provider-onboarding.service';
import {
  TAX_POLICY_ACTIVATION_JOB_NAME,
  TAX_POLICY_ACTIVATION_QUEUE_NAME,
  TAX_POLICY_ACTIVATION_SWEEP_JOB_NAME,
  type TaxPolicyActivationJob,
} from './tax-policy-activation.queue';

@Processor(TAX_POLICY_ACTIVATION_QUEUE_NAME)
export class TaxPolicyActivationProcessor extends WorkerHost {
  constructor(private readonly onboarding: ProviderOnboardingService) {
    super();
  }

  async process(job: Job<TaxPolicyActivationJob>) {
    if (job.name === TAX_POLICY_ACTIVATION_JOB_NAME && job.data.policyVersionId) {
      return await this.onboarding.activateTaxPolicyVersion(
        job.data.policyVersionId,
        job.data.approvalRequestId,
      );
    }
    if (job.name === TAX_POLICY_ACTIVATION_SWEEP_JOB_NAME) {
      return await this.onboarding.activateDueTaxPolicies();
    }
    return { skipped: true, reason: 'unknown-job' };
  }
}
