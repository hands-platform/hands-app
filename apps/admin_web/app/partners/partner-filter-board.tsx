import { Download, SlidersHorizontal } from 'lucide-react';

import {
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormSearch,
  AdminFormSelect,
} from '../../components/admin-form-controls';
import { AdminDirectoryFilterForm } from '../../components/admin-directory-filter-form';
import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { AdminFilterSummary } from '../../components/admin-filter-summary';
import { AdminSegmentedControl } from '../../components/admin-segmented-control';
import { AdminDisclosure } from '../../components/admin-surface';
import { AdminQueueAgeSortControls } from '../../components/admin-queue-age-sort-controls';
import { type AdminQueueAgeCounts, type AdminQueueSlaSummary } from '../../lib/admin-queue-list';

import { buildPartnerListHref, partnerSortLabel, type ProviderFilters } from './partner-filters';
import { PARTNER_APPROVAL_QUEUE_HREF } from './partner-review-mode';

type PartnerFilterBoardActiveFilter = {
  readonly description: string;
  readonly kind: string;
  readonly label: string;
  readonly value: string;
};

type PartnerFilterBoardProps = {
  readonly activeFilters: readonly PartnerFilterBoardActiveFilter[];
  readonly ageCounts?: AdminQueueAgeCounts;
  readonly queueSla?: AdminQueueSlaSummary;
  readonly csvDownloadName: string;
  readonly csvHref: string;
  readonly filteredCount: number;
  readonly filters: ProviderFilters;
  readonly locationFreshnessLabel: string;
  readonly showAdvancedFilters: boolean;
  readonly totalCount: number;
};

export function PartnerFilterBoard({
  activeFilters,
  ageCounts,
  queueSla,
  csvDownloadName,
  csvHref,
  filteredCount,
  filters,
  locationFreshnessLabel,
  showAdvancedFilters,
  totalCount,
}: PartnerFilterBoardProps) {
  if (filters.review === 'approval-pending') {
    return (
      <PartnerApprovalFilterBoard
        ageCounts={ageCounts}
        filters={filters}
        queueSla={queueSla}
        totalCount={totalCount}
      />
    );
  }

  if (filters.review === 'unapproved' || filters.review === 'unsettled') {
    return (
      <PartnerTaskQueueFilterBoard
        activeFilters={activeFilters}
        csvDownloadName={csvDownloadName}
        csvHref={csvHref}
        filteredCount={filteredCount}
        filters={filters}
        totalCount={totalCount}
      />
    );
  }

  return (
    <AdminFilterPanel
      className="vuexy-partner-filter-card admin-mb-16"
      id="partner-directory-controls"
      resultLabel={`${filteredCount} on this page / ${totalCount} total`}
      title="Partner directory filters"
    >
      <AdminDirectoryFilterForm
        action="/partners"
        canonicalDefaults={{ sort: 'newest' }}
        className="vuexy-partner-form"
      >
        <input name="sort" type="hidden" value={filters.sort} />
        {filters.review ? <input name="review" type="hidden" value={filters.review} /> : null}
        <div className="vuexy-partner-filter-grid admin-directory-filter-grid">
          <div
            className="vuexy-partner-filter-group admin-directory-filter-group is-primary"
            aria-label="Partner list filters"
          >
            <AdminFormSearch
              className="admin-directory-filter-search"
              defaultValue={filters.q}
              label="Search Partner"
              name="q"
              placeholder="Name, phone, city, partner id"
            />
            <AdminFormSelect
              className="admin-directory-filter-select"
              defaultValue={filters.providerStatus}
              label="State"
              name="providerStatus"
              options={partnerStateFilterOptions}
            />
            <AdminFormSelect
              className="admin-directory-filter-select"
              defaultValue={filters.activity}
              label="App activity"
              name="activity"
              options={partnerActivityFilterOptions}
            />
            <AdminFormSelect
              className="admin-directory-filter-select"
              defaultValue={filters.verification}
              label="Verification"
              name="verification"
              options={partnerVerificationFilterOptions}
            />
            <AdminFormSelect
              className="admin-directory-filter-select"
              defaultValue={filters.kyc}
              label="KYC"
              name="kyc"
              options={partnerKycFilterOptions}
            />
            <AdminFormSelect
              className="admin-directory-filter-select"
              defaultValue={filters.bookingFlow}
              label="Booking flow"
              name="bookingFlow"
              options={partnerBookingFlowFilterOptions}
            />
          </div>
          <div
            className="vuexy-partner-filter-actions admin-directory-filter-actions"
            aria-label="Partner filter actions"
          >
            {filteredCount > 0 ? (
              <AdminFormControlLink
                className="admin-directory-filter-export"
                download={csvDownloadName}
                href={csvHref}
              >
                <Download aria-hidden="true" size={16} />
                Export current page ({filteredCount})
              </AdminFormControlLink>
            ) : (
              <AdminFormControlButton
                className="admin-directory-filter-export"
                disabled
                title="No records to export"
                type="button"
              >
                <Download aria-hidden="true" size={16} />
                No records to export
              </AdminFormControlButton>
            )}
            <AdminFormControlButton className="admin-directory-filter-button">Apply</AdminFormControlButton>
          </div>
        </div>
        <div className="vuexy-partner-filter-secondary-row">
          <div
            className="booking-date-filter-bar vuexy-partner-filter-strip"
            aria-label="Partner sort filters"
          >
            <span className="vuexy-partner-filter-group-label">Sort</span>
            <AdminSegmentedControl
              activeValue={filters.sort}
              ariaLabel="Partner sort"
              className="vuexy-partner-filter-buttons"
              options={partnerSortButtonOptions.map((option) => ({
                href: buildPartnerListHref(filters, { sort: option.value }),
                label: option.label,
                value: option.value,
              }))}
            />
          </div>
          {['high-cancellation', 'no-show-risk', 'quality-risk', 'quality-all'].includes(filters.review) ? (
            <AdminDisclosure className="vuexy-partner-filter-details" open={showAdvancedFilters}>
              <summary>
                <span>Quality period</span>
                <small>Review outcome range</small>
              </summary>
              <div className="vuexy-partner-advanced-filter-grid">
                <AdminFormSelect
                  className="admin-directory-filter-select"
                  defaultValue={filters.qualityRange ?? '30d'}
                  label="Quality range"
                  name="qualityRange"
                  options={partnerQualityRangeFilterOptions}
                />
              </div>
            </AdminDisclosure>
          ) : null}
        </div>
        <div className="vuexy-partner-filter-meta" aria-label="Partner filter status">
          <div className="vuexy-partner-filter-meta-copy">
            <span className="muted">
              Showing {filteredCount} of {totalCount} matching partners under the active filters
              {' - '}sorted by {partnerSortLabel(filters.sort)}
            </span>
            <AdminFilterSummary
              ariaLabel="Active partner filters"
              className="vuexy-partner-active-filters"
              labels={activeFilters.map((filter) => filter.label)}
            />
          </div>
          <div className="vuexy-partner-filter-meta-actions">
            <AdminFormControlLink
              className="admin-directory-filter-button is-ghost"
              href="/operations-policy"
            >
              <SlidersHorizontal aria-hidden="true" size={16} />
              {locationFreshnessLabel}
            </AdminFormControlLink>
            <AdminFormControlLink
              className="admin-directory-filter-button is-ghost"
              href={partnerQueueHref(filters.review)}
            >
              Clear filters
            </AdminFormControlLink>
          </div>
        </div>
      </AdminDirectoryFilterForm>
    </AdminFilterPanel>
  );
}

