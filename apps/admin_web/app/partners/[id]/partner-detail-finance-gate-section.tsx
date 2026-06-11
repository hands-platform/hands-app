import { ActionMenu, type ActionMenuItem } from '../../../components/action-menu';
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
      <h2>Bank and payout gate</h2>
      {bank ? (
        <>
          <InfoLine label="Bank" value={bank.bankName} />
          <InfoLine label="Account" value={bank.accountLabel} />
          <InfoLine label="Holder" value={bank.holderName} />
          <InfoLine label="Status" value={bank.status} />
          <InfoLine label="Rejection reason" value={bank.rejectionReason} />
          <div className="actions admin-mt-12">
            <ActionMenu actions={bank.reviewActions} label="Bank review actions" />
          </div>
        </>
      ) : (
        <p className="muted">No bank account submitted.</p>
      )}
    </div>
  );
}

export function PartnerDetailTaxProfileCard({ taxProfile }: PartnerDetailTaxProfileCardProps) {
  return (
    <div className="card" id="tax">
      <h2>Tax profile</h2>
      {taxProfile ? (
        <>
          <InfoLine label="Status" value={taxProfile.status} />
          <InfoLine label="Legal name" value={taxProfile.legalName} />
          <InfoLine label="Tax code" value={taxProfile.taxCodeLabel} />
          <InfoLine label="Registered address" value={taxProfile.registeredAddress} />
          <InfoLine label="Rejection reason" value={taxProfile.rejectionReason} />
          <div className="actions admin-mt-12">
            <ActionMenu actions={taxProfile.reviewActions} label="Tax review actions" />
          </div>
        </>
      ) : (
        <p className="muted">
          Tax profile is not required until payout eligibility review, and has not been submitted.
        </p>
      )}
    </div>
  );
}

function InfoLine({ label, value }: { readonly label: string; readonly value?: string | null }) {
  return (
    <p className="muted">
      <strong>{label}:</strong> {value && value.trim() ? marketplaceDisplayText(value) : 'Missing'}
    </p>
  );
}
