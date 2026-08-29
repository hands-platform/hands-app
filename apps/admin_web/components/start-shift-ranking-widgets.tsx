'use client';

import Link from 'next/link';
import { useState, type KeyboardEvent } from 'react';

import type {
  AdminStartShiftCustomerRanking,
  AdminStartShiftDemandSupplyAnalytics,
  AdminStartShiftPartnerRanking,
  AdminStartShiftRankingAnalytics,
} from '../lib/admin-api';
import { partnerDisplayText } from '../lib/admin-copy';
import { formatMoney } from '../lib/admin-format';
import { AdminDataTable, AdminTableScroll } from './admin-data-table';
import { AdminEmptyState } from './admin-empty-state';
import { AdminCard, AdminCardHeader } from './admin-surface';
import { StatusBadge, StatusBadgeLink, type StatusBadgeTone } from './status-badge';

type CustomerMode = 'mostActive' | 'mostCompleted' | 'highestValue' | 'needsAttention';
type PartnerMode = 'mostActive' | 'mostCompleted' | 'fastestResponse' | 'highestRated' | 'needsAttention';

const customerTabs: Array<{ key: CustomerMode; label: string }> = [
  { key: 'mostActive', label: 'Most active' },
  { key: 'mostCompleted', label: 'Most completed' },
  { key: 'highestValue', label: 'Highest value' },
  { key: 'needsAttention', label: 'Needs attention' },
];

const partnerTabs: Array<{ key: PartnerMode; label: string }> = [
  { key: 'mostActive', label: 'Most active' },
  { key: 'mostCompleted', label: 'Most completed' },
  { key: 'fastestResponse', label: 'Fastest response' },
  { key: 'highestRated', label: 'Highest rated' },
  { key: 'needsAttention', label: 'Needs attention' },
];

const customerDescriptions: Record<CustomerMode, string> = {
  highestValue: 'Captured customer spend in the selected period',
  mostActive: 'Ordered by app activity, then Partner profile views, authenticated sessions, and recent activity',
  mostCompleted: 'Completed bookings in the selected period',
  needsAttention: 'Open issues only: delayed matching, unresolved matched cancellations, active-booking payment failures, and unresolved refunds',
};

const partnerDescriptions: Record<PartnerMode, string> = {
  fastestResponse: 'Median response time for booking requests in the selected period',
  highestRated: 'Published rating with at least three reviews or completed bookings',
  mostActive: 'Ordered by app activity, then authenticated sessions and recent activity',
  mostCompleted: 'Completed jobs and net earnings in the selected period',
  needsAttention: 'Open issues only: operating blocks, 7-day inactivity, and unresolved matched cancellations',
};

const numberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

function money(value: number) {
  return formatMoney(value);
}

function netEarnings(value: number) {
  return (
    <span className={value < 0 ? 'start-shift-net-earnings is-negative' : 'start-shift-net-earnings'}>
      {money(value)}
      {value < 0 ? <small>Finance review</small> : null}
    </span>
  );
}

function dateLabel(value: string | null) {
  if (!value) {
    return 'No recent session';
  }
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(value));
}

function IssueBreakdown({
  issues,
  total,
}: {
  issues: Array<{ count: number; href: string; label: string; tone: StatusBadgeTone }>;
  total: number;
}) {
  const visibleIssues = issues.filter((issue) => issue.count > 0);
  if (!visibleIssues.length) {
    return <StatusBadge tone="success">Clear</StatusBadge>;
  }
  return (
    <div aria-label={`${total} open issue${total === 1 ? '' : 's'}`} className="start-shift-issue-breakdown">
      {visibleIssues.map((issue) => (
        <StatusBadgeLink
          ariaLabel={`Open ${issue.count} ${issue.label.toLowerCase()} issue${issue.count === 1 ? '' : 's'}`}
          href={issue.href}
          key={issue.label}
          title={`Open ${issue.label.toLowerCase()} queue`}
          tone={issue.tone}
        >
          {issue.label} {issue.count}
        </StatusBadgeLink>
      ))}
    </div>
  );
}

