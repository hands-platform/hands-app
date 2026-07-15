import { ExternalLink } from 'lucide-react';

import { ActionMenu, type ActionMenuItem } from '../../components/action-menu';
import {
  AdminDataTable,
  AdminTablePaginationFooter,
  AdminTableScroll,
} from '../../components/admin-data-table';
import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { AdminFilterSummary } from '../../components/admin-filter-summary';
import { AdminSegmentedControl } from '../../components/admin-segmented-control';
import {
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormGrid,
  AdminFormSearch,
} from '../../components/admin-form-controls';
import { AdminInlineFallback } from '../../components/admin-inline-fallback';
import { AdminPageTemplate } from '../../components/admin-page-template';
import { AdminPersonCell } from '../../components/admin-person-cell';
import { ConfirmDialog } from '../../components/confirm-dialog';
import { AdminTableSection } from '../../components/admin-table-panel';
import { DateTimeText } from '../../components/date-time-text';
import { StatusBadge } from '../../components/status-badge';
import type { AdminProvider } from '../../lib/admin-api';
import { adminGet } from '../../lib/admin-api';
import { formatBytes, shortId } from '../../lib/admin-format';
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
import { approvePublicMediaDescription, rejectPublicMediaDescription } from '../partners/partner-action-copy';
import {
  buildFileReviewRows,
  buildFileReviewSummary,
  filterFileReviewRows,
  type FileReviewFilters,
  type FileReviewRow,
  type FileReviewSummary,
} from './file-review-board';

type FilesPageSearchParams = Promise<Record<string, string | string[] | undefined>>;
type FileReviewServerSummary = FileReviewSummary & {
  readonly generatedAt?: string;
  readonly totalProviders: number;
};
type FileFilterOption = {
  readonly active?: boolean;
  readonly href: string;
  readonly label: string;
  readonly value: string;
};

const FILE_REVIEW_HEADERS = ['File', 'Partner', 'Status', 'Upload', 'Evidence', 'Actions'] as const;
const FILE_REVIEW_PROVIDER_PAGE_SIZE = 10;

