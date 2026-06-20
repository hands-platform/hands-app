import { ActionMenu, type ActionMenuItem } from '../../../components/action-menu';
import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { marketplaceDisplayText } from '../../../lib/admin-copy';

export type PartnerBankPayoutGateView = {
  readonly accountLabel?: string | null;
  readonly bankName?: string | null;
  readonly holderName?: string | null;
  readonly rejectionReason?: string | null;
  readonly reviewActions: readonly ActionMenuItem[];
  readonly status: string;
};

export type PartnerTaxProfileView = {
  readonly legalName?: string | null;
  readonly registeredAddress?: string | null;
  readonly rejectionReason?: string | null;
  readonly reviewActions: readonly ActionMenuItem[];
  readonly status: string;
  readonly taxCodeLabel: string;
};

type PartnerDetailBankPayoutGateCardProps = {
  readonly bank: PartnerBankPayoutGateView | null;
};

type PartnerDetailTaxProfileCardProps = {
  readonly taxProfile: PartnerTaxProfileView | null;
};

export function PartnerDetailBankPayoutGateCard({ bank }: PartnerDetailBankPayoutGateCardProps) {
  return (
    <div className="card" id="bank">
      <div className="ops-section-header">
        <div>
          <h2>Bank and payout gate</h2>
          <p className="muted">
            Payout account evidence used before Partner approval and payout release.
          </p>
        </div>
        <span className={`pill ${financeEvidenceStatusTone(bank?.status)}`}>{bank?.status ?? 'MISSING'}</span>
      </div>
      <AdminTableScroll>
        <AdminDataTable
          emptyMessage={<FinanceEvidenceEmptyState message="No bank account submitted." />}
          headers={financeEvidenceHeaders}
          rowCount={bank ? 1 : 0}
        >
          {bank ? (
            <tr>
              <td>
                <strong>Primary payout bank</strong>
                <p className="muted">Partner receives platform payout through this account after approval.</p>
              </td>
              <td>
                <EvidenceLine label="Bank" value={bank.bankName} />
                <EvidenceLine label="Account" value={bank.accountLabel} />
                <EvidenceLine label="Holder" value={bank.holderName} />
                <EvidenceLine label="Rejection reason" value={bank.rejectionReason} />
              </td>
              <td>
                <span className={`pill ${financeEvidenceStatusTone(bank.status)}`}>{bank.status}</span>
              </td>
              <td>
                <ActionMenu actions={bank.reviewActions} label="Bank review actions" variant="dropdown" />
              </td>
            </tr>
          ) : null}
        </AdminDataTable>
      </AdminTableScroll>
    </div>
  );
}

export function PartnerDetailTaxProfileCard({ taxProfile }: PartnerDetailTaxProfileCardProps) {
  return (
    <div className="card" id="tax">
      <div className="ops-section-header">
        <div>
          <h2>Tax profile</h2>
          <p className="muted">
            Tax evidence required for payout eligibility after Partner revenue starts.
          </p>
        </div>
        <span className={`pill ${financeEvidenceStatusTone(taxProfile?.status)}`}>
          {taxProfile?.status ?? 'DEFERRED'}
        </span>
      </div>
      <AdminTableScroll>
        <AdminDataTable
          emptyMessage={
            <FinanceEvidenceEmptyState message="Tax profile is not required until payout eligibility review." />
          }
          headers={financeEvidenceHeaders}
          rowCount={taxProfile ? 1 : 0}
        >
          {taxProfile ? (
            <tr>
              <td>
                <strong>Tax identity</strong>
                <p className="muted">Used for payout compliance and monthly finance closeout.</p>
              </td>
              <td>
                <EvidenceLine label="Legal name" value={taxProfile.legalName} />
                <EvidenceLine label="Tax code" value={taxProfile.taxCodeLabel} />
                <EvidenceLine label="Registered address" value={taxProfile.registeredAddress} />
                <EvidenceLine label="Rejection reason" value={taxProfile.rejectionReason} />
              </td>
              <td>
                <span className={`pill ${financeEvidenceStatusTone(taxProfile.status)}`}>
                  {taxProfile.status}
                </span>
              </td>
              <td>
                <ActionMenu actions={taxProfile.reviewActions} label="Tax review actions" variant="dropdown" />
              </td>
            </tr>
          ) : null}
        </AdminDataTable>
      </AdminTableScroll>
    </div>
  );
}

const financeEvidenceHeaders = ['Gate', 'Evidence', 'Status', 'Actions'] as const;

function EvidenceLine({ label, value }: { readonly label: string; readonly value?: string | null }) {
  return (
    <p className="muted">
      <strong>{label}:</strong> {value && value.trim() ? marketplaceDisplayText(value) : 'Missing'}
    </p>
  );
}

function FinanceEvidenceEmptyState({ message }: { readonly message: string }) {
  return (
    <>
      <strong>No finance evidence found</strong>
      <p className="muted">{message}</p>
    </>
  );
}

function financeEvidenceStatusTone(status?: string | null) {
  if (status === 'APPROVED') return 'pill-success';
  if (status === 'REJECTED' || status === 'MISSING') return 'pill-danger';
  if (status === 'DEFERRED' || !status) return 'pill-neutral';
  return 'pill-warn';
}
