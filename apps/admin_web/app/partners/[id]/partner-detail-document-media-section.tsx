import { ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';
import { ActionMenu, type ActionMenuItem } from '../../../components/action-menu';
import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { AdminEmptyState } from '../../../components/admin-empty-state';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import { StatusBadge, statusBadgeToneFromPillClass } from '../../../components/status-badge';
import { marketplaceDisplayText } from '../../../lib/admin-copy';
import {
  PartnerDetailVuexyTableFooter,
  partnerDetailReviewCardClassName,
  partnerDetailReviewTableClassName,
} from './partner-detail-vuexy-table';

export type PartnerTypedDocumentRow = {
  readonly assetLabel: string;
  readonly assetLabelNode?: ReactNode;
  readonly fileHref?: string;
  readonly fileLabel: string;
  readonly id: string;
  readonly rejectionReason?: string | null;
  readonly reviewActions: readonly ActionMenuItem[];
  readonly reviewHint: string;
  readonly reviewLabel: string;
  readonly status: string;
  readonly statusTone: string;
  readonly typeLabel: string;
};

export type PartnerPublicMediaRow = {
  readonly detailLabel: string;
  readonly detailLabelNode?: ReactNode;
  readonly fileHref?: string | null;
  readonly fileLabel: string;
  readonly id: string;
  readonly reviewActions: readonly ActionMenuItem[];
  readonly reviewLabel: string;
  readonly reviewedLabel?: string | null;
  readonly reviewedLabelNode?: ReactNode;
  readonly reviewReason?: string | null;
  readonly reviewStatus: string;
  readonly reviewStatusTone: string;
  readonly uploadStatus: string;
  readonly typeLabel: string;
};

type PartnerDetailTypedDocumentsCardProps = {
  readonly rows: readonly PartnerTypedDocumentRow[];
};

type PartnerDetailPublicProfileMediaCardProps = {
  readonly rows: readonly PartnerPublicMediaRow[];
};

export function PartnerDetailTypedDocumentsCard({ rows }: PartnerDetailTypedDocumentsCardProps) {
  return (
    <AdminFilterPanel
      className={partnerDetailReviewCardClassName}
      description="Required Partner onboarding files with review status, asset evidence, and approval actions."
      id="documents"
      resultLabel={`${rows.length} document(s)`}
      title="Typed documents"
    >
      <AdminTableScroll>
        <AdminDataTable
          className={partnerDetailReviewTableClassName}
          emptyMessage={<EvidenceEmptyState message="No typed onboarding documents yet." />}
          headers={typedDocumentHeaders}
          rowCount={rows.length}
        >
          {rows.map((document) => (
            <tr key={document.id}>
              <td>
                <strong>{document.typeLabel}</strong>
                <p className="muted">{document.reviewHint}</p>
              </td>
              <td>
                <strong>{document.assetLabelNode ?? marketplaceDisplayText(document.assetLabel)}</strong>
                {document.rejectionReason ? (
                  <p className="muted">Partner app correction: {document.rejectionReason}</p>
                ) : null}
              </td>
              <td>
                <FileOpenAction
                  fileHref={document.fileHref}
                  fileLabel={document.fileLabel}
                  label={`Open ${document.typeLabel}`}
                />
              </td>
              <td>
                <StatusBadge tone={statusBadgeToneFromPillClass(document.statusTone)}>
                  {document.status}
                </StatusBadge>
              </td>
              <td>
                <ActionMenu
                  actions={document.reviewActions}
                  label={document.reviewLabel}
                  variant="dropdown"
                />
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
      <PartnerDetailVuexyTableFooter rowCount={rows.length} />
    </AdminFilterPanel>
  );
}

export function PartnerDetailPublicProfileMediaCard({ rows }: PartnerDetailPublicProfileMediaCardProps) {
  return (
    <AdminFilterPanel
      className={partnerDetailReviewCardClassName}
      description="Marketplace-visible Partner media with upload state, review outcome, and moderation actions."
      id="media"
      resultLabel={`${rows.length} asset(s)`}
      title="Public profile media"
    >
      <AdminTableScroll>
        <AdminDataTable
          className={partnerDetailReviewTableClassName}
          emptyMessage={<EvidenceEmptyState message="No public profile image or work photos uploaded yet." />}
          headers={publicMediaHeaders}
          rowCount={rows.length}
        >
          {rows.map((file) => (
            <tr key={file.id}>
              <td>
                <strong>{file.typeLabel}</strong>
                <p className="muted">{file.detailLabelNode ?? file.detailLabel}</p>
              </td>
              <td>
                <FileOpenAction
                  fileHref={file.fileHref ?? undefined}
                  fileLabel={file.fileLabel}
                  label={`Open ${marketplaceDisplayText(file.fileLabel)}`}
                />
              </td>
              <td>
                <StatusBadge tone="success">{file.uploadStatus}</StatusBadge>
              </td>
              <td>
                <StatusBadge tone={statusBadgeToneFromPillClass(file.reviewStatusTone)}>
                  {file.reviewStatus}
                </StatusBadge>
                {file.reviewedLabel || file.reviewedLabelNode ? (
                  <p className="muted">Reviewed {file.reviewedLabelNode ?? file.reviewedLabel}</p>
                ) : null}
                {file.reviewReason ? <p className="muted">Review reason: {file.reviewReason}</p> : null}
              </td>
              <td>
                <ActionMenu actions={file.reviewActions} label={file.reviewLabel} variant="dropdown" />
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
      <PartnerDetailVuexyTableFooter rowCount={rows.length} />
    </AdminFilterPanel>
  );
}

const typedDocumentHeaders = ['Document', 'Evidence', 'File', 'Status', 'Actions'] as const;
const publicMediaHeaders = ['Media', 'File', 'Upload', 'Review', 'Actions'] as const;

function FileOpenAction({
  fileHref,
  fileLabel,
  label,
}: {
  readonly fileHref?: string;
  readonly fileLabel: string;
  readonly label: string;
}) {
  if (!fileHref) {
    return <span className="muted">{marketplaceDisplayText(fileLabel)}</span>;
  }

  return (
    <a
      aria-label={label}
      className="files-open-action"
      href={fileHref}
      target="_blank"
      rel="noreferrer"
      title={marketplaceDisplayText(fileLabel)}
    >
      <ExternalLink size={16} aria-hidden="true" />
    </a>
  );
}

function EvidenceEmptyState({ message }: { readonly message: string }) {
  return <AdminEmptyState message={message} title="No evidence found" />;
}
