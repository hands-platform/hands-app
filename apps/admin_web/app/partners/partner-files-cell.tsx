import { ActionMenu, type ActionMenuItem } from '../../components/action-menu';
import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminFormControlLink } from '../../components/admin-form-controls';
import { DateTimeText } from '../../components/date-time-text';
import { StatusBadge, statusBadgeToneFromPillClass } from '../../components/status-badge';
import type { AdminProvider } from '../../lib/admin-api';
import { marketplaceDisplayText } from '../../lib/admin-copy';
import { formatBytes } from './partner-list-ops';
import {
  providerPublicMedia,
  publicMediaReviewPillClass,
} from './partner-list-profile';

export type PartnerFilesCellPublicMedia = NonNullable<
  NonNullable<AdminProvider['user']>['fileAssets']
>[number];

type PartnerFilesCellProps = {
  readonly partnerName: string;
  readonly provider: AdminProvider;
  readonly publicMediaActions: (
    providerId: string,
    file: PartnerFilesCellPublicMedia,
  ) => readonly ActionMenuItem[];
};

export function PartnerFilesCell({
  partnerName,
  provider,
  publicMediaActions,
}: PartnerFilesCellProps) {
  return (
    <>
      {provider.verification?.files?.length ? (
        provider.verification.files.map((file) => (
          <div key={file.id} className="provider-file-row">
            <div className="participant-list admin-mb-6">
              <StatusBadge tone="info">{file.purpose ?? 'Partner verification'}</StatusBadge>
              <StatusBadge tone={file.uploadStatus === 'UPLOADED' ? 'success' : 'warning'}>
                {file.uploadStatus ?? 'PENDING'}
              </StatusBadge>
            </div>
            <p className="muted">
              {file.contentType}
              {file.sizeBytes ? ` / ${formatBytes(file.sizeBytes)}` : ''}
              {file.uploadedAt ? (
                <>
                  {' / uploaded '}
                  <DateTimeText value={file.uploadedAt} />
                </>
              ) : null}
            </p>
            <p className="muted">
              {marketplaceDisplayText(file.key)}
              {' / '}
              <AdminFormControlLink className="text-link" href={`/partners/${provider.id}#documents`}>
                open detail to view
              </AdminFormControlLink>
            </p>
          </div>
        ))
      ) : (
        <AdminEmptyState message="No private verification files." title={null} />
      )}
      <PartnerPublicMediaQueue
        partnerName={partnerName}
        provider={provider}
        publicMediaActions={publicMediaActions}
      />
    </>
  );
}

function PartnerPublicMediaQueue({
  partnerName,
  provider,
  publicMediaActions,
}: PartnerFilesCellProps) {
  const media = providerPublicMedia(provider);
  if (!media.length) {
    return <AdminEmptyState className="admin-mt-8" message="No public profile media uploaded." title={null} />;
  }

  return (
    <div className="admin-mt-10">
      <p className="muted admin-mb-6">
        Public media review
      </p>
      {media.slice(0, 4).map((file) => (
        <div key={file.id} className="provider-file-row">
          <div className="participant-list admin-mb-6">
            <StatusBadge tone="info">{file.purpose}</StatusBadge>
            <StatusBadge tone={statusBadgeToneFromPillClass(publicMediaReviewPillClass(file.reviewStatus))}>
              {file.reviewStatus ?? 'PENDING_REVIEW'}
            </StatusBadge>
          </div>
          <p className="muted admin-mb-6">
            {file.contentType}
            {file.sizeBytes ? ` / ${formatBytes(file.sizeBytes)}` : ''}
            {file.uploadedAt ? (
              <>
                {' / uploaded '}
                <DateTimeText value={file.uploadedAt} />
              </>
            ) : null}
          </p>
          <p className="muted admin-mb-6">
            {file.url ? (
              <a href={file.url} target="_blank" rel="noreferrer">
                {marketplaceDisplayText(file.key)}
              </a>
            ) : (
              marketplaceDisplayText(file.key)
            )}
          </p>
          {file.reviewReason ? (
            <p className="muted admin-mb-6">
              Reason: {file.reviewReason}
            </p>
          ) : null}
          <ActionMenu
            actions={publicMediaActions(provider.id, file)}
            label={`Public media review actions for ${partnerName}`}
          />
        </div>
      ))}
      {media.length > 4 ? (
        <AdminFormControlLink className="text-link" href={`/partners/${provider.id}#media`}>
          Review {media.length - 4} more media item(s)
        </AdminFormControlLink>
      ) : null}
    </div>
  );
}
