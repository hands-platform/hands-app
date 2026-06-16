import Link from 'next/link';
import { ExternalLink } from 'lucide-react';

import { ActionMenu, type ActionMenuItem } from '../../components/action-menu';
import { AdminPageTemplate } from '../../components/admin-page-template';
import { ConfirmDialog } from '../../components/confirm-dialog';
import { FilterBar, type FilterBarOption } from '../../components/filter-bar';
import { StatusBadge } from '../../components/status-badge';
import type { AdminProvider } from '../../lib/admin-api';
import { adminGet } from '../../lib/admin-api';
import { formatBytes, formatDateTime, shortId } from '../../lib/admin-format';
import { readSearchParam } from '../../lib/date-range';
import {
  approvePublicProviderMedia,
  rejectPublicProviderMedia,
} from '../partners/actions';
import {
  buildPartnerReviewActionConfirmation,
  partnerReviewActionConfirmHref,
  readPartnerReviewConfirmationAction,
} from '../partners/partner-review-action-confirmation';
import {
  buildFileReviewRows,
  buildFileReviewSummary,
  filterFileReviewRows,
  type FileReviewFilters,
  type FileReviewRow,
} from './file-review-board';

type FilesPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function FilesPage({ searchParams }: { searchParams?: FilesPageSearchParams }) {
  const params = (await searchParams) ?? {};
  const filters = buildFileFilters(params);
  const providers = await adminGet<AdminProvider[]>('/admin/partners?view=list', []);
  const allRows = buildFileReviewRows(providers);
  const rows = filterFileReviewRows(allRows, filters);
  const summary = buildFileReviewSummary(allRows);
  const confirmation = buildPartnerReviewActionConfirmation(
    providers,
    readPartnerReviewConfirmationAction(readSearchParam(params.reviewAction)),
    {
      bankAccountId: '',
      documentId: '',
      fileId: readSearchParam(params.fileId),
      providerId: readSearchParam(params.providerId),
    },
    { baseHref: '/files', cancelHref: '/files' },
  );

  return (
    <AdminPageTemplate
      contentClassName="files-page"
      description="Central review board for Partner verification files and public profile media."
      metrics={[
        { label: 'Total files', value: summary.total, helper: 'Partner file records loaded.' },
        { label: 'Needs review', value: summary.pendingReview, helper: 'Files not approved yet.' },
        { label: 'Public media', value: summary.publicMedia, helper: 'Profile and gallery assets.' },
        { label: 'Private files', value: summary.privateFiles, helper: 'Verification evidence files.' },
        { label: 'Rejected', value: summary.rejected, helper: 'Rejected media or files.' },
        { label: 'Upload incomplete', value: summary.uploadIncomplete, helper: 'File rows still pending upload.' },
      ]}
      title="Files"
    >
      {confirmation ? (
        <ConfirmDialog
          action={confirmation.action === 'approve-media' ? approvePublicProviderMedia : rejectPublicProviderMedia}
          cancelHref={confirmation.cancelHref}
          confirmLabel={confirmation.confirmLabel}
          description={confirmation.description}
          disabled={confirmation.disabled}
          hiddenInputs={confirmation.hiddenInputs}
          id={`file-review-${confirmation.action}-${confirmation.providerId}`}
          textInputs={confirmation.textInputs}
          title={confirmation.title}
          tone={confirmation.tone}
        />
      ) : null}

      <FilterBar
        action="/files"
        defaultQuery={filters.q}
        options={fileFilterOptions(filters)}
        placeholder="Search Partner, file key, purpose, status"
        queryLabel="Search files"
        resetHref="/files"
        resultLabel={`${rows.length} of ${allRows.length} file(s)`}
      />

      <section className="card">
        <div className="ops-section-header">
          <div>
            <h2>Review queue</h2>
            <p className="muted">Approve or reject public media here. Private verification files remain evidence for Partner review.</p>
          </div>
          <StatusBadge tone={rows.length ? 'info' : 'neutral'}>{rows.length} visible</StatusBadge>
        </div>
        <div className="admin-table-scroll">
          <table className="table files-review-table">
            <thead>
              <tr>
                <th>File</th>
                <th>Partner</th>
                <th>Status</th>
                <th>Upload</th>
                <th>Evidence</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <FileReviewTableRow key={row.id} row={row} />
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <p className="muted">No files match this queue.</p>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </AdminPageTemplate>
  );
}

