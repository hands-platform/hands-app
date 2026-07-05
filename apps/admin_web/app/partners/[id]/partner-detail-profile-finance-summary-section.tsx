import type { ReactNode } from 'react';

import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { DateTimeText } from '../../../components/date-time-text';
import { AdminEmptyState } from '../../../components/admin-empty-state';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import { AdminInlineFallback } from '../../../components/admin-inline-fallback';
import { StatusBadge } from '../../../components/status-badge';
import { marketplaceDisplayText } from '../../../lib/admin-copy';
import {
  PartnerDetailVuexyTableFooter,
  partnerDetailReviewCardClassName,
  partnerDetailReviewTableClassName,
} from './partner-detail-vuexy-table';

const COORDINATE_PAIR_TEXT_RE = /\b-?\d{1,3}\.\d{2,}\s*,\s*-?\d{1,3}\.\d{2,}\b/;

export type PartnerDetailInfoLine = {
  readonly dateValue?: string | null;
  readonly label: string;
  readonly value?: string | null;
};

export type PartnerAgreementBadge = {
  readonly id: string;
  readonly label: string;
};

export type PartnerRecentPayoutRecordLine = {
  readonly id: string;
  readonly label: string;
};

export type PartnerLocationSnapshotBadge = {
  readonly id: string;
  readonly label: string;
  readonly recordedAt?: string | null;
};

type PartnerDetailBasicProfileCardProps = {
  readonly note: string;
  readonly rows: readonly PartnerDetailInfoLine[];
};

type PartnerDetailAgreementsCardProps = {
  readonly agreements: readonly PartnerAgreementBadge[];
};

type PartnerDetailRecentPayoutRecordsCardProps = {
  readonly earningCount: number;
  readonly earnings: readonly PartnerRecentPayoutRecordLine[];
  readonly payoutBatchCount: number;
};

type PartnerDetailLocationActivityCardProps = {
  readonly coordinatesLabel?: string | null;
  readonly lastLocationLabel?: ReactNode;
  readonly snapshots: readonly PartnerLocationSnapshotBadge[];
};

