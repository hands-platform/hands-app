import Link from 'next/link';

type PartnerOpsTone = 'done' | 'pending' | 'blocked';

export type PartnerAcceptanceUnblockStep = {
  id: string;
  step: string;
  owner: 'Finance' | 'Account' | 'KYC' | 'Dispatch' | 'Ops';
  title: string;
  status: string;
  detail: string;
  bookingImpact: string;
  payoutImpact: string;
  action: string;
  href: string;
  tone: PartnerOpsTone;
  bookingBlocked: boolean;
};

type PartnerDetailAcceptanceUnblockPlaybookSectionProps = {
  pillClassForTone: (tone: PartnerOpsTone) => string;
  steps: PartnerAcceptanceUnblockStep[];
};

export function PartnerDetailAcceptanceUnblockPlaybookSection({
  pillClassForTone,
  steps,
}: PartnerDetailAcceptanceUnblockPlaybookSectionProps) {
  const marketplaceBlockerCount = steps.filter((step) => step.bookingBlocked).length;

  return (
    <div className="card admin-mb-16" id="payout">
      <div className="ops-section-header">
        <div>
          <h2>Partner marketplace/payout unblock playbook</h2>
          <p className="muted">
            Operator order for restoring this partner&apos;s marketplace and payout gates. Finance and
            account-control blockers stay first; tax stays deferred until first earning and then blocks
            payout, not initial dispatch.
          </p>
        </div>
        <span className={`pill ${marketplaceBlockerCount ? 'pill-danger' : 'pill-success'}`}>
          {marketplaceBlockerCount} marketplace blocker(s)
        </span>
      </div>
      <div className="setup-stage-list admin-mt-16">
        {steps.map((step) => (
          <div className="setup-stage-item" key={step.id}>
            <span>{step.step}</span>
            <div>
              <strong>{step.title}</strong>
              <p className="muted">{step.detail}</p>
              <p className="muted">
                <strong>Booking:</strong> {step.bookingImpact}
              </p>
              <p className="muted">
                <strong>Payout:</strong> {step.payoutImpact}
              </p>
              <div className="participant-list">
                <span className={`pill ${pillClassForTone(step.tone)}`}>{step.status}</span>
                <span className="pill pill-info">{step.owner}</span>
              </div>
            </div>
            <Link className="text-link" href={step.href}>
              {step.action}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
