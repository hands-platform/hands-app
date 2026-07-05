import type { ReactNode } from 'react';

import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { AdminEmptyState } from '../../../components/admin-empty-state';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import { StatusBadge } from '../../../components/status-badge';
import {
  PartnerDetailVuexyTableFooter,
  partnerDetailReviewCardClassName,
  partnerDetailReviewTableClassName,
} from './partner-detail-vuexy-table';

type PartnerReadinessItem = {
  detail: string;
  detailNode?: ReactNode;
  label: string;
  ok: boolean;
  status: string;
};

type PartnerApprovalChecklist = {
  blockers: number;
  items: PartnerReadinessItem[];
  ready: boolean;
};

type PartnerRegistrationDossierItem = PartnerReadinessItem & {
  operatorAction: string;
};

type PartnerRegistrationDossier = {
  blockers: number;
  items: PartnerRegistrationDossierItem[];
  ready: boolean;
};

type PartnerDetailApprovalChecklistSectionProps = {
  checklist: PartnerApprovalChecklist;
};

type PartnerDetailRegistrationDossierSectionProps = {
  dossier: PartnerRegistrationDossier;
};

export function PartnerDetailApprovalChecklistSection({
  checklist,
}: PartnerDetailApprovalChecklistSectionProps) {
  return (
    <AdminFilterPanel
      className={partnerDetailReviewCardClassName}
      description="Review these gates before approving the partner or relying on this partner for dispatch."
      id="partner-approval-checklist"
      resultLabel={checklist.ready ? 'Ready for approval' : `${checklist.blockers} blocker(s)`}
      resultTone={checklist.ready ? 'success' : 'warning'}
      title="Approval checklist"
    >
      <AdminTableScroll>
        <AdminDataTable
          className={partnerDetailReviewTableClassName}
          emptyMessage={<PartnerReviewReadinessEmptyState message="No approval checklist rows." />}
          headers={approvalChecklistHeaders}
          rowCount={checklist.items.length}
        >
          {checklist.items.map((item) => (
            <tr key={item.label}>
              <td>
                <strong>{item.label}</strong>
              </td>
              <td>
                <StatusBadge tone={item.ok ? 'success' : 'warning'}>
                  {item.status}
                </StatusBadge>
              </td>
              <td>
                <p className="muted">{item.detailNode ?? item.detail}</p>
              </td>
              <td>
                <span className="muted">{item.ok ? 'OK' : 'Check'}</span>
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
      <PartnerDetailVuexyTableFooter rowCount={checklist.items.length} />
    </AdminFilterPanel>
  );
}

export function PartnerDetailRegistrationDossierSection({
  dossier,
}: PartnerDetailRegistrationDossierSectionProps) {
  return (
    <AdminFilterPanel
      className={partnerDetailReviewCardClassName}
      description="Structured view of the signup profile, public working profile, service area, identity evidence, and account activity. Finance-only rows stay in the wallet and payout sections."
      id="partner-registration-dossier"
      resultLabel={dossier.ready ? 'Dossier complete' : `${dossier.blockers} gap(s)`}
      resultTone={dossier.ready ? 'success' : 'warning'}
      title="Partner registration dossier"
    >
      <AdminTableScroll>
        <AdminDataTable
          className={partnerDetailReviewTableClassName}
          emptyMessage={<PartnerReviewReadinessEmptyState message="No registration dossier rows." />}
          headers={registrationDossierHeaders}
          rowCount={dossier.items.length}
        >
          {dossier.items.map((item) => (
            <tr key={item.label}>
              <td>
                <strong>{item.label}</strong>
              </td>
              <td>
                <StatusBadge tone={item.ok ? 'success' : 'warning'}>
                  {item.status}
                </StatusBadge>
              </td>
              <td>
                <p className="muted">{item.detailNode ?? item.detail}</p>
              </td>
              <td>
                <p className="muted">{item.operatorAction}</p>
              </td>
              <td>
                <span className="muted">{item.ok ? 'OK' : 'Fix'}</span>
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
      <PartnerDetailVuexyTableFooter rowCount={dossier.items.length} />
    </AdminFilterPanel>
  );
}

const approvalChecklistHeaders = ['Gate', 'Status', 'Detail', 'Outcome'] as const;
const registrationDossierHeaders = ['Dossier item', 'Status', 'Detail', 'Operator action', 'Outcome'] as const;

function PartnerReviewReadinessEmptyState({ message }: { readonly message: string }) {
  return <AdminEmptyState message={message} />;
}
