import Link from 'next/link';

import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';

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

const unblockPlaybookHeaders = ['Step', 'Unblock item', 'Booking impact', 'Payout impact', 'Status', 'Action'];

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
      <div className="admin-mt-16">
        <AdminTableScroll>
          <AdminDataTable
            emptyMessage={<PartnerUnblockPlaybookEmptyState />}
            headers={unblockPlaybookHeaders}
            rowCount={steps.length}
          >
            {steps.map((step) => (
              <tr key={step.id}>
                <td>
                  <span className="muted">{step.step}</span>
                </td>
                <td>
                  <strong>{step.title}</strong>
                  <p className="muted">{step.detail}</p>
                </td>
                <td>
                  <span className="muted">{step.bookingImpact}</span>
                </td>
                <td>
                  <span className="muted">{step.payoutImpact}</span>
                </td>
                <td>
                  <div className="participant-list">
                    <span className={`pill ${pillClassForTone(step.tone)}`}>{step.status}</span>
                    <span className="pill pill-info">{step.owner}</span>
                  </div>
                </td>
                <td>
                  <Link className="text-link" href={step.href}>
                    {step.action}
                  </Link>
                </td>
              </tr>
            ))}
          </AdminDataTable>
        </AdminTableScroll>
      </div>
    </div>
  );
}

function PartnerUnblockPlaybookEmptyState() {
  return (
    <div className="empty-state">
      <strong>No records found</strong>
      <p className="muted">No marketplace or payout unblock steps are currently required.</p>
    </div>
  );
}