function FileReviewTableRow({ row }: { readonly row: FileReviewRow }) {
  return (
    <tr>
      <td>
        <strong>{row.purposeLabel}</strong>
        <p className="muted">{row.kindLabel}</p>
        <p className="muted">{shortId(row.id, { length: 12, ellipsis: true })}</p>
      </td>
      <td>
        <Link className="text-link" href={row.partnerHref}>
          {row.partnerName}
        </Link>
        <p className="muted">{shortId(row.partnerId, { length: 12, ellipsis: true })}</p>
      </td>
      <td>
        <StatusBadge tone={row.statusTone}>{row.statusLabel}</StatusBadge>
        {row.reviewReason ? <p className="muted">Reason: {row.reviewReason}</p> : null}
      </td>
      <td>
        <StatusBadge tone={row.uploadStatus === 'UPLOADED' ? 'success' : 'warning'}>{row.uploadStatus}</StatusBadge>
        <p className="muted">{formatDateTime(row.uploadedAt)}</p>
      </td>
      <td>
        <p className="muted">{row.contentType}</p>
        <p className="muted">{formatBytes(row.sizeBytes)}</p>
        <p className="muted">{row.visibility}</p>
        {row.fileHref ? (
          <a
            aria-label={`Open ${row.purposeLabel}`}
            className="files-open-action"
            href={row.fileHref}
            rel="noreferrer"
            target="_blank"
            title="Open file"
          >
            <ExternalLink size={16} aria-hidden="true" />
          </a>
        ) : (
          <span className="muted">No read URL</span>
        )}
      </td>
      <td>
        <ActionMenu actions={fileReviewActions(row)} label={`File actions for ${row.purposeLabel}`} />
      </td>
    </tr>
  );
}

function fileReviewActions(row: FileReviewRow): readonly ActionMenuItem[] {
  const actions: ActionMenuItem[] = [
    { href: row.partnerHref, kind: 'link', label: 'Open Partner', tone: 'neutral' },
  ];

  if (row.kind === 'public-media') {
    actions.push(
      {
        description: 'Review before approving this public profile media.',
        disabled: row.reviewStatus === 'APPROVED',
        href: partnerReviewActionConfirmHref(row.partnerId, 'approve-media', { fileId: row.id }, { baseHref: '/files' }),
        kind: 'link',
        label: 'Approve media',
        tone: 'success',
      },
      {
        description: 'Review and enter a media rejection reason.',
        disabled: row.reviewStatus === 'REJECTED',
        href: partnerReviewActionConfirmHref(row.partnerId, 'reject-media', { fileId: row.id }, { baseHref: '/files' }),
        kind: 'link',
        label: 'Reject media',
        tone: 'danger',
      },
    );
  }

  return actions;
}

function buildFileFilters(params: Record<string, string | string[] | undefined>): FileReviewFilters {
  return {
    kind: readSearchParam(params.kind),
    q: readSearchParam(params.q),
    review: readSearchParam(params.review),
  };
}

function fileFilterOptions(filters: FileReviewFilters): FilterBarOption[] {
  return [
    { active: !filters.kind && !filters.review, href: '/files', label: 'All files' },
    { active: filters.review === 'needs-review', href: '/files?review=needs-review', label: 'Needs review', tone: 'warning' },
    { active: filters.kind === 'public-media', href: '/files?kind=public-media', label: 'Public media', tone: 'info' },
    { active: filters.kind === 'private-verification', href: '/files?kind=private-verification', label: 'Private files', tone: 'neutral' },
    { active: filters.review === 'approved', href: '/files?review=approved', label: 'Approved', tone: 'success' },
    { active: filters.review === 'rejected', href: '/files?review=rejected', label: 'Rejected', tone: 'danger' },
    { active: filters.review === 'upload-incomplete', href: '/files?review=upload-incomplete', label: 'Upload incomplete', tone: 'warning' },
  ];
}