export function rankingTabTargetIndex(index: number, count: number, key: string) {
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  if (key === 'ArrowRight') return (index + 1) % count;
  if (key === 'ArrowLeft') return (index - 1 + count) % count;
  return index;
}

function RankingTabs<TMode extends string>({
  active,
  ariaLabel,
  idPrefix,
  onChange,
  tabs,
}: {
  active: TMode;
  ariaLabel: string;
  idPrefix: string;
  onChange: (mode: TMode) => void;
  tabs: Array<{ count: number; key: TMode; label: string }>;
}) {
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      return;
    }
    const targetIndex = rankingTabTargetIndex(index, tabs.length, event.key);
    event.preventDefault();
    onChange(tabs[targetIndex].key);
    event.currentTarget.parentElement
      ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[targetIndex]
      ?.focus();
  };

  return (
    <div className="start-shift-ranking-tabs" aria-label={ariaLabel} role="tablist">
      {tabs.map((tab, index) => (
        <button
          aria-controls={`${idPrefix}-panel`}
          aria-selected={active === tab.key}
          className={active === tab.key ? 'is-active' : undefined}
          id={`${idPrefix}-tab-${tab.key}`}
          key={tab.key}
          onClick={() => onChange(tab.key)}
          onKeyDown={(event) => onKeyDown(event, index)}
          role="tab"
          tabIndex={active === tab.key ? 0 : -1}
          type="button"
        >
          {tab.label} <span>{tab.count}</span>
        </button>
      ))}
    </div>
  );
}

function CustomerRankingTable({ mode, rows }: { mode: CustomerMode; rows: AdminStartShiftCustomerRanking[] }) {
  if (!rows.length) {
    return <AdminEmptyState message="No customer records qualify for this view." title="No customer activity" />;
  }
  const headers = mode === 'needsAttention'
    ? ['Customer', 'Issue', 'Last activity', 'Open']
    : mode === 'mostActive'
      ? ['Customer', 'App activity', 'Profile views', 'Last activity', 'Open']
      : mode === 'mostCompleted'
        ? ['Customer', 'Completed', 'Spend', 'Last activity', 'Open']
        : ['Customer', 'Spend', 'Completed', 'Last activity', 'Open'];
  return (
    <AdminTableScroll className="start-shift-ranking-table-wrap">
      <AdminDataTable
        className="start-shift-ranking-table is-compact"
        emptyMessage={null}
        headers={headers}
        rowCount={rows.length}
      >
        {rows.map((row) => {
          const cells = mode === 'needsAttention'
            ? [<IssueBreakdown key="issues" issues={[
                { count: row.issueBreakdown.matching, href: `/bookings?view=matching&q=${encodeURIComponent(row.customerProfileId)}`, label: 'Matching', tone: 'warning' },
                { count: row.issueBreakdown.cancellation, href: `/bookings/post-match-cancellations?view=manual-decision&dateRange=all&q=${encodeURIComponent(row.customerProfileId)}`, label: 'Cancellation', tone: 'warning' },
                { count: row.issueBreakdown.payment, href: `/payments?range=all&review=failed-active&customerProfileId=${encodeURIComponent(row.customerProfileId)}`, label: 'Payment', tone: 'danger' },
                { count: row.issueBreakdown.refund, href: `/refunds?range=all&review=open&customerProfileId=${encodeURIComponent(row.customerProfileId)}`, label: 'Refund', tone: 'info' },
              ]} total={row.issueCount} />, dateLabel(row.lastActiveAt)]
            : mode === 'mostActive'
              ? [numberFormatter.format(row.appOpenEvents), numberFormatter.format(row.providerProfileViews), dateLabel(row.lastActiveAt)]
              : mode === 'mostCompleted'
                ? [numberFormatter.format(row.completedBookings), money(row.spendAmount), dateLabel(row.lastActiveAt)]
                : [money(row.spendAmount), numberFormatter.format(row.completedBookings), dateLabel(row.lastActiveAt)];
          return (
            <tr key={row.customerProfileId}>
              <th><span className="start-shift-rank-number">{row.rank}</span>{row.displayName}</th>
              {cells.map((cell, index) => <td key={`${row.customerProfileId}-${headers[index + 1]}`}>{cell}</td>)}
              <td><Link className="text-link" href={row.href} prefetch={false}>Open</Link></td>
            </tr>
          );
        })}
      </AdminDataTable>
    </AdminTableScroll>
  );
}