export default async function FilesPage({ searchParams }: { searchParams?: FilesPageSearchParams }) {
  const params = (await searchParams) ?? {};
  const filters = buildFileFilters(params);
  const activePage = readFileReviewPage(params.page);
  const [providers, serverSummary] = await Promise.all([
    adminGet<AdminProvider[]>(buildFileReviewProviderApiHref(activePage), []),
    adminGet<FileReviewServerSummary | null>('/admin/files/review-summary', null),
  ]);
  const allRows = buildFileReviewRows(providers);
  const rows = filterFileReviewRows(allRows, filters);
  const summary = serverSummary ?? { ...buildFileReviewSummary(allRows), totalProviders: providers.length };
  const totalPages = Math.max(1, Math.ceil(summary.totalProviders / FILE_REVIEW_PROVIDER_PAGE_SIZE));
  const visibleFrom =
    summary.totalProviders === 0 || rows.length === 0 ? 0 : (activePage - 1) * FILE_REVIEW_PROVIDER_PAGE_SIZE + 1;
  const visibleTo =
    summary.totalProviders === 0 || rows.length === 0
      ? 0
      : Math.min(summary.totalProviders, (activePage - 1) * FILE_REVIEW_PROVIDER_PAGE_SIZE + rows.length);
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
        {
          label: 'Total files',
          value: summary.total,
          helper: 'Partner file records loaded.',
          kind: 'record',
          scope: 'All records',
        },
        {
          label: 'Needs review',
          value: summary.pendingReview,
          helper: 'Files not approved yet.',
          kind: 'action',
          scope: 'Pending',
        },
        {
          label: 'Public media',
          value: summary.publicMedia,
          helper: 'Profile and gallery assets.',
          kind: 'record',
          scope: 'Review records',
        },
        {
          label: 'Private files',
          value: summary.privateFiles,
          helper: 'Verification evidence files.',
          kind: 'record',
          scope: 'Evidence records',
        },
        {
          label: 'Rejected',
          value: summary.rejected,
          helper: 'Rejected media or files.',
          kind: 'record',
          scope: 'Review history',
        },
        {
          label: 'Upload incomplete',
          value: summary.uploadIncomplete,
          helper: 'File rows still pending upload.',
          kind: 'risk',
          scope: 'Needs action',
        },
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

      <AdminFilterPanel
        className="files-review-filter-panel admin-mb-16"
        resultLabel={`${rows.length} visible / ${summary.total} file(s)`}
        resultTone="info"
        title="File review filters"
      >
        <AdminFormGrid action="/files" className="compact-form">
          <AdminFormSearch
            defaultValue={filters.q}
            label="Search files"
            name="q"
            placeholder="Search Partner, file key, purpose, status"
          />
          <AdminFormControlButton type="submit">Search</AdminFormControlButton>
          <AdminFormControlLink className="button-secondary" href="/files">
            Clear
          </AdminFormControlLink>
        </AdminFormGrid>
        <div className="booking-date-filter-bar files-filter-group admin-mt-12">
          <span className="files-filter-group-label">Queue</span>
          <AdminSegmentedControl
            activeValue={activeFileFilterValue(filters)}
            ariaLabel="File review filter shortcuts"
            className="files-filter-buttons"
            options={fileFilterOptions(filters).map((option) => ({
              href: option.href,
              label: option.label,
              value: option.value,
            }))}
          />
        </div>
        <AdminFilterSummary
          ariaLabel="Active file review filters"
          labels={fileReviewActiveFilterLabels(filters, activePage)}
          tone="info"
        />
      </AdminFilterPanel>

      <AdminTableSection
        description="Approve or reject public media here. Private verification files remain evidence for Partner review."
        statusLabel={`${rows.length} visible`}
        statusTone={rows.length ? 'info' : 'neutral'}
        title="Review queue"
      >
        <AdminTableScroll>
          <AdminDataTable
            className="files-review-table"
            emptyMessage={<AdminEmptyState framed message="No files match this queue." />}
            headers={FILE_REVIEW_HEADERS}
            rowCount={rows.length}
          >
            {rows.map((row) => (
              <FileReviewTableRow key={row.id} row={row} />
            ))}
          </AdminDataTable>
        </AdminTableScroll>
        <AdminTablePaginationFooter
          activePage={activePage}
          ariaLabel="File review provider pages"
          from={visibleFrom}
          hrefForPage={(page) => buildFileReviewPageHref(params, page)}
          paginationClassName="admin-mt-16"
          to={visibleTo}
          totalPages={totalPages}
          totalRows={summary.totalProviders}
        />
      </AdminTableSection>
    </AdminPageTemplate>
  );
}

function FileReviewTableRow({ row }: { readonly row: FileReviewRow }) {
  const actions = fileReviewActions(row);

  return (
    <tr>
      <td>
        <strong>{row.purposeLabel}</strong>
        <p className="muted">{row.kindLabel}</p>
        <p className="muted">{shortId(row.id, { length: 12, ellipsis: true })}</p>
      </td>
      <td>
        <AdminPersonCell
          avatarClassName="vuexy-booking-avatar is-partner"
          avatarStatus={row.partnerAvatarStatus}
          className="vuexy-booking-person"
          helper={shortId(row.partnerId, { length: 12, ellipsis: true })}
          href={row.partnerHref}
          label={row.partnerName}
          linkClassName="table-link"
        />
      </td>
      <td>
        <StatusBadge tone={row.statusTone}>{row.statusLabel}</StatusBadge>
        {row.reviewReason ? <p className="muted">Reason: {row.reviewReason}</p> : null}
      </td>
      <td>
        <StatusBadge tone={row.uploadStatus === 'UPLOADED' ? 'success' : 'warning'}>{row.uploadStatus}</StatusBadge>
        <p className="muted">
          <DateTimeText value={row.uploadedAt} />
        </p>
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
          <AdminInlineFallback>No read URL</AdminInlineFallback>
        )}
      </td>
      <td>
        {actions.length ? (
          <ActionMenu actions={actions} label={`File actions for ${row.purposeLabel}`} />
        ) : (
          <StatusBadge tone="neutral">Evidence only</StatusBadge>
        )}
      </td>
    </tr>
  );
}