export function PartnerDetailBasicProfileCard({ note, rows }: PartnerDetailBasicProfileCardProps) {
  return (
    <AdminFilterPanel
      className={partnerDetailReviewCardClassName}
      description="Partner identity, service area, profile review, and user account fields."
      id="basic-profile"
      resultLabel={`${rows.length} field(s)`}
      title="Basic profile"
    >
      <AdminTableScroll>
        <AdminDataTable
          className={partnerDetailReviewTableClassName}
          emptyMessage={<ProfileEmptyState message="No basic profile fields loaded." />}
          headers={profileTableHeaders}
          rowCount={rows.length}
        >
          {rows.map((row) => (
            <tr key={row.label}>
              <td>
                <strong>{row.label}</strong>
              </td>
              <td>
                <ProfileValue dateValue={row.dateValue} value={row.value} />
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
      <div className="partner-detail-note admin-mt-12">
        <strong>Operator note</strong>
        <p className="muted">{marketplaceDisplayText(note)}</p>
      </div>
      <PartnerDetailVuexyTableFooter rowCount={rows.length} />
    </AdminFilterPanel>
  );
}

export function PartnerDetailAgreementsCard({ agreements }: PartnerDetailAgreementsCardProps) {
  return (
    <AdminFilterPanel
      className={partnerDetailReviewCardClassName}
      description="Legal agreement acceptance records connected to this Partner account."
      id="agreements"
      resultLabel={`${agreements.length} accepted`}
      resultTone={agreements.length ? 'success' : 'warning'}
      title="Agreements"
    >
      <AdminTableScroll>
        <AdminDataTable
          className={partnerDetailReviewTableClassName}
          emptyMessage={<ProfileEmptyState message="No legal agreements accepted yet." />}
          headers={agreementTableHeaders}
          rowCount={agreements.length}
        >
          {agreements.map((agreement) => (
            <tr key={agreement.id}>
              <td>
                <strong>{agreement.label}</strong>
              </td>
              <td>
                <StatusBadge tone="success">ACCEPTED</StatusBadge>
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
      <PartnerDetailVuexyTableFooter rowCount={agreements.length} />
    </AdminFilterPanel>
  );
}

export function PartnerDetailRecentPayoutRecordsCard({
  earningCount,
  earnings,
  payoutBatchCount,
}: PartnerDetailRecentPayoutRecordsCardProps) {
  const rowCount = 2 + earnings.length;

  return (
    <AdminFilterPanel
      className={partnerDetailReviewCardClassName}
      description="Latest earning and payout batch evidence for finance handoff."
      id="recent-payout-records"
      resultLabel={`${earningCount} earning(s)`}
      title="Recent payout records"
    >
      <AdminTableScroll>
        <AdminDataTable
          className={partnerDetailReviewTableClassName}
          emptyMessage={<ProfileEmptyState message="No recent payout records loaded." />}
          headers={payoutRecordTableHeaders}
          rowCount={rowCount}
        >
          <tr>
            <td>
              <strong>Recent earnings</strong>
            </td>
            <td>
              <span>{earningCount}</span>
            </td>
          </tr>
          <tr>
            <td>
              <strong>Recent payout batches</strong>
            </td>
            <td>
              <span>{payoutBatchCount}</span>
            </td>
          </tr>
          {earnings.map((earning) => (
            <tr key={earning.id}>
              <td>
                <strong>Recent earning</strong>
              </td>
              <td>
                <span className="muted">{earning.label}</span>
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
      <PartnerDetailVuexyTableFooter rowCount={rowCount} />
    </AdminFilterPanel>
  );
}

export function PartnerDetailLocationActivityCard({
  coordinatesLabel,
  lastLocationLabel,
  snapshots,
}: PartnerDetailLocationActivityCardProps) {
  const rowCount = 3;
  const locationEvidenceLabel = safeLocationEvidenceLabel(coordinatesLabel);

  return (
    <AdminFilterPanel
      className={partnerDetailReviewCardClassName}
      description="Latest Partner app location evidence and recent recorded snapshots."
      id="location"
      resultLabel={`${snapshots.length} snapshot(s)`}
      title="Location and activity"
    >
      <AdminTableScroll>
        <AdminDataTable
          className={partnerDetailReviewTableClassName}
          emptyMessage={<ProfileEmptyState message="No location evidence loaded." />}
          headers={locationTableHeaders}
          rowCount={rowCount}
        >
          <tr>
            <td>
              <strong>Last location</strong>
            </td>
            <td>
              {lastLocationLabel ?? <AdminInlineFallback>Missing</AdminInlineFallback>}
            </td>
          </tr>
          <tr>
            <td>
              <strong>Location evidence</strong>
            </td>
            <td>
              <ProfileValue value={locationEvidenceLabel} />
            </td>
          </tr>
          <tr>
            <td>
              <strong>Recent snapshots</strong>
            </td>
            <td>
              {snapshots.length ? (
                <div className="participant-list">
                  {snapshots.map((snapshot) => (
                    <StatusBadge key={snapshot.id} tone="neutral">
                      {snapshot.recordedAt ? (
                        <DateTimeText fallback={snapshot.label} value={snapshot.recordedAt} />
                      ) : (
                        snapshot.label
                      )}
                    </StatusBadge>
                  ))}
                </div>
              ) : (
                <AdminInlineFallback>Missing</AdminInlineFallback>
              )}
            </td>
          </tr>
        </AdminDataTable>
      </AdminTableScroll>
      <PartnerDetailVuexyTableFooter rowCount={rowCount} />
    </AdminFilterPanel>
  );
}

function safeLocationEvidenceLabel(value?: string | null) {
  if (!value) return null;
  return COORDINATE_PAIR_TEXT_RE.test(value)
    ? 'Partner location saved for dispatch checks.'
    : value;
}

const profileTableHeaders = ['Field', 'Value'] as const;
const locationTableHeaders = ['Signal', 'Evidence'] as const;
const agreementTableHeaders = ['Agreement', 'Status'] as const;
const payoutRecordTableHeaders = ['Record', 'Evidence'] as const;

function ProfileValue({
  dateValue,
  value,
}: {
  readonly dateValue?: string | null;
  readonly value?: string | null;
}) {
  if (dateValue) {
    return <DateTimeText fallback="Missing" value={dateValue} />;
  }

  return value && value.trim() ? (
    <span>{marketplaceDisplayText(value)}</span>
  ) : (
    <AdminInlineFallback>Missing</AdminInlineFallback>
  );
}

function ProfileEmptyState({ message }: { readonly message: string }) {
  return <AdminEmptyState message={message} title="No profile evidence found" />;
}
