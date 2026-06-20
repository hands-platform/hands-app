import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';

type PartnerReadinessItem = {
  detail: string;
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
    <div className="card admin-mb-16">
      <div className="ops-section-header">
        <div>
          <h2>Approval checklist</h2>
          <p className="muted">
            Review these gates before approving the partner or relying on this partner for dispatch.
          </p>
        </div>
        <span className={`pill ${checklist.ready ? 'pill-success' : 'pill-warn'}`}>
          {checklist.ready ? 'Ready for approval' : `${checklist.blockers} blocker(s)`}
        </span>
      </div>
      <AdminTableScroll>
        <AdminDataTable
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
                <span className={`pill ${item.ok ? 'pill-success' : 'pill-warn'}`}>
                  {item.status}
                </span>
              </td>
              <td>
                <p className="muted">{item.detail}</p>
              </td>
              <td>
                <span className="muted">{item.ok ? 'OK' : 'Check'}</span>
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
    </div>
  );
}

export function PartnerDetailRegistrationDossierSection({
  dossier,
}: PartnerDetailRegistrationDossierSectionProps) {
  return (
    <div className="card admin-mb-16">
      <div className="ops-section-header">
        <div>
          <h2>Partner registration dossier</h2>
          <p className="muted">
            Structured view of the signup profile, public working profile, identity evidence, payout gate,
            legal consent, and account activity. Use this as the first review map before approving or
            rejecting a partner.
          </p>
        </div>
        <span className={`pill ${dossier.ready ? 'pill-success' : 'pill-warn'}`}>
          {dossier.ready ? 'Dossier complete' : `${dossier.blockers} gap(s)`}
        </span>
      </div>
      <AdminTableScroll>
        <AdminDataTable
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
                <span className={`pill ${item.ok ? 'pill-success' : 'pill-warn'}`}>
                  {item.status}
                </span>
              </td>
              <td>
                <p className="muted">{item.detail}</p>
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
    </div>
  );
}

const approvalChecklistHeaders = ['Gate', 'Status', 'Detail', 'Outcome'] as const;
const registrationDossierHeaders = ['Dossier item', 'Status', 'Detail', 'Operator action', 'Outcome'] as const;

function PartnerReviewReadinessEmptyState({ message }: { readonly message: string }) {
  return (
    <>
      <strong>No records found</strong>
      <p className="muted">{message}</p>
    </>
  );
}
