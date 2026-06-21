import { ActionMenu, type ActionMenuItem } from '../../../components/action-menu';
import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import type { StatusBadgeTone } from '../../../components/status-badge';
import { marketplaceDisplayText } from '../../../lib/admin-copy';
import {
  PartnerDetailVuexyTableFooter,
  partnerDetailReviewCardClassName,
  partnerDetailReviewTableClassName,
} from './partner-detail-vuexy-table';

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
  const rowCount = bank ? 1 : 0;

  return (
    <AdminFilterPanel
      className={partnerDetailReviewCardClassName}
      description="Manual wallet withdrawal/deposit evidence for operator checks. This does not gate Level 2 matching."
      id="bank"
      resultLabel={bank?.status ?? 'MISSING'}
      resultTone={financeEvidenceStatusBadgeTone(bank?.status)}
      title="Withdrawal details"
    >
      <AdminTableScroll>
        <AdminDataTable
          className={partnerDetailReviewTableClassName}
          emptyMessage={<FinanceEvidenceEmptyState message="No bank account submitted." />}
          headers={financeEvidenceHeaders}
          rowCount={rowCount}
        >
          {bank ? (
            <tr>
              <td>
                <strong>Primary withdrawal bank</strong>
                <p className="muted">Used by operators for manual wallet withdrawal/deposit checks.</p>
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
                <ActionMenu actions={bank.reviewActions} label="Withdrawal detail review actions" variant="dropdown" />
              </td>
            </tr>
          ) : null}
        </AdminDataTable>
      </AdminTableScroll>
      <PartnerDetailVuexyTableFooter rowCount={rowCount} />
    </AdminFilterPanel>
  );
}

export function PartnerDetailTaxProfileCard({ taxProfile }: PartnerDetailTaxProfileCardProps) {
  const rowCount = taxProfile ? 1 : 0;

  return (
    <AdminFilterPanel
      className={partnerDetailReviewCardClassName}
      description="Optional tax profile evidence does not gate Vietnam MVP approval, matching, work, payout, or wallet withdrawal."
      id="tax"
      resultLabel={taxProfile?.status ?? 'DEFERRED'}
      resultTone={financeEvidenceStatusBadgeTone(taxProfile?.status)}
      title="Tax profile optional"
    >
      <AdminTableScroll>
        <AdminDataTable
          className={partnerDetailReviewTableClassName}
          emptyMessage={
            <FinanceEvidenceEmptyState message="Tax profile is not required for Vietnam MVP operations." />
          }
          headers={financeEvidenceHeaders}
          rowCount={rowCount}
        >
          {taxProfile ? (
            <tr>
              <td>
                <strong>Optional tax identity</strong>
                <p className="muted">Legacy finance record only. This does not block Level 2 activity or withdrawal.</p>
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
                <ActionMenu actions={taxProfile.reviewActions} label="Tax profile optional actions" variant="dropdown" />
              </td>
            </tr>
          ) : null}
        </AdminDataTable>
      </AdminTableScroll>
      <PartnerDetailVuexyTableFooter rowCount={rowCount} />
    </AdminFilterPanel>
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

function financeEvidenceStatusBadgeTone(status?: string | null): StatusBadgeTone {
  if (status === 'APPROVED') return 'success';
  if (status === 'REJECTED' || status === 'MISSING') return 'danger';
  if (status === 'DEFERRED' || !status) return 'neutral';
  return 'warning';
}
