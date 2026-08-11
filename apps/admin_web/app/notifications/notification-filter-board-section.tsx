import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { AdminFilterSummary } from '../../components/admin-filter-summary';
import { AdminSegmentedControl } from '../../components/admin-segmented-control';
import {
  AdminFormActionRow,
  AdminFormControlButton,
  AdminFormSelect,
  AdminFormShell,
} from '../../components/admin-form-controls';
import { StatusBadge } from '../../components/status-badge';
import type {
  AdminQueueAge,
  AdminQueueAgeCounts,
  AdminQueueSlaSummary,
  AdminQueueSlaFilter,
  AdminQueueSort,
} from '../../lib/admin-queue-list';
import { AdminQueueAgeSortControls } from '../../components/admin-queue-age-sort-controls';
import { AdminDisclosure } from '../../components/admin-surface';
import { adminCountLabel } from '../../lib/admin-copy';
import type {
  NotificationDateRange,
  NotificationFinanceAge,
  NotificationIncidentState,
} from './notification-page-model';

export type NotificationFilterLink = {
  readonly href: string;
  readonly label: string;
  readonly review: string;
};

export type NotificationDateRangeLink = {
  readonly href: string;
  readonly label: string;
  readonly range: NotificationDateRange;
};

export type NotificationIncidentStateLink = {
  readonly href: string;
  readonly label: string;
  readonly state: NotificationIncidentState;
};

export type NotificationFinanceAgeLink = {
  readonly href: string;
  readonly label: string;
  readonly value: NotificationFinanceAge;
};

export type NotificationFinanceOwnerOption = {
  readonly label: string;
  readonly value: string;
};

export type NotificationFinanceOwnerLink = NotificationFinanceOwnerOption & {
  readonly href: string;
};

export type NotificationReviewRunbookView = {
  readonly detail: string;
  readonly primaryAction: string;
  readonly title: string;
};

type NotificationFilterBoardSectionProps = {
  readonly activeAge?: AdminQueueAge;
  readonly ageCounts?: AdminQueueAgeCounts;
  readonly queueSla?: AdminQueueSlaSummary;
  readonly activeSla?: AdminQueueSlaFilter;
  readonly activeBookingLabel: string | null;
  readonly activeFinanceAge?: NotificationFinanceAge;
  readonly activeFilterDescription: string | null;
  readonly activeFilterLabel: string | null;
  readonly activeIncidentState: NotificationIncidentState;
  readonly activeReview: string;
  readonly activeReviewRunbook: NotificationReviewRunbookView | null;
  readonly activeRange: NotificationDateRange;
  readonly activeRangeLabel: string;
  readonly activeSort?: AdminQueueSort;
  readonly ageHref?: (age: AdminQueueAge) => string;
  readonly clearHref: string;
  readonly filteredCount: number;
  readonly financeAgeLinks?: readonly NotificationFinanceAgeLink[];
  readonly financeOwner?: string;
  readonly financeOwnerLinks?: readonly NotificationFinanceOwnerLink[];
  readonly financeOwnerOptions?: readonly NotificationFinanceOwnerOption[];
  readonly incidentStateLinks: readonly NotificationIncidentStateLink[];
  readonly links: readonly NotificationFilterLink[];
  readonly rangeLinks: readonly NotificationDateRangeLink[];
  readonly totalCount: number;
  readonly sortHref?: (sort: AdminQueueSort) => string;
  readonly slaHref?: (sla: AdminQueueSlaFilter) => string;
  readonly showQueueAgeControls?: boolean;
  readonly showRangeControls?: boolean;
};

