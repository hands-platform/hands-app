import Link from 'next/link';
import { AdminCashSettlementSummary, AdminEarning, adminGet } from '../../lib/admin-api';
import { dateRangeLabel, isInDateRange, normalizeDateRange, readSearchParam } from '../../lib/date-range';
import { settleCashFeeDebt } from './actions';

type CashSettlementsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CashSettlementsPage({ searchParams }: CashSettlementsPageProps) {
  const filters = buildCashSettlementFilters(searchParams ? await searchParams : {});
  const [earnings, apiSummary] = await Promise.all([
    adminGet<AdminEarning[]>('/admin/cash-settlement-earnings', []),
    adminGet<AdminCashSettlementSummary | null>('/admin/cash-settlement-summary', null),
  ]);
  const filteredEarnings = earnings.filter((earning) => isInDateRange(earning.createdAt, filters.range));
  const rows = buildCashSettlementRows(filteredEarnings);
  const providers = buildProviderGroups(rows);
  const visibleSummary = buildSummary(rows, providers);
  const summary =
    filters.range === 'all' ? mergeAuthoritativeSummary(visibleSummary, apiSummary) : visibleSummary;
  const commandCards = buildCommandCards(rows, providers, summary);

  return (
    <>
      <h1>Cash Settlements</h1>
      <p className="muted">
        Finance queue for cash bookings where the partner collected customer cash and still owes HANDS
        platform fee or withholding. A negative wallet is a settlement-required state and gates configured
        final acceptance or customer selection until this debt is settled with a bank reference or approved
        offset.
      </p>

      <section className="card" style={{ marginTop: 16, marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Cash settlement date range</h2>
            <p className="muted">
              Range: {dateRangeLabel(filters.range)}. All date-filtered totals are calculated from visible cash
              earning records; all-date totals use the API summary.
            </p>
          </div>
          <Link className="text-link" href="/finance-closeout">
            Open finance closeout
          </Link>
        </div>
        <div className="filter-row" style={{ marginTop: 12 }}>
          {[
            ['All dates', '/cash-settlements'],
            ['Today', '/cash-settlements?range=today'],
            ['Last 7 days', '/cash-settlements?range=7d'],
            ['Last 30 days', '/cash-settlements?range=30d'],
          ].map(([label, href]) => (
            <Link className="filter-pill" href={href} key={href}>
              {label}
            </Link>
          ))}
        </div>
      </section>

      <section className="grid" style={{ marginTop: 16, marginBottom: 16 }}>
        <div className="card">
          <p>Blocked partners</p>
          <h2>{summary.providerCount}</h2>
        </div>
        <div className="card">
          <p>Open debt rows</p>
          <h2>{summary.rowCount}</h2>
        </div>
        <div className="card">
          <p>Total wallet debt</p>
          <h2>{formatMoney(summary.debtAmount, summary.currency)}</h2>
        </div>
        <div className="card">
          <p>HANDS fee</p>
          <h2>{formatMoney(summary.platformFee, summary.currency)}</h2>
        </div>
        <div className="card">
          <p>Tax withholding</p>
          <h2>{formatMoney(summary.taxAmount, summary.currency)}</h2>
        </div>
        <div className="card">
          <p>Oldest open</p>
          <h2>{summary.oldestOpenLabel}</h2>
        </div>
        <div className="card">
          <p>Over 24h</p>
          <h2>{summary.staleDebtRowCount}</h2>
        </div>
        <div className="card">
          <p>Payment evidence</p>
          <h2>
            {summary.missingPaymentEvidenceCount ? `${summary.missingPaymentEvidenceCount} check` : 'OK'}
          </h2>
        </div>
      </section>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Settlement command queue</h2>
            <p className="muted">
              Work from the highest debt and oldest debt first. Every settlement needs an auditable reference
              before the partner wallet can reopen.
            </p>
          </div>
          <Link className="text-link" href="/earnings">
            Open earnings
          </Link>
        </div>
        <div className="ops-task-grid">
          {commandCards.map((card) => (
            <div className={`ops-task-card ${card.className}`} key={card.title}>
              <div>
                <span className={`pill ${card.pillClass}`}>{card.status}</span>
                <h3>{card.title}</h3>
                <p className="muted">{card.detail}</p>
              </div>
              <small>{card.action}</small>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Partner wallet debt groups</h2>
            <p className="muted">
              Partner-level view for deciding whether to collect a direct deposit or approve an offset against
              later positive earnings.
            </p>
          </div>
          <Link className="text-link" href="/partner-controls">
            Partner controls
          </Link>
        </div>
        {providers.length ? (
          <div className="detail-grid" style={{ marginTop: 16 }}>
            {providers.map((provider) => (
              <div key={provider.providerProfileId}>
                <div className="risk-watch-header">
                  <h3>{provider.providerName}</h3>
                  <span className="pill pill-danger">
                    {formatMoney(provider.debtAmount, provider.currency)}
                  </span>
                </div>
                <p className="muted">
                  {provider.rowCount} open cash debt row(s),{' '}
                  {formatMoney(provider.platformFee, provider.currency)} HANDS fee,{' '}
                  {formatMoney(provider.taxAmount, provider.currency)} tax.
                </p>
                <div className="participant-list" style={{ marginTop: 8 }}>
                  <Link className="pill" href={`/partners/${provider.providerProfileId}`}>
                    Partner
                  </Link>
                  <span className="pill pill-warn">Suggested ref {provider.settlementReference}</span>
                  <span className="pill pill-info">{provider.oldestOpenLabel}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">No partner has open cash settlement debt.</p>
        )}
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <div className="risk-watch-header">
          <div>
            <h2>Open cash fee debt rows</h2>
            <p className="muted">
              Settle only after confirming a partner deposit or a documented admin offset. The backend rejects
              missing references.
            </p>
          </div>
          <Link className="text-link" href="/payments?review=cash-debt">
            Payment debt view
          </Link>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Partner</th>
              <th>Booking</th>
              <th>Debt</th>
              <th>Fee / Tax</th>
              <th>Evidence</th>
              <th>Settlement</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.earning.id}>
                <td>
                  <strong>{row.providerName}</strong>
                  <div className="muted">{row.providerPhone}</div>
                  <div className="participant-list" style={{ marginTop: 8 }}>
                    <Link className="pill" href={`/partners/${row.earning.providerProfileId}`}>
                      Partner
                    </Link>
                    <span className="pill pill-danger">Wallet blocked</span>
                  </div>
                </td>
                <td>
                  <Link className="text-link" href={`/bookings/${row.earning.bookingId}`}>
                    {shortId(row.earning.bookingId)}
                  </Link>
                  <div className="muted">{row.createdAtLabel}</div>
                  <div className="muted">{row.serviceLabel}</div>
                </td>
                <td>
                  <strong>{formatMoney(row.debtAmount, row.earning.currency)}</strong>
                  <div className="muted">
                    Cash collected: {formatMoney(row.bookingAmount, row.earning.currency)}
                  </div>
                </td>
                <td>
                  <div>HANDS fee {formatMoney(row.platformFee, row.earning.currency)}</div>
                  <div className="muted">Tax {formatMoney(row.taxAmount, row.earning.currency)}</div>
                </td>
                <td>
                  <div className="service-matrix-cell">
                    <small>Suggested ref: {row.settlementReference}</small>
                    <small>Payment method: {row.paymentMethod}</small>
                    {row.lastLedgerRef ? <small>Last ledger ref: {row.lastLedgerRef}</small> : null}
                    <small>{row.nextAction}</small>
                  </div>
                </td>
                <td>
                  <form action={settleCashFeeDebt} className="inline-form">
                    <input type="hidden" name="earningId" value={row.earning.id} />
                    <input
                      aria-label="Settlement reference"
                      name="settlementRef"
                      placeholder="Deposit ref or offset memo"
                      defaultValue={row.settlementReference}
                    />
                    <input
                      aria-label="Settlement notes"
                      name="settlementNotes"
                      placeholder="Settlement notes"
                      defaultValue={`Partner deposit or approved offset for ${formatMoney(
                        row.debtAmount,
                        row.earning.currency,
                      )} using ${row.settlementReference}`}
                    />
                    <button type="submit">Settle debt</button>
                  </form>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6}>No cash fee debt is waiting for settlement.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

type CashSettlementRow = {
  earning: AdminEarning;
  providerName: string;
  providerPhone: string;
  paymentMethod: string;
  debtAmount: number;
  platformFee: number;
  taxAmount: number;
  bookingAmount: number;
  settlementReference: string;
  lastLedgerRef?: string | null;
  serviceLabel: string;
  createdAtLabel: string;
  nextAction: string;
};

type CashSettlementProviderGroup = {
  providerProfileId: string;
  providerName: string;
  currency: string;
  rowCount: number;
  debtAmount: number;
  platformFee: number;
  taxAmount: number;
  settlementReference: string;
  oldestOpenMs: number;
  oldestOpenLabel: string;
};

type CommandCard = {
  title: string;
  status: string;
  detail: string;
  action: string;
  className: string;
  pillClass: string;
};

type CashSettlementSummary = {
  providerCount: number;
  rowCount: number;
  debtAmount: number;
  platformFee: number;
  taxAmount: number;
  currency: string;
  oldestOpenLabel: string;
  staleDebtRowCount: number;
  highDebtProviderCount: number;
  missingPaymentEvidenceCount: number;
  cashPaymentRowCount: number;
};

function buildCashSettlementRows(earnings: AdminEarning[]): CashSettlementRow[] {
  return earnings
    .filter((earning) => isOpenCashDebt(earning))
    .map((earning) => {
      const debtAmount = Math.abs(earning.netAmount);
      const settlementReference = cashSettlementReference(earning);
      return {
        earning,
        providerName: providerDisplayName(earning),
        providerPhone: earning.providerProfile?.user?.phone ?? 'No phone on file',
        paymentMethod: earning.booking?.payment?.method ?? 'CASH',
        debtAmount,
        platformFee: earning.platformFee,
        taxAmount: earning.withholdingAmount ?? 0,
        bookingAmount: earning.booking?.payment?.amount ?? earning.grossAmount,
        settlementReference,
        lastLedgerRef: earning.walletLedgerEntries?.[0]?.reference ?? null,
        serviceLabel: bookingServiceLabel(earning),
        createdAtLabel: earning.createdAt ? relativeTime(earning.createdAt) : 'No created date',
        nextAction: `Confirm partner deposit or approved offset before settling ${settlementReference}.`,
      };
    })
    .sort((left, right) => {
      if (left.debtAmount !== right.debtAmount) {
        return right.debtAmount - left.debtAmount;
      }
      return Date.parse(left.earning.createdAt ?? '') - Date.parse(right.earning.createdAt ?? '');
    });
}

function buildProviderGroups(rows: CashSettlementRow[]): CashSettlementProviderGroup[] {
  const grouped = new Map<string, CashSettlementProviderGroup>();

  rows.forEach((row) => {
    const providerProfileId = row.earning.providerProfileId;
    const existing = grouped.get(providerProfileId);
    const createdMs = Date.parse(row.earning.createdAt ?? '') || Date.now();
    const item = existing ?? {
      providerProfileId,
      providerName: row.providerName,
      currency: row.earning.currency,
      rowCount: 0,
      debtAmount: 0,
      platformFee: 0,
      taxAmount: 0,
      settlementReference: providerSettlementReference(providerProfileId),
      oldestOpenMs: createdMs,
      oldestOpenLabel: relativeTime(row.earning.createdAt),
    };

    item.rowCount += 1;
    item.debtAmount += row.debtAmount;
    item.platformFee += row.platformFee;
    item.taxAmount += row.taxAmount;
    if (createdMs < item.oldestOpenMs) {
      item.oldestOpenMs = createdMs;
      item.oldestOpenLabel = relativeTime(row.earning.createdAt);
    }

    grouped.set(providerProfileId, item);
  });

  return [...grouped.values()].sort((left, right) => right.debtAmount - left.debtAmount);
}

function buildSummary(rows: CashSettlementRow[], providers: CashSettlementProviderGroup[]) {
  const oldestMs = rows.reduce((oldest, row) => {
    const createdMs = Date.parse(row.earning.createdAt ?? '') || Date.now();
    return Math.min(oldest, createdMs);
  }, Date.now());

  return {
    providerCount: providers.length,
    rowCount: rows.length,
    debtAmount: rows.reduce((sum, row) => sum + row.debtAmount, 0),
    platformFee: rows.reduce((sum, row) => sum + row.platformFee, 0),
    taxAmount: rows.reduce((sum, row) => sum + row.taxAmount, 0),
    currency: rows[0]?.earning.currency ?? 'VND',
    oldestOpenLabel: rows.length ? relativeTime(new Date(oldestMs).toISOString()) : '-',
    staleDebtRowCount: rows.filter((row) => {
      const createdMs = Date.parse(row.earning.createdAt ?? '');
      return Number.isFinite(createdMs) && Date.now() - createdMs > 24 * 60 * 60 * 1000;
    }).length,
    highDebtProviderCount: providers.filter((provider) => provider.debtAmount >= 500_000).length,
    missingPaymentEvidenceCount: rows.filter((row) => !row.earning.booking?.payment).length,
    cashPaymentRowCount: rows.filter((row) => row.earning.booking?.payment?.method === 'CASH').length,
  };
}

function mergeAuthoritativeSummary(
  visibleSummary: CashSettlementSummary,
  apiSummary: AdminCashSettlementSummary | null,
): CashSettlementSummary {
  if (!apiSummary) {
    return visibleSummary;
  }

  return {
    providerCount: apiSummary.providerCount,
    rowCount: apiSummary.rowCount,
    debtAmount: apiSummary.totalDebtAmount,
    platformFee: apiSummary.totalPlatformFee,
    taxAmount: apiSummary.totalTaxAmount,
    currency: apiSummary.currency,
    oldestOpenLabel: apiSummary.oldestOpenAt ? relativeTime(apiSummary.oldestOpenAt) : '-',
    staleDebtRowCount: apiSummary.staleDebtRowCount,
    highDebtProviderCount: apiSummary.highDebtProviderCount,
    missingPaymentEvidenceCount: apiSummary.missingPaymentEvidenceCount,
    cashPaymentRowCount: apiSummary.cashPaymentRowCount,
  };
}

function buildCommandCards(
  rows: CashSettlementRow[],
  providers: CashSettlementProviderGroup[],
  summary: CashSettlementSummary,
): CommandCard[] {
  const highDebtProviders = providers.filter((provider) => provider.debtAmount >= 500_000);

  return [
    {
      title: 'Blocked wallets',
      status: `${summary.providerCount} PARTNER(S)`,
      detail: `${summary.rowCount} open cash settlement row(s), ${formatMoney(
        summary.debtAmount,
        summary.currency,
      )} total. ${summary.cashPaymentRowCount} row(s) are linked to cash payment evidence.`,
      action: summary.providerCount
        ? 'Collect partner deposit or approve admin offset before reopening booking acceptance.'
        : 'No wallet is currently blocked by cash fee debt.',
      className: summary.providerCount ? 'ops-task-blocked' : 'ops-task-done',
      pillClass: summary.providerCount ? 'pill-danger' : 'pill-success',
    },
    {
      title: 'High debt priority',
      status: `${summary.highDebtProviderCount} HIGH`,
      detail: highDebtProviders.length
        ? highDebtProviders
            .slice(0, 2)
            .map(
              (provider) =>
                `${provider.providerName}: ${formatMoney(provider.debtAmount, provider.currency)}`,
            )
            .join(' / ')
        : 'No partner is above the high-debt review threshold.',
      action: highDebtProviders.length
        ? 'Prioritize these partners before allowing more cash work.'
        : 'Normal settlement queue priority.',
      className: highDebtProviders.length ? 'ops-task-pending' : 'ops-task-done',
      pillClass: highDebtProviders.length ? 'pill-warn' : 'pill-success',
    },
    {
      title: 'Aging debt',
      status: `${summary.staleDebtRowCount} OLD`,
      detail: summary.staleDebtRowCount
        ? 'One or more cash debts have been open longer than 24 hours.'
        : 'No cash fee debt is older than 24 hours.',
      action: summary.staleDebtRowCount
        ? 'Contact partner and record deposit or offset evidence.'
        : 'No aging escalation needed.',
      className: summary.staleDebtRowCount ? 'ops-task-pending' : 'ops-task-done',
      pillClass: summary.staleDebtRowCount ? 'pill-warn' : 'pill-success',
    },
    {
      title: 'Payment evidence',
      status: `${summary.missingPaymentEvidenceCount} CHECK`,
      detail: summary.missingPaymentEvidenceCount
        ? 'Some rows lack linked payment evidence in the admin payload.'
        : 'Every visible row has booking payment evidence attached.',
      action: summary.missingPaymentEvidenceCount
        ? 'Open booking detail before settling these rows.'
        : 'Rows are ready for finance confirmation.',
      className: summary.missingPaymentEvidenceCount ? 'ops-task-blocked' : 'ops-task-done',
      pillClass: summary.missingPaymentEvidenceCount ? 'pill-danger' : 'pill-success',
    },
  ];
}

function isOpenCashDebt(earning: AdminEarning) {
  if (earning.status === 'PAID' || earning.status === 'CANCELLED') {
    return false;
  }
  return earning.netAmount < 0 && (earning.booking?.payment?.method === 'CASH' || earning.platformFee > 0);
}

function providerDisplayName(earning: AdminEarning) {
  return partnerDisplayText(
    earning.providerProfile?.displayName ?? earning.providerProfile?.user?.fullName ?? 'Unknown partner',
  );
}

function bookingServiceLabel(earning: AdminEarning) {
  const service = earning.booking?.services?.[0]?.service;
  if (!service) {
    return 'Unlinked service option';
  }
  return `${service.name} / ${service.durationMin} min`;
}

function cashSettlementReference(earning: AdminEarning) {
  return `HANDS-CASH-${shortId(earning.bookingId).toUpperCase()}`;
}

function providerSettlementReference(providerProfileId: string) {
  return `HANDS-WALLET-${providerProfileId.slice(-8).toUpperCase()}`;
}

function partnerDisplayText(value: string) {
  return value.replace(/\bProvider\b/g, 'Partner').replace(/\bprovider\b/g, 'partner');
}

function buildCashSettlementFilters(params: Record<string, string | string[] | undefined>) {
  return {
    range: normalizeDateRange(readSearchParam(params.range)),
  };
}

function formatMoney(amount: number, currency: string) {
  return `${new Intl.NumberFormat('vi-VN').format(amount)} ${currency}`;
}

function shortId(value: string) {
  return value.length > 12 ? value.slice(0, 12) : value;
}

function relativeTime(value?: string | null) {
  if (!value) {
    return '-';
  }
  const diffMs = Date.now() - Date.parse(value);
  if (!Number.isFinite(diffMs)) {
    return value;
  }
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 48) {
    return `${hours}h ago`;
  }
  return `${Math.round(hours / 24)}d ago`;
}