function PartnerTaskQueueFilterBoard({
  activeFilters,
  csvDownloadName,
  csvHref,
  filteredCount,
  filters,
  totalCount,
}: Pick<
  PartnerFilterBoardProps,
  'activeFilters' | 'csvDownloadName' | 'csvHref' | 'filteredCount' | 'filters' | 'totalCount'
>) {
  const onboarding = filters.review === 'unapproved';
  const queueSortOptions = onboarding ? partnerQueueSortButtonOptions : partnerWalletQueueSortButtonOptions;
  const queueTitle = onboarding ? 'Onboarding filters' : 'Wallet debt filters';
  const queueDescription = onboarding
    ? 'Narrow by the current verification stage or recent Partner App activity, then review the top blocker.'
    : 'Search the canonical negative VND balance queue. Review ledger origin and timing in Partner detail.';

  return (
    <AdminFilterPanel
      className="vuexy-partner-filter-card admin-mb-16"
      description={queueDescription}
      id="partner-directory-controls"
      resultLabel={`${filteredCount} on this page / ${totalCount} total`}
      title={queueTitle}
    >
      <AdminDirectoryFilterForm
        action="/partners"
        canonicalDefaults={{ sort: 'newest' }}
        className="vuexy-partner-form"
      >
        <input name="review" type="hidden" value={filters.review} />
        <input name="sort" type="hidden" value={filters.sort} />
        <div className="vuexy-partner-filter-grid admin-directory-filter-grid">
          <div
            aria-label={onboarding ? 'Onboarding blocker filters' : 'Wallet debt filters'}
            className="vuexy-partner-filter-group admin-directory-filter-group is-primary"
          >
            <AdminFormSearch
              className="admin-directory-filter-search"
              defaultValue={filters.q}
              label="Search Partner"
              name="q"
              placeholder="Name, phone, city, partner id"
            />
            {onboarding ? (
              <>
                <AdminFormSelect
                  className="admin-directory-filter-select"
                  defaultValue={filters.verification}
                  label="Verification stage"
                  name="verification"
                  options={partnerVerificationFilterOptions}
                />
                <AdminFormSelect
                  className="admin-directory-filter-select"
                  defaultValue={filters.kyc}
                  label="KYC stage"
                  name="kyc"
                  options={partnerKycFilterOptions}
                />
                <AdminFormSelect
                  className="admin-directory-filter-select"
                  defaultValue={filters.activity}
                  label="Partner activity"
                  name="activity"
                  options={partnerActivityFilterOptions}
                />
              </>
            ) : null}
          </div>
          <div
            aria-label={onboarding ? 'Onboarding filter actions' : 'Wallet debt filter actions'}
            className="vuexy-partner-filter-actions admin-directory-filter-actions"
          >
            {filteredCount > 0 ? (
              <AdminFormControlLink
                className="admin-directory-filter-export"
                download={csvDownloadName}
                href={csvHref}
              >
                <Download aria-hidden="true" size={16} />
                Export current page ({filteredCount})
              </AdminFormControlLink>
            ) : (
              <AdminFormControlButton
                className="admin-directory-filter-export"
                disabled
                title="No records to export"
                type="button"
              >
                <Download aria-hidden="true" size={16} />
                No records to export
              </AdminFormControlButton>
            )}
            <AdminFormControlButton className="admin-directory-filter-button">Apply</AdminFormControlButton>
          </div>
        </div>
        <div className="vuexy-partner-filter-secondary-row">
          <div
            aria-label={`${queueTitle} sort`}
            className="booking-date-filter-bar vuexy-partner-filter-strip"
          >
            <span className="vuexy-partner-filter-group-label">Sort</span>
            <AdminSegmentedControl
              activeValue={filters.sort}
              ariaLabel={`${queueTitle} sort`}
              className="vuexy-partner-filter-buttons"
              options={queueSortOptions.map((option) => ({
                href: buildPartnerListHref(filters, { sort: option.value }),
                label: option.label,
                value: option.value,
              }))}
            />
          </div>
        </div>
        <div className="vuexy-partner-filter-meta" aria-label={`${queueTitle} status`}>
          <div className="vuexy-partner-filter-meta-copy">
            <span className="muted">
              Showing {filteredCount} of {totalCount} matching Partners - sorted by{' '}
              {partnerSortLabel(filters.sort)}
            </span>
            <AdminFilterSummary
              ariaLabel={`Active ${queueTitle.toLowerCase()}`}
              className="vuexy-partner-active-filters"
              labels={activeFilters.map((filter) => filter.label)}
            />
          </div>
          <div className="vuexy-partner-filter-meta-actions">
            <AdminFormControlLink
              className="admin-directory-filter-button is-ghost"
              href={partnerQueueHref(filters.review)}
            >
              Clear {onboarding ? 'onboarding' : 'wallet debt'} filters
            </AdminFormControlLink>
          </div>
        </div>
      </AdminDirectoryFilterForm>
    </AdminFilterPanel>
  );
}

