import { ExternalLink } from 'lucide-react';
import { ActionMenu, type ActionMenuItem } from '../../../components/action-menu';
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
      <h2>Typed documents</h2>
      {rows.length ? (
        rows.map((document) => (
          <div className="provider-file-row" key={document.id}>
            <div className="participant-list admin-mb-6">
              <span className="pill pill-info">{document.typeLabel}</span>
              <span className={`pill ${document.statusTone}`}>{document.status}</span>
            </div>
            <p className="muted">{document.reviewHint}</p>
            <p className="muted">{document.assetLabel}</p>
            {document.rejectionReason ? (
              <p className="muted">Rejection reason: {document.rejectionReason}</p>
            ) : null}
            <p className="muted">
              {document.fileHref ? (
                <a
                  aria-label={`Open ${document.typeLabel}`}
                  className="files-open-action"
                  href={document.fileHref}
                  target="_blank"
                  rel="noreferrer"
                  title="Open private file"
                >
                  <ExternalLink size={16} aria-hidden="true" />
                </a>
              ) : (
                marketplaceDisplayText(document.fileLabel)
              )}
            </p>
            <div className="actions">
              <ActionMenu actions={document.reviewActions} label={document.reviewLabel} />
            </div>
          </div>
        ))
      ) : (
        <p className="muted">No typed onboarding documents yet.</p>
      )}
    </div>
  );
}

export function PartnerDetailPublicProfileMediaCard({ rows }: PartnerDetailPublicProfileMediaCardProps) {
  return (
    <div className="card" id="media">
      <h2>Public profile media</h2>
      {rows.length ? (
        rows.map((file) => (
          <div className="provider-file-row" key={file.id}>
            <div className="participant-list admin-mb-6">
              <span className="pill pill-info">{file.typeLabel}</span>
              <span className="pill pill-success">{file.uploadStatus}</span>
              <span className={`pill ${file.reviewStatusTone}`}>{file.reviewStatus}</span>
            </div>
            <p className="muted">{file.detailLabel}</p>
            {file.reviewedLabel ? <p className="muted">Reviewed {file.reviewedLabel}</p> : null}
            {file.reviewReason ? <p className="muted">Review reason: {file.reviewReason}</p> : null}
            <p className="muted">
              {file.fileHref ? (
                <a
                  aria-label={`Open ${marketplaceDisplayText(file.fileLabel)}`}
                  className="files-open-action"
                  href={file.fileHref}
                  target="_blank"
                  rel="noreferrer"
                  title={marketplaceDisplayText(file.fileLabel)}
                >
                  <ExternalLink size={16} aria-hidden="true" />
                </a>
              ) : (
                marketplaceDisplayText(file.fileLabel)
              )}
            </p>
            <div className="actions">
              <ActionMenu actions={file.reviewActions} label={file.reviewLabel} />
            </div>
          </div>
        ))
      ) : (
        <p className="muted">No public profile image or work photos uploaded yet.</p>
      )}
    </div>
  );
}
