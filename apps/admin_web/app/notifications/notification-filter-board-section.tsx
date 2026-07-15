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
  readonly activeBookingLabel: string | null;
  readonly activeFinanceAge?: NotificationFinanceAge;
  readonly activeFilterDescription: string | null;
  readonly activeFilterLabel: string | null;
  readonly activeIncidentState: NotificationIncidentState;
  readonly activeReview: string;
  readonly activeReviewRunbook: NotificationReviewRunbookView | null;
  readonly activeRange: NotificationDateRange;
  readonly activeRangeLabel: string;
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
};

export function NotificationFilterBoardSection({
  activeBookingLabel,
  activeFinanceAge = 'all',
  activeFilterDescription,
  activeFilterLabel,
  activeIncidentState,
  activeReview,
  activeReviewRunbook,
  activeRange,
  activeRangeLabel,
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
}: NotificationFilterBoardSectionProps) {
  const isFiltered = Boolean(
    (activeReview && activeReview !== 'all') ||
    activeIncidentState !== 'all' ||
    activeBookingLabel ||
    activeFinanceAge !== 'all' ||
    financeOwner,
  );

  return (
    <AdminFilterPanel
      className="notification-filter-card admin-mb-16"
      description={
        <>
          Default view is today. Use the range buttons for past delivery evidence without loading every
          notification row.
          <br />
          Active range: <strong>{activeRangeLabel}</strong>.
          {activeFilterLabel && activeFilterDescription ? (
            <>
              <br />
              Active queue: <strong>{activeFilterLabel}</strong> - {activeFilterDescription}
            </>
          ) : null}
          {activeBookingLabel ? (
            <>
              <br />
              Active booking context: <strong>{activeBookingLabel}</strong>. Showing only notifications tied
              to this booking id.
            </>
          ) : null}
        </>
      }
      id="notification-operation-filters"
      resultLabel={`Showing ${filteredCount} loaded row(s) of ${totalCount} total / ${activeRangeLabel}`}
      resultTone={isFiltered ? 'warning' : 'success'}
      title="Notification operation filters"
      footer={
        <>
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
              filteredCount,
              totalCount,
            })}
            tone="info"
          />
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
          <div className="booking-date-filter-bar notification-review-filter-bar">
            <span className="notification-filter-group-label">Queue</span>
            <AdminSegmentedControl
              activeValue={activeReview || 'all'}
              ariaLabel="Notification review filters"
              className="notification-review-filter-buttons"
              options={[
                ...(isFiltered ? [{ href: clearHref, label: 'Clear filter', value: 'clear' }] : []),
                ...links.map((link) => ({
                  href: link.href,
                  label: link.label,
                  value: link.review,
                })),
              ]}
            />
          </div>
        </>
      }
    />
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
  filteredCount,
  totalCount,
}: {
  readonly activeBookingLabel: string | null;
  readonly activeFilterLabel: string | null;
  readonly activeFinanceAge: NotificationFinanceAge;
  readonly activeIncidentState: NotificationIncidentState;
  readonly activeRangeLabel: string;
  readonly financeOwner: string;
  readonly financeOwnerOptions: readonly NotificationFinanceOwnerOption[];
  readonly filteredCount: number;
  readonly totalCount: number;
}) {
  const labels = [
    `Range: ${activeRangeLabel}`,
    `Queue: ${activeFilterLabel ?? 'All notifications'}`,
    `Rows: ${filteredCount}/${totalCount}`,
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