function PartnerApprovalFilterBoard({
  ageCounts,
  filters,
  queueSla,
  totalCount,
}: Pick<PartnerFilterBoardProps, 'ageCounts' | 'filters' | 'queueSla' | 'totalCount'>) {
  return (
    <AdminFilterPanel
      className="vuexy-partner-filter-card admin-mb-16"
      description="Find the oldest submitted dossier, then narrow by missing evidence or correction risk."
      id="partner-approval-controls"
      resultLabel={`${totalCount} awaiting decision`}
      title="Approval queue filters"
      footer={
        <div className="vuexy-partner-filter-footer admin-directory-filter-footer">
          <AdminFormControlLink
            className="admin-directory-filter-button is-ghost"
            href={PARTNER_APPROVAL_QUEUE_HREF}
          >
            Clear approval filters
          </AdminFormControlLink>
        </div>
      }
    >
      <AdminDirectoryFilterForm action="/partners" canonicalDefaults={{}} className="vuexy-partner-form">
        <input name="age" type="hidden" value={filters.age} />
        <input name="review" type="hidden" value="approval-pending" />
        {filters.sla && filters.sla !== 'all' ? <input name="sla" type="hidden" value={filters.sla} /> : null}
        <input name="sort" type="hidden" value="oldest" />
        <div className="vuexy-partner-filter-grid admin-directory-filter-grid">
          <div
            aria-label="Partner approval filters"
            className="vuexy-partner-filter-group admin-directory-filter-group is-primary"
          >
            <AdminFormSearch
              className="admin-directory-filter-search"
              defaultValue={filters.q}
              label="Search Partner"
              name="q"
              placeholder="Name, phone, city, partner id"
            />
            <AdminFormSelect
              className="admin-directory-filter-select"
              defaultValue={filters.approvalMissing}
              label="Missing item"
              name="approvalMissing"
              options={partnerApprovalMissingFilterOptions}
            />
            <AdminFormSelect
              className="admin-directory-filter-select"
              defaultValue={filters.approvalRisk}
              label="Risk flag"
              name="approvalRisk"
              options={partnerApprovalRiskFilterOptions}
            />
          </div>
          <div className="vuexy-partner-filter-actions admin-directory-filter-actions">
            <AdminFormControlButton className="admin-directory-filter-button">Apply</AdminFormControlButton>
          </div>
        </div>
        <AdminQueueAgeSortControls
          age={filters.age}
          ageAriaLabel="Approval waiting age"
          ageCounts={ageCounts}
          ageHref={(age) => buildPartnerListHref(filters, { age })}
          ageLabel="Waiting age"
          sla={queueSla}
          slaFilter={filters.sla}
          slaHref={(sla) => buildPartnerListHref(filters, { sla })}
          sort="oldest"
          sortHref={() => PARTNER_APPROVAL_QUEUE_HREF}
          sortOptions={[{ label: 'Oldest first', value: 'oldest' }]}
        />
      </AdminDirectoryFilterForm>
    </AdminFilterPanel>
  );
}

