import type { ReactNode } from 'react';

import { ActionMenu, type ActionMenuItem } from '../../../components/action-menu';
import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { AdminInlineFallback } from '../../../components/admin-inline-fallback';
import { AdminBasicTimeline, type AdminBasicTimelineItem } from '../../../components/admin-surface';
import { DateTimeText } from '../../../components/date-time-text';
import { StatusBadge, type StatusBadgeTone } from '../../../components/status-badge';
import { marketplaceDisplayText, partnerOperatingStatusLabel } from '../../../lib/admin-copy';
import {
  PartnerDetailVuexyTableFooter,
  PartnerDetailVuexyTablePanel,
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
  readonly reviewedAt?: string | null;
  readonly status: string;
  readonly submittedAt?: string | null;
  readonly updatedAt?: string | null;
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
    <PartnerDetailVuexyTablePanel
      description="Manual wallet withdrawal/deposit evidence for operator checks. This does not gate Level 2 matching."
      id="bank"
      resultLabel={partnerOperatingStatusLabel(bank?.status ?? 'ON_REQUEST')}
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
                <EvidenceLine label="Submitted" value={<DateTimeText fallback="Missing" value={bank.submittedAt} />} />
                <EvidenceLine label="Reviewed" value={<DateTimeText fallback="Missing" value={bank.reviewedAt} />} />
                <EvidenceLine label="Updated" value={<DateTimeText fallback="Missing" value={bank.updatedAt} />} />
              </td>
              <td>
                <StatusBadge tone={financeEvidenceStatusBadgeTone(bank.status)}>
                  {partnerOperatingStatusLabel(bank.status)}
                </StatusBadge>
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
    </PartnerDetailVuexyTablePanel>
  );
}

export function PartnerDetailTaxProfileCard({ taxProfile }: PartnerDetailTaxProfileCardProps) {
  const rowCount = taxProfile ? 1 : 0;

  return (
    <PartnerDetailVuexyTablePanel
      description="Tax profile registration is not required for Vietnam MVP partner approval, matching, work, payout, or wallet withdrawal."
      id="tax"
      resultLabel={partnerOperatingStatusLabel(taxProfile?.status ?? 'DEFERRED')}
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
                  {partnerOperatingStatusLabel(taxProfile.status)}
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
    </PartnerDetailVuexyTablePanel>
  );
}

const financeEvidenceHeaders = ['Gate', 'Evidence', 'Status', 'Actions'] as const;

function EvidenceLine({ label, value }: { readonly label: string; readonly value?: ReactNode }) {
  return (
    <p className="muted">
      <strong>{label}:</strong> {renderEvidenceValue(value)}
    </p>
  );
}

function renderEvidenceValue(value?: ReactNode) {
  if (typeof value === 'string') {
    return value.trim() ? marketplaceDisplayText(value) : <AdminInlineFallback>Missing</AdminInlineFallback>;
  }

  return value ?? <AdminInlineFallback>Missing</AdminInlineFallback>;
}

function BankReviewTimeline({ items }: { readonly items: readonly PartnerBankReviewTimelineItem[] }) {
  return (
    <div className="admin-mt-16">
      <h3>Bank review timeline</h3>
      <AdminBasicTimeline
        className="partner-bank-review-timeline admin-mt-16"
        compactMeta
        items={partnerBankReviewBasicTimelineItems(items)}
      />
    </div>
  );
}

function partnerBankReviewBasicTimelineItems(
  items: readonly PartnerBankReviewTimelineItem[],
): readonly AdminBasicTimelineItem[] {
  return items.map((item) => ({
    detail: item.detail,
    detailClassName: null,
    id: item.id,
    meta: item.actorLabel ? [{ label: 'Actor', value: item.actorLabel }] : undefined,
    time: item.atLabel,
    title: item.title,
    tone: item.tone,
  }));
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