function fileReviewActions(row: FileReviewRow): readonly ActionMenuItem[] {
  const actions: ActionMenuItem[] = [];

  if (row.kind === 'public-media') {
    actions.push(
      {
        description: approvePublicMediaDescription,
        disabled: row.reviewStatus === 'APPROVED',
        href: partnerReviewActionConfirmHref(row.partnerId, 'approve-media', { fileId: row.id }, { baseHref: '/files' }),
        kind: 'link',
        label: 'Approve media',
        tone: 'success',
      },
      {
        description: rejectPublicMediaDescription,
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
    kind: readSearchParam(params.kind) || readSearchParam(params.purpose),
    q: readSearchParam(params.q),
    review: readSearchParam(params.review),
  };
}

function buildFileReviewProviderApiHref(page: number) {
  const skip = (Math.max(1, page) - 1) * FILE_REVIEW_PROVIDER_PAGE_SIZE;
  const query = new URLSearchParams({ take: String(FILE_REVIEW_PROVIDER_PAGE_SIZE) });
  if (skip > 0) {
    query.set('skip', String(skip));
  }
  return `/admin/files/review-providers?${query.toString()}`;
}

function buildFileReviewPageHref(
  params: Record<string, string | string[] | undefined>,
  page: number,
) {
  const query = new URLSearchParams();
  const filters = buildFileFilters(params);
  if (filters.q) {
    query.set('q', filters.q);
  }
  if (filters.kind) {
    query.set('kind', filters.kind);
  }
  if (filters.review) {
    query.set('review', filters.review);
  }
  if (page > 1) {
    query.set('page', String(page));
  }
  const search = query.toString();
  return search ? `/files?${search}` : '/files';
}

function readFileReviewPage(value: string | string[] | undefined) {
  const page = Number.parseInt(readSearchParam(value), 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function fileFilterOptions(filters: FileReviewFilters): FileFilterOption[] {
  return [
    {
      active: !filters.kind && !filters.review,
      href: fileFilterHref(filters, {}),
      label: 'All files',
      value: 'all',
    },
    {
      active: filters.review === 'needs-review',
      href: fileFilterHref(filters, { review: 'needs-review' }),
      label: 'Needs review',
      value: 'needs-review',
    },
    {
      active: filters.kind === 'public-media',
      href: fileFilterHref(filters, { kind: 'public-media' }),
      label: 'Public media',
      value: 'public-media',
    },
    {
      active: filters.kind === 'private-verification',
      href: fileFilterHref(filters, { kind: 'private-verification' }),
      label: 'Private files',
      value: 'private-verification',
    },
    {
      active: filters.review === 'approved',
      href: fileFilterHref(filters, { review: 'approved' }),
      label: 'Approved',
      value: 'approved',
    },
    {
      active: filters.review === 'rejected',
      href: fileFilterHref(filters, { review: 'rejected' }),
      label: 'Rejected',
      value: 'rejected',
    },
    {
      active: filters.review === 'upload-incomplete',
      href: fileFilterHref(filters, { review: 'upload-incomplete' }),
      label: 'Upload incomplete',
      value: 'upload-incomplete',
    },
  ];
}

function activeFileFilterValue(filters: FileReviewFilters) {
  return fileFilterOptions(filters).find((option) => option.active)?.value ?? 'all';
}

function fileReviewActiveFilterLabels(filters: FileReviewFilters, page: number) {
  const activeOption = fileFilterOptions(filters).find((option) => option.active);
  const labels = [
    `Queue: ${activeOption?.label ?? 'All files'}`,
    `Page: ${page}`,
    `Rows: ${FILE_REVIEW_PROVIDER_PAGE_SIZE}`,
  ];

  if (filters.q) {
    labels.push(`Search: ${filters.q}`);
  }

  return labels;
}

function fileFilterHref(
  filters: FileReviewFilters,
  nextFilter: Partial<Pick<FileReviewFilters, 'kind' | 'review'>>,
) {
  const params = new URLSearchParams();
  if (filters.q) {
    params.set('q', filters.q);
  }
  if (nextFilter.kind) {
    params.set('kind', nextFilter.kind);
  }
  if (nextFilter.review) {
    params.set('review', nextFilter.review);
  }
  const query = params.toString();
  return query ? `/files?${query}` : '/files';
}
