import { AdminDetails } from '../../components/admin-details';
import { AdminDirectoryFilterForm } from '../../components/admin-directory-filter-form';
import {
  AdminFormControlButton,
  AdminFormSearch,
  AdminFormSelect,
} from '../../components/admin-form-controls';
import { AdminFilterSummary } from '../../components/admin-filter-summary';
import { AdminQueueAgeSortControls } from '../../components/admin-queue-age-sort-controls';
import { AdminSegmentedControl } from '../../components/admin-segmented-control';
import { AdminTablePanel } from '../../components/admin-table-panel';
import { AdminTextLink } from '../../components/admin-text-link';
import type { AdminDateRange } from '../../lib/date-range';
import type {
  AdminQueueAge,
  AdminQueueAgeCounts,
  AdminQueueSlaFilter,
  AdminQueueSlaSummary,
  AdminQueueSort,
} from '../../lib/admin-queue-list';
import { adminQueueSlaFilterLabel } from '../../lib/admin-queue-list';

export type PaymentFilterLink = {
  readonly group: 'live' | 'exception' | 'history';
  readonly href: string;
  readonly label: string;
  readonly review: string;
};

export type PaymentRangeLink = {
  readonly href: string;
  readonly label: string;
  readonly range: AdminDateRange;
};

type PaymentFilterBoardSectionProps = {
  readonly age?: AdminQueueAge;
  readonly ageCounts?: AdminQueueAgeCounts;
  readonly ageHref?: (age: AdminQueueAge) => string;
  readonly queueSla?: AdminQueueSlaSummary;
  readonly sla?: AdminQueueSlaFilter;
  readonly slaHref?: (sla: AdminQueueSlaFilter) => string;
  readonly activeFilterDescription: string | null;
  readonly activeFilterLabel: string | null;
  readonly activeRange: AdminDateRange;
  readonly bookingStatus: string;
  readonly customerProfileId: string;
  readonly evidence: string;
  readonly filteredCount: number;
  readonly pageSize: number;
  readonly paymentMethod: string;
  readonly paymentStatus: string;
  readonly q: string;
  readonly rangeLabel: string;
  readonly resetHref?: string;
  readonly review: string;
  readonly reviewLinks: readonly PaymentFilterLink[];
  readonly queueCounts?: Readonly<Record<string, number | undefined>>;
  readonly historyAliasCounts?: Readonly<Partial<Record<'authorized' | 'callback-verified' | 'all', number>>>;
  readonly totalCount: number;
  readonly sort?: AdminQueueSort;
  readonly sortHref?: (sort: AdminQueueSort) => string;
};

const PAYMENT_METHOD_OPTIONS = [
  { label: 'All methods', value: '' },
  { label: 'MoMo', value: 'MOMO' },
  { label: 'VNPay', value: 'VNPAY' },
  { label: 'Card', value: 'CARD' },
  { label: 'Customer wallet', value: 'CUSTOMER_WALLET' },
  { label: 'Cash', value: 'CASH' },
  { label: 'Bank transfer', value: 'BANK_TRANSFER' },
  { label: 'Manual', value: 'MANUAL' },
] as const;

const PAYMENT_STATUS_OPTIONS = [
  { label: 'All payment states', value: '' },
  ...['PENDING', 'AUTHORIZED', 'CAPTURED', 'RELEASED', 'FAILED', 'REFUNDED'].map((value) => ({
    label: value.replaceAll('_', ' '),
    value,
  })),
];

const BOOKING_STATUS_OPTIONS = [
  { label: 'All booking states', value: '' },
  ...['CREATED', 'OPEN_MATCHING', 'MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'EXPIRED', 'REFUNDED'].map((value) => ({
    label: value.replaceAll('_', ' '),
    value,
  })),
];

