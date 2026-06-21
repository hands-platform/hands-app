import { Download, SlidersHorizontal } from 'lucide-react';

import {
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormSearch,
  AdminFormSelect,
} from '../../components/admin-form-controls';
import { AdminFilterPanel } from '../../components/admin-filter-panel';

import { partnerSortLabel, type ProviderFilters } from './partner-filters';

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

const partnerPageOptions = [
  { label: 'Partners', review: '' },
  { label: 'Unapproved Partners', review: 'unapproved' },
  { label: 'Unsettled Partners', review: 'unsettled' },
] as const;

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
        <div className="vuexy-partner-filter-footer">
          {activeFilters.length > 0 ? (
            <>
              {activeFilters.map((filter) => (
                <span className="pill pill-warn" key={`${filter.kind}-${filter.value}`}>
                  {filter.label}
                </span>
              ))}
            </>
          ) : (
            <AdminFormControlLink className="vuexy-partner-button is-ghost" href="/partners">
              Clear filters
            </AdminFormControlLink>
          )}
        </div>
      }
    >
      <form action="/partners" className="vuexy-partner-form">
        <input name="sort" type="hidden" value={filters.sort} />
        <div className="vuexy-partner-filter-grid">
          <div className="vuexy-partner-filter-group is-primary" aria-label="Partner list filters">
            <AdminFormSearch
              className="vuexy-partner-search"
              defaultValue={filters.q}
              label="Search Partner"
              name="q"
              placeholder="Name, phone, city, partner id"
            />
            <AdminFormSelect
              className="vuexy-partner-select"
              defaultValue={filters.providerStatus}
              label="State"
              name="providerStatus"
              options={partnerStateFilterOptions}
            />
            <AdminFormSelect
              className="vuexy-partner-select"
              defaultValue={filters.verification}
              label="Verification"
              name="verification"
              options={partnerVerificationFilterOptions}
            />
            <AdminFormSelect
              className="vuexy-partner-select"
              defaultValue={filters.kyc}
              label="KYC"
              name="kyc"
              options={partnerKycFilterOptions}
            />
          </div>
          <div className="vuexy-partner-filter-actions" aria-label="Partner filter actions">
            <AdminFormControlLink className="vuexy-partner-export" download={csvDownloadName} href={csvHref}>
              <Download aria-hidden="true" size={16} />
              Export
            </AdminFormControlLink>
            <AdminFormControlButton className="vuexy-partner-button">Apply</AdminFormControlButton>
          </div>
        </div>
        <div className="vuexy-partner-filter-strip" aria-label="Partner page filters">
          <span className="vuexy-partner-filter-group-label">Partner pages</span>
          <div className="booking-date-filter-buttons vuexy-partner-filter-buttons" role="group">
            {partnerPageOptions.map((option) => (
              <a
                aria-current={filters.review === option.review ? 'page' : undefined}
                className={filters.review === option.review ? 'is-active' : undefined}
                href={buildPartnerFilterHref(filters, { review: option.review })}
                key={option.review || 'partners'}
              >
                {option.label}
              </a>
            ))}
          </div>
        </div>
        <div className="vuexy-partner-filter-strip" aria-label="Partner sort filters">
          <span className="vuexy-partner-filter-group-label">Partner sort</span>
          <div className="booking-date-filter-buttons vuexy-partner-filter-buttons" role="group">
            {partnerSortButtonOptions.map((option) => (
              <a
                aria-current={filters.sort === option.value ? 'page' : undefined}
                className={filters.sort === option.value ? 'is-active' : undefined}
                href={buildPartnerFilterHref(filters, { sort: option.value })}
                key={option.value}
              >
                {option.label}
              </a>
            ))}
          </div>
        </div>
        <details className="vuexy-partner-filter-details" open={showAdvancedFilters}>
          <summary>
            <span>More filters</span>
            <small>Location, device/session, booking flow, and review lane</small>
          </summary>
          <div className="vuexy-partner-advanced-filter-grid">
            <AdminFormSelect
              className="vuexy-partner-select"
              defaultValue={filters.location}
              label="Location"
              name="location"
              options={partnerLocationFilterOptions}
            />
            <AdminFormSelect
              className="vuexy-partner-select"
              defaultValue={filters.security}
              label="Device/session"
              name="security"
              options={partnerDeviceSessionFilterOptions}
            />
            <AdminFormSelect
              className="vuexy-partner-select"
              defaultValue={filters.bookingFlow}
              label="Booking flow"
              name="bookingFlow"
              options={partnerBookingFlowFilterOptions}
            />
            <AdminFormSelect
              className="vuexy-partner-select"
              defaultValue={filters.review}
              label="Review lane"
              name="review"
              options={partnerReviewLaneFilterOptions}
            />
          </div>
        </details>
        <div className="vuexy-partner-filter-meta" aria-label="Partner filter status">
          <span className="muted">
            Showing {filteredCount} of {totalCount} matching partners
            {filters.sort !== 'ops-priority' ? ` - sorted by ${partnerSortLabel(filters.sort)}` : ''}
          </span>
          <AdminFormControlLink className="vuexy-partner-button is-ghost" href="/operations-policy">
            <SlidersHorizontal aria-hidden="true" size={16} />
            {locationFreshnessLabel}
          </AdminFormControlLink>
        </div>
      </form>
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
  { label: 'Bank payout review', value: 'bank' },
  { label: 'First earning payout setup', value: 'payout-setup' },
  { label: 'Cash fee debt', value: 'cash-debt' },
  { label: 'Legacy tax profile review', value: 'tax' },
  { label: 'Device/session check', value: 'security' },
  { label: 'Reports/controls', value: 'reports' },
  { label: 'Account blocks', value: 'blocked' },
  { label: 'Location freshness', value: 'location' },
  { label: 'Push alert readiness', value: 'push' },
  { label: 'Direct request held', value: 'acceptance-blocked' },
  { label: 'Direct request ready', value: 'direct-ready' },
  { label: 'Marketplace ready', value: 'marketplace-ready' },
  { label: 'Marketplace repair', value: 'marketplace-blocked' },
] as const;

function buildPartnerFilterHref(filters: ProviderFilters, updates: Partial<ProviderFilters>) {
  const nextFilters = { ...filters, ...updates };
  const params = new URLSearchParams();

  partnerFilterHrefParamKeys.forEach((key) => {
    const value = nextFilters[key];
    if (value && !(key === 'sort' && value === 'ops-priority')) {
      params.set(key, value);
    }
  });

  const query = params.toString();
  return query ? `/partners?${query}` : '/partners';
}

const partnerFilterHrefParamKeys = [
  'q',
  'verification',
  'providerStatus',
  'kyc',
  'location',
  'security',
  'readiness',
  'bookingFlow',
  'review',
  'sort',
] as const satisfies readonly (keyof ProviderFilters)[];
