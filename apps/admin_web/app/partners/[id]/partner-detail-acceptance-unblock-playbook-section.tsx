import Link from 'next/link';

import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import {
  PartnerDetailVuexyTableFooter,
  partnerDetailReviewCardClassName,
  partnerDetailReviewTableClassName,
} from './partner-detail-vuexy-table';

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
  const bookingBlockerCount = steps.filter((step) => step.bookingBlocked).length;

  return (
    <AdminFilterPanel
      className={`${partnerDetailReviewCardClassName} admin-mb-16`}
      description="Operator order for approval holds, settlement warnings, booking gates, and payout release. Finance warnings stay visible without hiding marketplace participation; tax stays deferred until first earning and then blocks payout, not initial dispatch."
      id="payout"
      resultLabel={`${bookingBlockerCount} booking blocker(s)`}
      resultTone={bookingBlockerCount ? 'danger' : 'success'}
      title="Partner approval, settlement, and payout playbook"
    >
      <div className="admin-mt-16">
        <AdminTableScroll>
          <AdminDataTable
            className={partnerDetailReviewTableClassName}
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
        <PartnerDetailVuexyTableFooter rowCount={steps.length} />
      </div>
    </AdminFilterPanel>
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
