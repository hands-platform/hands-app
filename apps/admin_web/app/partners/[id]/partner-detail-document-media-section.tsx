import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Image as ImageIcon,
  PauseCircle,
  Plus,
  Trash2,
} from 'lucide-react';
import type { CSSProperties } from 'react';

import { ActionMenu, type ActionMenuItem } from '../../../components/action-menu';
import { AdminEmptyState } from '../../../components/admin-empty-state';
import { AdminIconButton } from '../../../components/admin-icon-button';
import { AdminIconLink } from '../../../components/admin-icon-link';
import {
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormFile,
  AdminFormSelect,
} from '../../../components/admin-form-controls';
import { AdminErrorState } from '../../../components/admin-surface';
import { StatusBadgeFromPillClass } from '../../../components/status-badge';
import { marketplaceDisplayText } from '../../../lib/admin-copy';
import { reorderPartnerPublicMedia, uploadPartnerPublicMedia } from '../actions';
import type { PartnerDecisionQueue } from '../partner-review-mode';
import { partnerReviewActionConfirmHref } from '../partner-review-action-confirmation';

export type PartnerTypedDocumentRow = {
  readonly fileHref?: string;
  readonly id: string;
  readonly previewable?: boolean;
  readonly rejectionReason?: string | null;
  readonly reviewHint: string;
  readonly status: string;
  readonly statusTone: string;
  readonly typeLabel: string;
};

export type PartnerPublicMediaRow = {
  readonly fileHref?: string | null;
  readonly id: string;
  readonly previewable?: boolean;
  readonly reviewActions: readonly ActionMenuItem[];
  readonly reviewLabel: string;
  readonly reviewStatus: string;
  readonly reviewStatusTone: string;
  readonly typeLabel: string;
};

type PartnerDetailTypedDocumentsCardProps = {
  readonly canApprove: boolean;
  readonly canReview: boolean;
  readonly hasKycRecord: boolean;
  readonly holdReason?: string | null;
  readonly kycStatus?: string | null;
  readonly partnerId: string;
  readonly decisionQueue?: PartnerDecisionQueue | null;
  readonly rows: readonly PartnerTypedDocumentRow[];
};

type PartnerDetailPublicProfileMediaCardProps = {
  readonly canEdit: boolean;
  readonly canReview: boolean;
  readonly partnerId: string;
  readonly rows: readonly PartnerPublicMediaRow[];
};

