import { ActionMenu, type ActionMenuItem } from '../../../components/action-menu';
import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import { StatusBadge, type StatusBadgeTone } from '../../../components/status-badge';
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
  readonly reviewStateDetail?: string | null;
  readonly reviewStateLabel?: string | null;
  readonly reviewActions: readonly ActionMenuItem[];
  readonly reviewedAtLabel?: string | null;
  readonly status: string;
  readonly submittedAtLabel?: string | null;
  readonly updatedAtLabel?: string | null;
  readonly reviewTimeline?: readonly PartnerBankReviewTimelineItem[];
};

export type PartnerTaxProfileView = {
  readonly legalName?: string | null;
  readonly registeredAddress?: string | null;
  readonly rejectionReason?: string | null;
  readonly reviewActions: readonly ActionMenuItem[];
  readonly status: string;
  readonly taxCodeLabel: string;
};

export type PartnerBankReviewTimelineItem = {
  readonly actorLabel?: string | null;
  readonly atLabel: string;
  readonly detail: string;
  readonly id: string;
  readonly title: string;
  readonly tone: 'danger' | 'info' | 'primary' | 'success' | 'warning';
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
      resultLabel={bank?.status ?? 'ON_REQUEST'}
      resultTone={financeEvidenceStatusBadgeTone(bank?.status)}
      title="Withdrawal details"
    >
      <AdminTableScroll>
        <AdminDataTable
          className={partnerDetailReviewTableClassName}
          emptyMessage={
            <FinanceEvidenceEmptyState
              message="Collect bank details when the Partner requests wallet withdrawal/deposit or manual settlement."
              title="No withdrawal details found"
            />
          }
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
                <EvidenceLine label="Submitted" value={bank.submittedAtLabel} />
                <EvidenceLine label="Reviewed" value={bank.reviewedAtLabel} />
                <EvidenceLine label="Updated" value={bank.updatedAtLabel} />
              </td>
              <td>
                <StatusBadge tone={financeEvidenceStatusBadgeTone(bank.status)}>{bank.status}</StatusBadge>
                {bank.reviewStateLabel ? (
                  <div className="admin-mt-8">
                    <StatusBadge tone={financeEvidenceStatusBadgeTone(bank.status)}>
                      {bank.reviewStateLabel}
                    </StatusBadge>
                    {bank.reviewStateDetail ? <p className="muted">{bank.reviewStateDetail}</p> : null}
                  </div>
                ) : null}
              </td>
              <td>
                <ActionMenu actions={bank.reviewActions} label="Withdrawal detail review actions" variant="dropdown" />
              </td>
            </tr>
          ) : null}
        </AdminDataTable>
      </AdminTableScroll>
      <PartnerDetailVuexyTableFooter rowCount={rowCount} />
      {bank?.reviewTimeline?.length ? <BankReviewTimeline items={bank.reviewTimeline} /> : null}
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
                <StatusBadge tone={financeEvidenceStatusBadgeTone(taxProfile.status)}>
                  {taxProfile.status}
                </StatusBadge>
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

function BankReviewTimeline({ items }: { readonly items: readonly PartnerBankReviewTimelineItem[] }) {
  return (
    <div className="admin-mt-16">
      <h3>Bank review timeline</h3>
      <div className="vuexy-basic-timeline partner-bank-review-timeline admin-mt-16">
        {items.map((item, index) => (
          <article className="vuexy-basic-timeline-item" key={item.id}>
            <div className="vuexy-basic-timeline-separator" aria-hidden="true">
              <span className={`vuexy-basic-timeline-dot is-${item.tone}`} />
              {index < items.length - 1 ? <span className="vuexy-basic-timeline-connector" /> : null}
            </div>
            <div className="vuexy-basic-timeline-content">
              <div className="vuexy-basic-timeline-title-row">
                <h3>{item.title}</h3>
                <time>{item.atLabel}</time>
              </div>
              <p>{item.detail}</p>
              {item.actorLabel ? (
                <div className="vuexy-basic-timeline-meta is-compact">
                  <div className="vuexy-basic-timeline-meta-item">
                    <span>Actor</span>
                    <strong>{item.actorLabel}</strong>
                  </div>
                </div>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function FinanceEvidenceEmptyState({
  message,
  title = 'No finance evidence found',
}: {
  readonly message: string;
  readonly title?: string;
}) {
  return (
    <>
      <strong>{title}</strong>
      <p className="muted">{message}</p>
    </>
  );
}

function financeEvidenceStatusBadgeTone(status?: string | null): StatusBadgeTone {
  if (status === 'APPROVED') return 'success';
  if (status === 'REJECTED' || status === 'MISSING') return 'danger';
  if (status === 'DEFERRED' || status === 'ON_REQUEST' || !status) return 'neutral';
  return 'warning';
}