export function PaymentFilterBoardSection({
  age = 'all',
  ageCounts,
  ageHref = (value) => `?age=${value}`,
  queueSla,
  sla = 'all',
  slaHref,
  activeFilterDescription,
  activeFilterLabel,
  activeRange,
  bookingStatus,
  customerProfileId,
  evidence,
  filteredCount,
  pageSize,
  paymentMethod,
  paymentStatus,
  q,
  rangeLabel,
  resetHref = '/payments?range=all&review=capture-ready&sort=oldest',
  review,
  reviewLinks,
  queueCounts = {},
  historyAliasCounts = {},
  totalCount,
  sort = 'oldest',
  sortHref = (value) => `?sort=${value}`,
}: PaymentFilterBoardSectionProps) {
  const primaryQueueValues = new Set([
    'capture-ready',
    'release-recommended',
    'evidence-conflict',
    'missing-gateway-evidence',
    'active-cash',
  ]);
  const primaryQueues = reviewLinks.filter((item) => primaryQueueValues.has(item.review));
  const secondaryQueues = reviewLinks.filter(
    (item) => item.group !== 'history' && !primaryQueueValues.has(item.review),
  );
  const historyQueues = reviewLinks.filter((item) => item.group === 'history');
  const queueDisplayCount = (queue: string) =>
    queue === review ? totalCount : historyAliasCounts[queue as keyof typeof historyAliasCounts] ?? queueCounts[queue] ?? 0;
  const secondaryWorkCount = secondaryQueues.reduce(
    (total, item) => total + queueDisplayCount(item.review),
    0,
  );
  const activeLabels = [
    `Queue: ${activeFilterLabel ?? 'All payments'}`,
    `Range: ${rangeLabel}`,
    `Order: ${sort === 'oldest' ? 'Oldest first' : 'Newest first'}`,
    ...(q ? [`Search: ${q}`] : []),
    ...(paymentMethod ? [`Method: ${paymentMethod}`] : []),
    ...(paymentStatus ? [`Payment: ${paymentStatus}`] : []),
    ...(bookingStatus ? [`Booking: ${bookingStatus}`] : []),
    ...(evidence ? [`Evidence: ${evidence}`] : []),
    ...(customerProfileId ? [`Customer: ${customerProfileId}`] : []),
  ];

  return (
    <AdminTablePanel
      className="payment-command-filter-panel"
      description="Search and narrow the server-owned payment decision queue. Filters return to page 1."
      resultLabel={`Showing ${filteredCount} of ${totalCount}`}
      resultTone={filteredCount > 0 ? 'info' : 'warning'}
      title="Payment queue"
    >
      <AdminDirectoryFilterForm action="/payments" className="payment-command-filter-form" method="get">
        <AdminFormSearch
          className="payment-command-search"
          defaultValue={q}
          label="Search payments"
          name="q"
          placeholder="Payment, booking, customer, Partner or gateway ref"
        />
        <input name="review" type="hidden" value={review} />
        <AdminFormSelect defaultValue={paymentMethod} label="Method" name="paymentMethod" options={PAYMENT_METHOD_OPTIONS} />
        <AdminFormSelect defaultValue={paymentStatus} label="Payment state" name="paymentStatus" options={PAYMENT_STATUS_OPTIONS} />
        <AdminFormSelect defaultValue={bookingStatus} label="Booking state" name="bookingStatus" options={BOOKING_STATUS_OPTIONS} />
        <AdminFormSelect
          defaultValue={evidence}
          label="Evidence"
          name="evidence"
          options={[
            { label: 'All evidence states', value: '' },
            { label: 'Verified', value: 'verified' },
            { label: 'Missing', value: 'missing' },
            { label: 'Conflict', value: 'conflict' },
            { label: 'Not applicable', value: 'not-applicable' },
          ]}
        />
        <AdminFormSelect
          defaultValue={activeRange}
          label="Booking created"
          name="range"
          options={[
            { label: 'All dates', value: 'all' },
            { label: 'Today', value: 'today' },
            { label: 'Last 7 days', value: '7d' },
            { label: 'Last 30 days', value: '30d' },
          ]}
        />
        <AdminFormSelect
          defaultValue={sort}
          label="Sort"
          name="sort"
          options={[
            { label: 'Oldest first', value: 'oldest' },
            { label: 'Newest first', value: 'newest' },
          ]}
        />
        {customerProfileId ? <input name="customerProfileId" type="hidden" value={customerProfileId} /> : null}
        {age !== 'all' ? <input name="age" type="hidden" value={age} /> : null}
        {sla !== 'all' ? <input name="sla" type="hidden" value={sla} /> : null}
        {pageSize !== 10 ? <input name="pageSize" type="hidden" value={pageSize} /> : null}
        <AdminFormControlButton className="button-primary" type="submit">Apply</AdminFormControlButton>
        <AdminTextLink href={resetHref}>Reset</AdminTextLink>
      </AdminDirectoryFilterForm>

      {activeFilterLabel && activeFilterDescription ? (
        <p className="muted admin-mt-12">
          <strong>{activeFilterLabel}</strong> - {activeFilterDescription}
        </p>
      ) : null}
      <AdminFilterSummary ariaLabel="Active payment filters" className="admin-mt-12" labels={activeLabels} tone="info" />

      <AdminSegmentedControl
        activeValue={review || 'all'}
        ariaLabel="Primary payment work queues"
        className="payment-primary-queues admin-mt-12"
        options={primaryQueues.map((item) => ({
          href: item.href,
          label: `${item.label} ${queueDisplayCount(item.review)}`,
          value: item.review,
        }))}
        semantics="navigation"
      />

      <AdminDetails
        className="payment-quick-queues admin-mt-12"
        open={[...secondaryQueues, ...historyQueues].some((item) => item.review === review)}
      >
        <summary><span>More queues</span><small>Secondary work {secondaryWorkCount} · History separate</small></summary>
        <div className="admin-disclosure-content">
          <strong className="admin-section-kicker">Secondary work</strong>
          <AdminSegmentedControl
            activeValue={review || 'all'}
            ariaLabel="Secondary payment work queues"
            options={secondaryQueues.map((item) => ({
              href: item.href,
              label: `${item.label} ${queueDisplayCount(item.review)}`,
              value: item.review,
            }))}
            semantics="navigation"
          />
          <AdminDetails className="payment-history-queues admin-mt-12" open={historyQueues.some((item) => item.review === review)}>
            <summary><span>History</span><small>Terminal records</small></summary>
            <div className="admin-disclosure-content">
              <AdminSegmentedControl
                activeValue={review || 'all'}
                ariaLabel="Payment history queues"
                options={historyQueues.map((item) => ({
                  href: item.href,
                  label: `${item.label} ${queueDisplayCount(item.review)}`,
                  value: item.review,
                }))}
                semantics="navigation"
              />
            </div>
          </AdminDetails>
        </div>
      </AdminDetails>

      <AdminDetails className="payment-more-filters admin-mt-10" open={age !== 'all' || sla !== 'all'}>
        <summary><span>Idle since booking update</span><small>{sla !== 'all' ? adminQueueSlaFilterLabel(sla) : 'Optional'}</small></summary>
        <div className="admin-disclosure-content">
          <AdminQueueAgeSortControls
            age={age}
            ageCounts={ageCounts}
            ageHref={ageHref}
            sla={queueSla}
            slaFilter={sla}
            slaHref={slaHref}
            sort={sort}
            sortHref={sortHref}
          />
        </div>
      </AdminDetails>
    </AdminTablePanel>
  );
}