export function PartnerDetailTypedDocumentsCard({
  canApprove,
  canReview,
  hasKycRecord,
  holdReason,
  kycStatus,
  partnerId,
  decisionQueue = null,
  rows,
}: PartnerDetailTypedDocumentsCardProps) {
  const approved = kycStatus === 'APPROVED';
  const evidenceHref = `/partners/${partnerId}?section=dossier&dossier=evidence${
    decisionQueue ? `&decisionQueue=${decisionQueue}` : ''
  }`;

  return (
    <section className="card admin-card partner-detail-evidence-card" id="documents">
      <div className="partner-detail-evidence-heading">
        <div>
          <span>KYC evidence</span>
          <h3>Typed documents</h3>
        </div>
        <strong>{rows.length}</strong>
      </div>

      {rows.length ? (
        <div className="partner-document-compact-grid">
          {rows.map((document) => (
            <div className="partner-document-compact-item" key={document.id}>
              <PartnerEvidencePreview
                fileHref={document.fileHref}
                label={`Open ${document.typeLabel}`}
                previewable={document.previewable}
              />
              <div className="partner-document-compact-copy">
                <strong>{document.typeLabel}</strong>
                <small>{document.reviewHint}</small>
                {document.rejectionReason ? <p>{document.rejectionReason}</p> : null}
              </div>
              <div className="partner-document-compact-actions">
                <StatusBadgeFromPillClass pillClass={document.statusTone}>
                  {document.status}
                </StatusBadgeFromPillClass>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <AdminEmptyState framed message="No typed onboarding documents yet." title={null} />
      )}

      <div className="partner-kyc-overall-decision">
        <div className="partner-kyc-overall-decision-heading">
          <div>
            <span>Overall KYC review</span>
            <h3>{approved ? 'Approved' : kycStatus === 'BLOCKED' ? 'On hold' : 'Awaiting decision'}</h3>
          </div>
          {canReview && !approved && canApprove ? (
            <AdminFormControlLink
              href={partnerReviewActionConfirmHref(partnerId, 'approve-kyc', {}, { baseHref: evidenceHref })}
            >
              <CheckCircle2 aria-hidden="true" size={16} />
              Approve
            </AdminFormControlLink>
          ) : null}
        </div>

        {canReview && hasKycRecord && !approved ? (
          <AdminFormControlLink
            className="button-secondary"
            href={partnerReviewActionConfirmHref(partnerId, 'hold-kyc', {}, { baseHref: evidenceHref })}
          >
            <PauseCircle aria-hidden="true" size={16} />
            Put on hold
          </AdminFormControlLink>
        ) : null}
        {holdReason ? <p className="muted">Current hold reason: {holdReason}</p> : null}
        {!canReview ? (
          <AdminErrorState
            message="You do not have permission to approve or hold Partner KYC. Evidence remains read-only."
            title="Read-only KYC evidence"
          />
        ) : null}
      </div>
    </section>
  );
}

export function PartnerDetailPublicProfileMediaCard({
  canEdit,
  canReview,
  partnerId,
  rows,
}: PartnerDetailPublicProfileMediaCardProps) {
  const orderedFileIds = rows.map((row) => row.id).join(',');

  return (
    <section className="card admin-card partner-detail-public-media-card" id="media">
      <div className="partner-detail-evidence-heading partner-public-media-heading">
        <div>
          <span>Customer app</span>
          <h3>Public profile media</h3>
        </div>
        {canEdit ? <form action={uploadPartnerPublicMedia} className="partner-public-media-upload-form">
          <input name="providerId" type="hidden" value={partnerId} />
          <AdminFormSelect
            defaultValue="provider-gallery"
            label="Photo type"
            labelVisibility="visible"
            name="purpose"
            options={[
              { label: 'Profile image', value: 'profile-image' },
              { label: 'Work photo', value: 'provider-gallery' },
            ]}
          />
          <AdminFormFile
            accept="image/jpeg,image/png,image/webp"
            displayValue="Choose photo"
            icon={<ImageIcon aria-hidden="true" size={16} />}
            label="Photo"
            name="photo"
            required
          />
          <AdminFormControlButton type="submit">
            <Plus aria-hidden="true" size={16} />
            Add photo
          </AdminFormControlButton>
        </form> : null}
      </div>

      {rows.length ? (
        <div className="partner-public-media-grid">
          {rows.map((file, index) => (
            <div className="partner-public-media-item" key={file.id}>
              <PartnerEvidencePreview
                fileHref={file.fileHref ?? undefined}
                label={`Open ${file.typeLabel}`}
                previewable={file.previewable}
              />
              <div className="partner-public-media-item-footer">
                <StatusBadgeFromPillClass pillClass={file.reviewStatusTone}>
                  {file.reviewStatus}
                </StatusBadgeFromPillClass>
                <div className="partner-public-media-order-actions">
                  {canEdit ? <form action={reorderPartnerPublicMedia}>
                    <input name="providerId" type="hidden" value={partnerId} />
                    <input name="fileId" type="hidden" value={file.id} />
                    <input name="fileIds" type="hidden" value={orderedFileIds} />
                    <input name="direction" type="hidden" value="left" />
                    <AdminIconButton
                      aria-label={`Move ${file.typeLabel} left`}
                      disabled={index === 0}
                      type="submit"
                    >
                      <ArrowLeft aria-hidden="true" size={16} />
                    </AdminIconButton>
                  </form> : null}
                  {canEdit ? <form action={reorderPartnerPublicMedia}>
                    <input name="providerId" type="hidden" value={partnerId} />
                    <input name="fileId" type="hidden" value={file.id} />
                    <input name="fileIds" type="hidden" value={orderedFileIds} />
                    <input name="direction" type="hidden" value="right" />
                    <AdminIconButton
                      aria-label={`Move ${file.typeLabel} right`}
                      disabled={index === rows.length - 1}
                      type="submit"
                    >
                      <ArrowRight aria-hidden="true" size={16} />
                    </AdminIconButton>
                  </form> : null}
                  {canReview ? <ActionMenu actions={file.reviewActions} label={file.reviewLabel} variant="dropdown" /> : null}
                  {canEdit ? (
                    <AdminIconLink
                      aria-label={`Delete ${file.typeLabel}`}
                      className="is-danger"
                      href={partnerReviewActionConfirmHref(
                        partnerId,
                        'delete-media',
                        { fileId: file.id },
                        { baseHref: `/partners/${partnerId}?section=dossier&dossier=evidence` },
                      )}
                    >
                      <Trash2 aria-hidden="true" size={16} />
                    </AdminIconLink>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <AdminEmptyState framed message="No public profile photos uploaded yet." title={null} />
      )}
      {!canEdit && !canReview ? (
        <AdminErrorState
          message="You do not have permission to edit or review public Partner media."
          title="Read-only public profile media"
        />
      ) : null}
    </section>
  );
}

export function PartnerEvidencePreview({
  fileHref,
  label,
  previewable = false,
}: {
  readonly fileHref?: string;
  readonly label: string;
  readonly previewable?: boolean;
}) {
  if (!fileHref) {
    return (
      <span className="partner-evidence-preview partner-evidence-preview-empty" aria-label="No image available">
        <ImageIcon aria-hidden="true" size={24} />
      </span>
    );
  }

  return (
    <a
      aria-label={label}
      className={`partner-evidence-preview${previewable ? '' : ' is-file'}`}
      href={fileHref}
      rel="noreferrer"
      style={
        previewable
          ? ({ '--partner-evidence-image': `url(${JSON.stringify(fileHref)})` } as CSSProperties)
          : undefined
      }
      target="_blank"
    >
      {previewable ? (
        <ImageIcon className="partner-evidence-preview-placeholder" size={24} aria-hidden="true" />
      ) : (
        <ExternalLink aria-hidden="true" size={20} />
      )}
      <span className="sr-only">{marketplaceDisplayText(label)}</span>
    </a>
  );
}