const partnerVerificationFilterOptions = [
  { label: 'All verification', value: '' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Submitted', value: 'SUBMITTED' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Rejected', value: 'REJECTED' },
  { label: 'Blocked', value: 'BLOCKED' },
] as const;

const partnerStateFilterOptions = [
  { label: 'All states', value: '' },
  { label: 'Online available', value: 'ONLINE_AVAILABLE' },
  { label: 'Online busy', value: 'ONLINE_BUSY' },
  { label: 'Available soon', value: 'ONLINE_AVAILABLE_SOON' },
  { label: 'Offline', value: 'OFFLINE' },
] as const;

const partnerKycFilterOptions = [
  { label: 'All KYC', value: '' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Rejected', value: 'REJECTED' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Missing', value: 'MISSING' },
] as const;

const partnerSortButtonOptions = [
  { label: 'Newest', value: 'newest' },
  { label: 'Oldest', value: 'oldest' },
  { label: 'Name', value: 'name' },
] as const;

const partnerQueueSortButtonOptions = [
  { label: 'Recently registered', value: 'newest' },
  { label: 'Name', value: 'name' },
] as const;

const partnerWalletQueueSortButtonOptions = [
  ...partnerQueueSortButtonOptions,
  { label: 'Debt: high to low', value: 'wallet-debt' },
] as const;

function partnerQueueHref(review: string) {
  if (review === 'unapproved') return '/partners?review=unapproved';
  if (review === 'unsettled') return '/partners?review=unsettled';
  return '/partners';
}

const partnerActivityFilterOptions = [
  { label: 'All activity', value: '' },
  { label: 'App active 7D', value: 'app-active-7d' },
  { label: 'App inactive 7D+', value: 'app-inactive-7d' },
  { label: 'App not tracked', value: 'app-not-tracked' },
  { label: 'No factual activity 7D', value: 'inactive-7d' },
  { label: 'No factual activity 30D', value: 'inactive-30d' },
  { label: 'No recorded session', value: 'never-online' },
] as const;

const partnerApprovalMissingFilterOptions = [
  { label: 'All missing items', value: '' },
  { label: 'Identity documents', value: 'identity-documents' },
  { label: 'Public profile media', value: 'public-media' },
] as const;

const partnerApprovalRiskFilterOptions = [
  { label: 'All risk flags', value: '' },
  { label: 'Rejected evidence', value: 'rejected-evidence' },
  { label: 'Previous hold / correction', value: 'previous-hold' },
] as const;

const partnerBookingFlowFilterOptions = [
  { label: 'All booking flows', value: '' },
  { label: 'Has active booking', value: 'active-booking' },
  { label: 'First-pick booking', value: 'first-pick' },
  { label: 'Marketplace participant', value: 'marketplace-joined' },
  { label: 'Customer final choice', value: 'final-partner' },
  { label: 'Chat room opened', value: 'chat-live' },
  { label: 'Matched but chat missing', value: 'chat-missing' },
  { label: 'Completed work', value: 'completed-work' },
  { label: 'No completed work', value: 'no-work' },
] as const;

const partnerQualityRangeFilterOptions = [
  { label: 'Today', value: 'today' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'Last 90 days', value: '90d' },
] as const;