export function NotificationFilterBoardSection({
  activeAge = 'all',
  ageCounts,
  queueSla,
  activeSla = 'all',
  activeBookingLabel,
  activeFinanceAge = 'all',
  activeFilterDescription,
  activeFilterLabel,
  activeIncidentState,
  activeReview,
  activeReviewRunbook,
  activeRange,
  activeRangeLabel,
  activeSort = 'newest',
  ageHref = (value) => `?age=${value}`,
  clearHref,
  filteredCount,
  financeAgeLinks = [],
  financeOwner = '',
  financeOwnerLinks = [],
  financeOwnerOptions = [],
  incidentStateLinks,
  links,
  rangeLinks,
  totalCount,
  sortHref = (value) => `?sort=${value}`,
  slaHref,
  showQueueAgeControls = true,
  showRangeControls = true,
}: NotificationFilterBoardSectionProps) {
  const primaryReviewValues = new Set([
    'all',
    'delivery-incidents',
    'delivery-incident-history',
    'system-incidents',
    'finance-overdue',
    'finance-overdue-history',
  ]);
  const primaryLinks = links.filter((link) => primaryReviewValues.has(link.review));
  const additionalLinks = links.filter((link) => !primaryReviewValues.has(link.review));
  const isFiltered = Boolean(
    (activeReview && activeReview !== 'all') ||
    activeIncidentState !== 'all' ||
    activeBookingLabel ||
    activeFinanceAge !== 'all' ||
    financeOwner ||
    activeAge !== 'all' ||
    activeSla !== 'all' ||
    activeSort !== 'newest',
  );
  const showAdvancedFilters = Boolean(
    (activeReview && !primaryReviewValues.has(activeReview)) ||
    (showRangeControls && activeRange !== 'today') ||
    activeIncidentState !== 'all' ||
    activeBookingLabel ||
    activeFinanceAge !== 'all' ||
    financeOwner ||
    activeAge !== 'all' ||
    activeSla !== 'all' ||
    activeSort !== 'newest',
  );

  return (
    <AdminFilterPanel
      className="notification-filter-card admin-mb-16"
      description={
        <>
          Current queue: <strong>{activeFilterLabel ?? 'All notifications'}</strong>.
          {activeFilterLabel && activeFilterDescription ? (
            <> {activeFilterDescription}</>
          ) : null}
          {!showRangeControls ? ' This queue uses a fixed operational time boundary.' : null}
          {activeBookingLabel ? (
            <> Booking context: <strong>{activeBookingLabel}</strong>.</>
          ) : null}
        </>
      }
      id="notification-operation-filters"
      resultLabel={`Showing ${adminCountLabel(filteredCount, 'notification')} of ${totalCount} / ${activeRangeLabel}`}
      resultTone={isFiltered ? 'warning' : 'success'}
      title="Notification operation filters"
    >
      <div className="booking-date-filter-bar notification-review-filter-bar">
        <span className="notification-filter-group-label">Queue</span>
        <AdminSegmentedControl
          activeValue={activeReview || 'all'}
          ariaLabel="Notification review filters"
          className="notification-review-filter-buttons"
          options={[
            ...(isFiltered ? [{ href: clearHref, label: 'Clear filter', value: 'clear' }] : []),
            ...primaryLinks.map((link) => ({
              href: link.href,
              label: link.label,
              value: link.review,
            })),
          ]}
        />
      </div>
      <AdminDisclosure
        ariaLabel="Advanced notification filters"
        className="admin-mt-12"
        open={showAdvancedFilters}
      >
        <summary>
          <span>Advanced filters</span>
          <small>Range, age, SLA, owner, and incident state</small>
        </summary>
        <div className="admin-disclosure-content">
          <AdminFilterSummary
            ariaLabel="Active notification filters"
            labels={notificationActiveFilterLabels({
              activeBookingLabel,
              activeFilterLabel,
              activeFinanceAge,
              activeIncidentState,
              activeRangeLabel,
              financeOwner,
              financeOwnerOptions,
            })}
            tone="info"
          />
          {showRangeControls ? (
            <div
              className="booking-date-filter-bar notification-date-filter-bar"
              aria-label="Notification date range"
            >
              <span className="notification-filter-group-label">Range</span>
              <AdminSegmentedControl
                activeValue={activeRange}
                ariaLabel="Notification date range"
                className="notification-date-filter-buttons"
                options={rangeLinks.map((link) => ({
                  href: link.href,
                  label: link.label,
                  value: link.range,
                }))}
              />
            </div>
          ) : null}
          {showQueueAgeControls ? (
            <AdminQueueAgeSortControls
              age={activeAge}
              ageCounts={ageCounts}
              ageHref={ageHref}
              sla={queueSla}
              slaFilter={activeSla}
              slaHref={slaHref}
              sort={activeSort}
              sortHref={sortHref}
            />
          ) : null}
          {financeAgeLinks.length > 0 ? (
            <div className="booking-date-filter-bar notification-finance-age-filter-bar">
              <span className="notification-filter-group-label">SLA age</span>
              <AdminSegmentedControl
                activeValue={activeFinanceAge}
                ariaLabel="Finance review SLA age"
                options={financeAgeLinks.map((link) => ({
                  href: link.href,
                  label: link.label,
                  value: link.value,
                }))}
              />
            </div>
          ) : null}
          {financeOwnerOptions.length > 0 ? (
            <>
              {financeOwnerLinks.length > 0 ? (
                <div className="booking-date-filter-bar notification-finance-owner-quick-filter">
                  <span className="notification-filter-group-label">Owner workload</span>
                  <AdminSegmentedControl
                    activeValue={financeOwner}
                    ariaLabel="Finance review owner workload"
                    options={financeOwnerLinks.map((link) => ({
                      href: link.href,
                      label: link.label,
                      value: link.value,
                    }))}
                  />
                </div>
              ) : null}
              <AdminFormShell action="/notifications" className="filter-form notification-finance-owner-filter" method="get">
                <input name="range" type="hidden" value={activeRange} />
                <input name="review" type="hidden" value={activeReview} />
                <input name="financeAge" type="hidden" value={activeFinanceAge} />
                <AdminFormSelect
                  defaultValue={financeOwner}
                  label="Review owner"
                  labelVisibility="visible"
                  name="financeOwner"
                  options={financeOwnerOptions}
                />
                <AdminFormActionRow>
                  <AdminFormControlButton className="button-primary" type="submit">
                    Apply owner
                  </AdminFormControlButton>
                </AdminFormActionRow>
              </AdminFormShell>
            </>
          ) : null}
          {activeReviewRunbook ? (
            <div className="admin-mt-10">
              <StatusBadge tone="info">{activeReviewRunbook.title}</StatusBadge>
              <p className="muted admin-mt-6">{activeReviewRunbook.detail}</p>
              <p className="muted admin-mt-6">
                <strong>Next action:</strong> {activeReviewRunbook.primaryAction}
              </p>
            </div>
          ) : null}
          {incidentStateLinks.length > 0 ? (
            <div className="booking-date-filter-bar notification-incident-state-filter-bar">
              <span className="notification-filter-group-label">Incident state</span>
              <AdminSegmentedControl
                activeValue={activeIncidentState}
                ariaLabel="System incident state"
                options={incidentStateLinks.map((link) => ({
                  href: link.href,
                  label: link.label,
                  value: link.state,
                }))}
              />
            </div>
          ) : null}
          {activeBookingLabel ? (
            <div className="notification-filter-context-row">
              <StatusBadge tone="info">Booking {activeBookingLabel}</StatusBadge>
            </div>
          ) : null}
          {additionalLinks.length > 0 ? (
            <div className="booking-date-filter-bar notification-review-filter-bar">
              <span className="notification-filter-group-label">Additional queues</span>
              <AdminSegmentedControl
                activeValue={activeReview || 'all'}
                ariaLabel="Additional notification review filters"
                className="notification-review-filter-buttons"
                options={additionalLinks.map((link) => ({
                  href: link.href,
                  label: link.label,
                  value: link.review,
                }))}
              />
            </div>
          ) : null}
        </div>
      </AdminDisclosure>
    </AdminFilterPanel>
  );
}

