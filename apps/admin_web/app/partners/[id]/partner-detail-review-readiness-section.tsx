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
      <div className="setup-stage-list">
        {checklist.items.map((item) => (
          <div className="setup-stage-item" key={item.label}>
            <span>{item.status}</span>
            <div>
              <strong>{item.label}</strong>
              <p className="muted">{item.detail}</p>
            </div>
            <small>{item.ok ? 'OK' : 'Check'}</small>
          </div>
        ))}
      </div>
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
      <div className="setup-stage-list">
        {dossier.items.map((item) => (
          <div className="setup-stage-item" key={item.label}>
            <span>{item.status}</span>
            <div>
              <strong>{item.label}</strong>
              <p className="muted">{item.detail}</p>
              <p className="muted">{item.operatorAction}</p>
            </div>
            <small>{item.ok ? 'OK' : 'Fix'}</small>
          </div>
        ))}
      </div>
    </div>
  );
}