function PartnerRankingTable({ mode, rows }: { mode: PartnerMode; rows: AdminStartShiftPartnerRanking[] }) {
  if (!rows.length) {
    return <AdminEmptyState message="No Partner records qualify for this view." title="No Partner records" />;
  }
  const openLink = (row: AdminStartShiftPartnerRanking) => (
    <Link className="text-link" href={row.href} prefetch={false}>Open</Link>
  );
  const partnerName = (row: AdminStartShiftPartnerRanking) => (
    <><span className="start-shift-rank-number">{row.rank}</span>{partnerDisplayText(row.displayName)}</>
  );

  if (mode === 'needsAttention') {
    return (
      <AdminTableScroll className="start-shift-ranking-table-wrap">
        <AdminDataTable className="start-shift-ranking-table is-compact" emptyMessage={null} headers={['Partner', 'Issue', 'Last activity', 'Open']} rowCount={rows.length}>
          {rows.map((row) => (
            <tr key={row.providerProfileId}>
              <th>{partnerName(row)}</th>
              <td><IssueBreakdown issues={[
                { count: row.issueBreakdown.blocked, href: row.href, label: 'Blocked', tone: 'danger' },
                { count: row.issueBreakdown.inactive, href: row.href, label: 'Inactive', tone: 'warning' },
                { count: row.issueBreakdown.cancellation, href: `/bookings/post-match-cancellations?view=manual-decision&dateRange=all&q=${encodeURIComponent(row.providerProfileId)}`, label: 'Cancellation', tone: 'info' },
              ]} total={row.issueCount} /></td>
              <td>{dateLabel(row.lastActiveAt)}</td>
              <td>{openLink(row)}</td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
    );
  }

  const headers = mode === 'mostActive'
    ? ['Partner', 'App activity', 'Sessions', 'Last activity', 'Open']
    : mode === 'mostCompleted'
      ? ['Partner', 'Completed', 'Net earnings', 'Last activity', 'Open']
      : mode === 'fastestResponse'
        ? ['Partner', 'Response', 'Acceptance', 'Completed', 'Open']
        : ['Partner', 'Rating', 'Completed', 'Last activity', 'Open'];
  return (
    <AdminTableScroll className="start-shift-ranking-table-wrap">
      <AdminDataTable
        className="start-shift-ranking-table is-compact"
        emptyMessage={null}
        headers={headers}
        rowCount={rows.length}
      >
        {rows.map((row) => {
          const cells = mode === 'mostActive'
            ? [numberFormatter.format(row.appOpenEvents), numberFormatter.format(row.sessionStartEvents), dateLabel(row.lastActiveAt)]
            : mode === 'mostCompleted'
              ? [numberFormatter.format(row.completedBookings), netEarnings(row.earningsAmount), dateLabel(row.lastActiveAt)]
              : mode === 'fastestResponse'
                ? [row.medianResponseMinutes == null ? 'No response data' : `${row.medianResponseMinutes}m`, `${row.acceptanceRate}%`, numberFormatter.format(row.completedBookings)]
                : [row.rating.toFixed(1), numberFormatter.format(row.completedBookings), dateLabel(row.lastActiveAt)];
          return <tr key={row.providerProfileId}><th>{partnerName(row)}</th>{cells.map((cell, index) => <td key={`${row.providerProfileId}-${headers[index + 1]}`}>{cell}</td>)}<td>{openLink(row)}</td></tr>;
        })}
      </AdminDataTable>
    </AdminTableScroll>
  );
}

export function StartShiftRankingWidgets({
  analytics,
  rangeLabel,
}: {
  analytics: AdminStartShiftRankingAnalytics;
  rangeLabel: string;
}) {
  const visibleCustomerTabs = customerTabs.filter(
    (tab) => analytics.customerRankings[tab.key].length > 0,
  );
  const visiblePartnerTabs = partnerTabs.filter(
    (tab) => analytics.partnerRankings[tab.key].length > 0,
  );
  const [customerMode, setCustomerMode] = useState<CustomerMode>(
    analytics.customerRankings.needsAttention.length
      ? 'needsAttention'
      : visibleCustomerTabs[0]?.key ?? 'mostActive',
  );
  const [partnerMode, setPartnerMode] = useState<PartnerMode>(
    analytics.partnerRankings.needsAttention.length
      ? 'needsAttention'
      : visiblePartnerTabs[0]?.key ?? 'mostActive',
  );
  const hasCustomerRankings = Object.values(analytics.customerRankings).some((rows) => rows.length > 0);
  const hasPartnerRankings = Object.values(analytics.partnerRankings).some((rows) => rows.length > 0);
  const customerNeedsAttentionOnly = visibleCustomerTabs.length === 1 && visibleCustomerTabs[0]?.key === 'needsAttention';
  const partnerNeedsAttentionOnly = visiblePartnerTabs.length === 1 && visiblePartnerTabs[0]?.key === 'needsAttention';

  if (!hasCustomerRankings && !hasPartnerRankings) {
    return (
      <div className="start-shift-ranking-empty">
        <AdminEmptyState
          framed
          message={`No customer or Partner records qualify for ${rangeLabel}. Use a wider period when you need historical leaders.`}
          title={`No activity leaders for ${rangeLabel}`}
        />
        <Link className="text-link" href="/?range=7d#dashboard-performance-leaders" prefetch={false}>
          Open last 7 days
        </Link>
      </div>
    );
  }

  return (
    <div className="start-shift-ranking-grid">
      {hasCustomerRankings ? (
        <AdminCard ariaLabelledBy="start-shift-customer-ranking-title" className="start-shift-ranking-card">
          <AdminCardHeader
            description={customerDescriptions[customerMode]}
            title={<span id="start-shift-customer-ranking-title">{customerNeedsAttentionOnly ? 'Customer needs attention' : 'Top customers'}</span>}
          />
          {visibleCustomerTabs.length > 1 ? (
            <RankingTabs
              active={customerMode}
              ariaLabel="Customer ranking mode"
              idPrefix="start-shift-customer-ranking"
              onChange={setCustomerMode}
              tabs={visibleCustomerTabs.map((tab) => ({ ...tab, count: analytics.customerRankings[tab.key].length }))}
            />
          ) : null}
          <div
            {...(visibleCustomerTabs.length > 1
              ? { 'aria-labelledby': `start-shift-customer-ranking-tab-${customerMode}`, role: 'tabpanel' }
              : {})}
            id="start-shift-customer-ranking-panel"
          >
            <CustomerRankingTable mode={customerMode} rows={analytics.customerRankings[customerMode]} />
          </div>
        </AdminCard>
      ) : null}
      {hasPartnerRankings ? (
        <AdminCard ariaLabelledBy="start-shift-partner-ranking-title" className="start-shift-ranking-card">
          <AdminCardHeader
            description={partnerDescriptions[partnerMode]}
            title={<span id="start-shift-partner-ranking-title">{partnerNeedsAttentionOnly ? 'Partner needs attention' : 'Partner performance'}</span>}
          />
          {visiblePartnerTabs.length > 1 ? (
            <RankingTabs
              active={partnerMode}
              ariaLabel="Partner ranking mode"
              idPrefix="start-shift-partner-ranking"
              onChange={setPartnerMode}
              tabs={visiblePartnerTabs.map((tab) => ({ ...tab, count: analytics.partnerRankings[tab.key].length }))}
            />
          ) : null}
          <div
            {...(visiblePartnerTabs.length > 1
              ? { 'aria-labelledby': `start-shift-partner-ranking-tab-${partnerMode}`, role: 'tabpanel' }
              : {})}
            id="start-shift-partner-ranking-panel"
          >
            <PartnerRankingTable mode={partnerMode} rows={analytics.partnerRankings[partnerMode]} />
          </div>
        </AdminCard>
      ) : null}
    </div>
  );
}

export function StartShiftDemandSupplyWidgets({
  analytics,
  readyPartners,
}: {
  analytics: AdminStartShiftDemandSupplyAnalytics;
  readyPartners: number;
}) {
  const hourlyGaps = analytics.buckets
    .filter((bucket) => !bucket.isFuture)
    .map((bucket) => ({
      gap: Math.max(0, (bucket.bookingRequests ?? 0) - (bucket.matched ?? 0)),
      label: bucket.label,
    }))
    .filter((row) => row.gap > 0)
    .sort((left, right) => right.gap - left.gap)
    .slice(0, 4);

  return (
    <div className="start-shift-demand-grid">
      <AdminCard ariaLabelledBy="start-shift-service-demand-title" className="start-shift-demand-card is-services">
        <AdminCardHeader
          actions={<StatusBadge tone={readyPartners > 0 ? 'success' : 'warning'}>{readyPartners} ready now</StatusBadge>}
          description="Bookings created in the selected period; current ready supply is shown as operating context"
          title={<span id="start-shift-service-demand-title">Service demand and supply</span>}
        />
        {analytics.demandSupply.services.length ? (
          <div className="start-shift-demand-list" role="list">
            {analytics.demandSupply.services.map((row) => (
              <div key={row.id} role="listitem">
                <div><strong>{row.label}</strong><span>{row.matchingFailureCount} unmatched booking(s)</span></div>
                <dl>
                  <div><dt>Demand</dt><dd>{row.demandCount}</dd></div>
                  <div><dt>Ready now</dt><dd>{row.readyPartnerCount}</dd></div>
                  <div><dt>Unmatched</dt><dd className={row.matchingFailureCount > 0 ? 'is-risk' : undefined}>{row.matchingFailureCount}</dd></div>
                </dl>
              </div>
            ))}
          </div>
        ) : <AdminEmptyState message="No service demand was recorded in this period." title="No service demand" />}
        <Link className="text-link start-shift-card-link" href="/services" prefetch={false}>Open services</Link>
      </AdminCard>

      <AdminCard ariaLabelledBy="start-shift-supply-gap-title" className="start-shift-demand-card is-gaps">
        <AdminCardHeader
          description="Unmatched requests by hour and area in the selected period"
          title={<span id="start-shift-supply-gap-title">Matching pressure</span>}
        />
        <div className="start-shift-gap-columns">
          <div>
            <h4>Hourly request gap</h4>
            {hourlyGaps.length ? (
              <ol>{hourlyGaps.map((row) => <li key={row.label}><span>{row.label}</span><strong>{row.gap}</strong></li>)}</ol>
            ) : <p className="muted">No unmatched hourly gap.</p>}
          </div>
          <div>
            <h4>Failed-match areas</h4>
            {analytics.demandSupply.failureRegions.length ? (
              <ol>{analytics.demandSupply.failureRegions.map((row) => <li key={row.id}><span>{row.label}</span><strong>{row.matchingFailureCount}</strong></li>)}</ol>
            ) : <p className="muted">No failed-match area.</p>}
          </div>
        </div>
        <Link className="text-link start-shift-card-link" href="/vietnam-overview" prefetch={false}>Open Vietnam Overview</Link>
      </AdminCard>
    </div>
  );
}