function notificationActiveFilterLabels({
  activeBookingLabel,
  activeFilterLabel,
  activeFinanceAge,
  activeIncidentState,
  activeRangeLabel,
  financeOwner,
  financeOwnerOptions,
}: {
  readonly activeBookingLabel: string | null;
  readonly activeFilterLabel: string | null;
  readonly activeFinanceAge: NotificationFinanceAge;
  readonly activeIncidentState: NotificationIncidentState;
  readonly activeRangeLabel: string;
  readonly financeOwner: string;
  readonly financeOwnerOptions: readonly NotificationFinanceOwnerOption[];
}) {
  const labels = [
    `Range: ${activeRangeLabel}`,
    `Queue: ${activeFilterLabel ?? 'All notifications'}`,
  ];

  if (activeIncidentState !== 'all') {
    labels.push(`Incident: ${incidentStateLabel(activeIncidentState)}`);
  }

  if (activeFinanceAge !== 'all') {
    labels.push(`SLA: ${activeFinanceAge === '72-plus' ? '72h+' : '48–72h'}`);
  }

  if (financeOwner) {
    labels.push(`Owner: ${financeOwnerOptions.find((option) => option.value === financeOwner)?.label ?? financeOwner}`);
  }

  if (activeBookingLabel) {
    labels.push(`Booking: ${activeBookingLabel}`);
  }

  return labels;
}

function incidentStateLabel(state: NotificationIncidentState) {
  if (state === 'open') return 'Open';
  if (state === 'recovered') return 'Recovered';
  if (state === 'legacy') return 'Legacy review';
  return 'All system';
}
