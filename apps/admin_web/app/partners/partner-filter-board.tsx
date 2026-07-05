import { Download, SlidersHorizontal } from 'lucide-react';

import {
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormSearch,
  AdminFormSelect,
} from '../../components/admin-form-controls';
import { AdminDirectoryFilterForm } from '../../components/admin-directory-filter-form';
import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { AdminSegmentedControl } from '../../components/admin-segmented-control';
import { AdminDisclosure } from '../../components/admin-surface';
import { StatusBadge } from '../../components/status-badge';

import { buildPartnerListHref, partnerSortLabel, type ProviderFilters } from './partner-filters';

type PartnerFilterBoardActiveFilter = {
  readonly description: string;
  readonly kind: string;
  readonly label: string;
  readonly value: string;
};

type PartnerFilterBoardProps = {
  readonly activeFilters: readonly PartnerFilterBoardActiveFilter[];
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
  csvDownloadName,
  csvHref,
  filteredCount,
  filters,
  locationFreshnessLabel,
  showAdvancedFilters,
  totalCount,
}: PartnerFilterBoardProps) {
  return (
    <AdminFilterPanel
      className="vuexy-partner-filter-card admin-mb-16"
      id="partner-directory-controls"
      resultLabel={`${filteredCount} of ${totalCount}`}
      title="Filters"
      footer={
        <div className="vuexy-partner-filter-footer admin-directory-filter-footer">
          {activeFilters.length > 0 ? (
            <div className="vuexy-partner-active-filters" aria-label="Active partner filters">
              {activeFilters.map((filter) => (
                <StatusBadge key={`${filter.kind}-${filter.value}`} tone="warning">
                  {filter.label}
                </StatusBadge>
              ))}
            </div>
          ) : null}
          <AdminFormControlLink className="admin-directory-filter-button is-ghost" href="/partners">
            Clear filters
          </AdminFormControlLink>
        </div>
      }
    >
      <AdminDirectoryFilterForm action="/partners" className="vuexy-partner-form">
        <input name="sort" type="hidden" value={filters.sort} />
        {filters.review && !showAdvancedFilters ? (
          <input name="review" type="hidden" value={filters.review} />
        ) : null}
        <div className="vuexy-partner-filter-grid admin-directory-filter-grid">
          <div className="vuexy-partner-filter-group admin-directory-filter-group is-primary" aria-label="Partner list filters">
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
          </div>
          <div className="vuexy-partner-filter-actions admin-directory-filter-actions" aria-label="Partner filter actions">
            <AdminFormControlLink className="admin-directory-filter-export" download={csvDownloadName} href={csvHref}>
              <Download aria-hidden="true" size={16} />
              Export
            </AdminFormControlLink>
            <AdminFormControlButton className="admin-directory-filter-button">Apply</AdminFormControlButton>
          </div>
        </div>
        <div className="booking-date-filter-bar vuexy-partner-filter-strip" aria-label="Partner sort filters">
          <span className="vuexy-partner-filter-group-label">Partner sort</span>
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
        {showAdvancedFilters ? (
          <AdminDisclosure className="vuexy-partner-filter-details" open>
            <summary>
              <span>More filters</span>
              <small>Location, device/session, booking flow, and review lane</small>
            </summary>
            <div className="vuexy-partner-advanced-filter-grid">
              <AdminFormSelect
                className="admin-directory-filter-select"
                defaultValue={filters.location}
                label="Location"
                name="location"
                options={partnerLocationFilterOptions}
              />
              <AdminFormSelect
                className="admin-directory-filter-select"
                defaultValue={filters.security}
                label="Device/session"
                name="security"
                options={partnerDeviceSessionFilterOptions}
              />
              <AdminFormSelect
                className="admin-directory-filter-select"
                defaultValue={filters.activity}
                label="Activity"
                name="activity"
                options={partnerActivityFilterOptions}
              />
              <AdminFormSelect
                className="admin-directory-filter-select"
                defaultValue={filters.bookingFlow}
                label="Booking flow"
                name="bookingFlow"
                options={partnerBookingFlowFilterOptions}
              />
              <AdminFormSelect
                className="admin-directory-filter-select"
                defaultValue={filters.review}
                label="Review lane"
                name="review"
                options={partnerReviewLaneFilterOptions}
              />
            </div>
          </AdminDisclosure>
        ) : null}
        <div className="vuexy-partner-filter-meta" aria-label="Partner filter status">
          <span className="muted">
            Showing {filteredCount} of {totalCount} matching partners
            {filters.sort !== 'ops-priority' ? ` - sorted by ${partnerSortLabel(filters.sort)}` : ''}
          </span>
          <AdminFormControlLink className="admin-directory-filter-button is-ghost" href="/operations-policy">
            <SlidersHorizontal aria-hidden="true" size={16} />
            {locationFreshnessLabel}
          </AdminFormControlLink>
        </div>
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
  { label: 'Checklist', value: 'ops-priority' },
  { label: 'Last work', value: 'last-work' },
  { label: 'Bookings', value: 'booking-count' },
  { label: 'Completed', value: 'completed-count' },
  { label: 'Revenue', value: 'gross-revenue' },
  { label: 'Wallet debt', value: 'wallet-debt' },
  { label: 'Name', value: 'name' },
] as const;

const partnerLocationFilterOptions = [
  { label: 'All locations', value: '' },
  { label: 'Recent', value: 'recent' },
  { label: 'Stale', value: 'stale' },
  { label: 'Expired', value: 'expired' },
  { label: 'Missing', value: 'missing' },
] as const;

const partnerDeviceSessionFilterOptions = [
  { label: 'All devices', value: '' },
  { label: 'Account blocked', value: 'account-blocked' },
  { label: 'Blocked device', value: 'blocked' },
  { label: 'Session check', value: 'session-check' },
  { label: 'Shared device', value: 'shared' },
  { label: 'No app device', value: 'missing' },
  { label: 'Clear', value: 'clear' },
] as const;

const partnerActivityFilterOptions = [
  { label: 'All activity', value: '' },
  { label: 'Never online', value: 'never-online' },
  { label: 'Inactive 7D', value: 'inactive-7d' },
  { label: 'Inactive 30D', value: 'inactive-30d' },
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

const partnerReviewLaneFilterOptions = [
  { label: 'All review lanes', value: '' },
  { label: 'Unapproved Partners', value: 'unapproved' },
  { label: 'Unsettled Partners', value: 'unsettled' },
  { label: 'KYC updates', value: 'kyc' },
  { label: 'Document review', value: 'documents' },
  { label: 'Public media review', value: 'public-media' },
  { label: 'Withdrawal detail review', value: 'bank' },
  { label: 'First earning payout setup', value: 'payout-setup' },
  { label: 'Cash fee debt', value: 'cash-debt' },
  { label: 'Device/session check', value: 'security' },
  { label: 'Reports/controls', value: 'reports' },
  { label: 'Account blocks', value: 'blocked' },
  { label: 'Location freshness', value: 'location' },
  { label: 'Push alert readiness', value: 'push' },
  { label: 'Direct request held', value: 'acceptance-blocked' },
  { label: 'Direct request ready', value: 'direct-ready' },
  { label: 'Marketplace ready', value: 'marketplace-ready' },
  { label: 'Dispatch repair', value: 'marketplace-blocked' },
] as const;
