import { ExternalLink } from 'lucide-react';
import { ActionMenu, type ActionMenuItem } from '../../../components/action-menu';
import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { marketplaceDisplayText } from '../../../lib/admin-copy';

export type PartnerTypedDocumentRow = {
  readonly assetLabel: string;
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
  readonly fileHref?: string | null;
  readonly fileLabel: string;
  readonly id: string;
  readonly reviewActions: readonly ActionMenuItem[];
  readonly reviewLabel: string;
  readonly reviewedLabel?: string | null;
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
    <div className="card" id="documents">
      <div className="ops-section-header">
        <div>
          <h2>Typed documents</h2>
          <p className="muted">
            Required Partner onboarding files with review status, asset evidence, and approval actions.
          </p>
        </div>
        <span className="pill pill-info">{rows.length} document(s)</span>
      </div>
      <AdminTableScroll>
        <AdminDataTable
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
                <strong>{marketplaceDisplayText(document.assetLabel)}</strong>
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
                <span className={`pill ${document.statusTone}`}>{document.status}</span>
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
    </div>
  );
}

export function PartnerDetailPublicProfileMediaCard({ rows }: PartnerDetailPublicProfileMediaCardProps) {
  return (
    <div className="card" id="media">
      <div className="ops-section-header">
        <div>
          <h2>Public profile media</h2>
          <p className="muted">
            Marketplace-visible Partner media with upload state, review outcome, and moderation actions.
          </p>
        </div>
        <span className="pill pill-info">{rows.length} asset(s)</span>
      </div>
      <AdminTableScroll>
        <AdminDataTable
          emptyMessage={<EvidenceEmptyState message="No public profile image or work photos uploaded yet." />}
          headers={publicMediaHeaders}
          rowCount={rows.length}
        >
          {rows.map((file) => (
            <tr key={file.id}>
              <td>
                <strong>{file.typeLabel}</strong>
                <p className="muted">{file.detailLabel}</p>
              </td>
              <td>
                <FileOpenAction
                  fileHref={file.fileHref ?? undefined}
                  fileLabel={file.fileLabel}
                  label={`Open ${marketplaceDisplayText(file.fileLabel)}`}
                />
              </td>
              <td>
                <span className="pill pill-success">{file.uploadStatus}</span>
              </td>
              <td>
                <span className={`pill ${file.reviewStatusTone}`}>{file.reviewStatus}</span>
                {file.reviewedLabel ? <p className="muted">Reviewed {file.reviewedLabel}</p> : null}
                {file.reviewReason ? <p className="muted">Review reason: {file.reviewReason}</p> : null}
              </td>
              <td>
                <ActionMenu actions={file.reviewActions} label={file.reviewLabel} variant="dropdown" />
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
    </div>
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
  return (
    <>
      <strong>No evidence found</strong>
      <p className="muted">{message}</p>
    </>
  );
}
