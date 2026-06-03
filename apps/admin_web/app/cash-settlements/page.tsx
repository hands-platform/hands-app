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
  const evidenceChecklist = buildCashSettlementEvidenceChecklist(rows, providers, summary);

  return (
    <>
      <h1>Cash Settlements</h1>
      <p className="muted">
        Finance queue for cash bookings where the partner collected customer cash and still owes HANDS
        platform fee or withholding. This page focuses on why the wallet became negative, whether the
        company-fee deposit or approved offset has evidence, and when marketplace participation can reopen.
        Wallet-blocked partners who only viewed the marketplace list are not tracked here.
      </p>

      <section className="card" style={{ marginTop: 16, marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Cash settlement date range</h2>
            <p className="muted">
              Range: {dateRangeLabel(filters.range)}. All date-filtered totals are calculated from visible
              cash earning records; all-date totals use the API summary.
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

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Cash settlement evidence checklist</h2>
            <p className="muted">
              Operator checklist for cash bookings where the Partner collected customer cash and HANDS is
              waiting for a company-fee deposit or approved offset.
            </p>
          </div>
          <Link className="text-link" href="/bookings?view=cash-debt">
            Booking cash debt queue
          </Link>
        </div>
        <div className="ops-task-grid">
          {evidenceChecklist.map((item) => (
            <Link className={`ops-task-card ${item.className}`} href={item.href} key={item.title}>
              <div>
                <span className={`pill ${item.pillClass}`}>{item.status}</span>
                <h3>{item.title}</h3>
                <p className="muted">{item.detail}</p>
              </div>
              <small>{item.operatorRule}</small>
            </Link>
          ))}
        </div>
      </section>

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
                  <div className="muted">{row.debtOrigin}</div>
                </td>
                <td>
                  <div>HANDS fee {formatMoney(row.platformFee, row.earning.currency)}</div>
                  <div className="muted">Tax {formatMoney(row.taxAmount, row.earning.currency)}</div>
                </td>
                <td>
                  <div className="service-matrix-cell">
                    <small>{row.settlementEvidence}</small>
                    <small>Suggested ref: {row.settlementReference}</small>
                    <small>Payment method: {row.paymentMethod}</small>
                    {row.lastLedgerRef ? <small>Last ledger ref: {row.lastLedgerRef}</small> : null}
                    <small>{row.nextAction}</small>
                  </div>
                  <div className="ops-task-note" style={{ marginTop: 10 }}>
                    <strong>Cash settlement action execution map</strong>
                    <div className="setup-stage-list" style={{ marginTop: 8 }}>
                      {cashSettlementActionExecutionMap(row).map((item) => (
                        <div className="setup-stage-item" key={`${row.earning.id}-${item.action}`}>
                          <span className={`pill ${item.pillClass}`}>{item.status}</span>
                          <div>
                            <strong>{item.action}</strong>
                            <p className="muted">{item.reason}</p>
                            <small>{item.operatorRule}</small>
                          </div>
                        </div>
                      ))}
                    </div>
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
  debtOrigin: string;
  settlementEvidence: string;
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

type EvidenceChecklistItem = {
  title: string;
  status: string;
  detail: string;
  operatorRule: string;
  href: string;
  className: string;
  pillClass: string;
};

type CashSettlementActionExecutionItem = {
  action: string;
  status: string;
  reason: string;
  operatorRule: string;
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
        debtOrigin: cashDebtOriginLabel(earning),
        settlementEvidence: cashDebtEvidenceLabel(earning),
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

function cashSettlementActionExecutionMap(row: CashSettlementRow): CashSettlementActionExecutionItem[] {
  const hasPaymentEvidence = Boolean(row.earning.booking?.payment);
  const hasReference = Boolean(row.settlementReference);
  const hasLedgerReference = Boolean(row.lastLedgerRef);
  const isOldDebt = cashSettlementRowAgeHours(row) >= 24;

  return [
    {
      action: 'Confirm cash collection',
      status: hasPaymentEvidence && row.paymentMethod === 'CASH' ? 'Ready' : 'Check booking',
      reason:
        hasPaymentEvidence && row.paymentMethod === 'CASH'
          ? `Booking payment is marked CASH and customer cash amount is ${formatMoney(
              row.bookingAmount,
              row.earning.currency,
            )}.`
          : 'Payment evidence is missing or the booking payment method is not cash in the current payload.',
      operatorRule: 'Open the booking detail before settlement if the payment method or amount is unclear.',
      pillClass: hasPaymentEvidence && row.paymentMethod === 'CASH' ? 'pill-success' : 'pill-warn',
    },
    {
      action: 'Attach settlement reference',
      status: hasReference ? 'Reference ready' : 'Reference needed',
      reason: hasReference
        ? `Use ${row.settlementReference} as the bank deposit or approved offset reference.`
        : 'No suggested settlement reference is available for this debt row.',
      operatorRule: 'The backend requires a reference so finance can audit the wallet reopening decision.',
      pillClass: hasReference ? 'pill-success' : 'pill-danger',
    },
    {
      action: 'Settle wallet debt',
      status: row.debtAmount > 0 ? 'Debt open' : 'Clear',
      reason:
        row.debtAmount > 0
          ? `${formatMoney(row.debtAmount, row.earning.currency)} remains as HANDS fee/tax wallet debt.`
          : 'No open wallet debt remains on this earning row.',
      operatorRule:
        'Settle only after deposit evidence or approved offset; marketplace participation and booking handoff stay gated until cleared.',
      pillClass: row.debtAmount > 0 ? 'pill-danger' : 'pill-success',
    },
    {
      action: 'Ledger trace',
      status: hasLedgerReference ? 'Trace exists' : 'No prior trace',
      reason: hasLedgerReference
        ? `Last wallet ledger reference is ${row.lastLedgerRef}.`
        : 'No wallet ledger reference has been recorded yet for this row.',
      operatorRule: 'Keep the booking, payment, earning, and wallet ledger references aligned.',
      pillClass: hasLedgerReference ? 'pill-info' : 'pill-neutral',
    },
    {
      action: 'Aging follow-up',
      status: isOldDebt ? 'Over 24h' : 'Fresh',
      reason: isOldDebt
        ? 'This cash debt has been open longer than 24 hours.'
        : 'This cash debt is still inside the first 24-hour finance follow-up window.',
      operatorRule: isOldDebt
        ? 'Prioritize partner deposit confirmation or admin offset review.'
        : 'Keep in the normal settlement queue.',
      pillClass: isOldDebt ? 'pill-warn' : 'pill-success',
    },
  ];
}

function buildCashSettlementEvidenceChecklist(
  rows: CashSettlementRow[],
  providers: CashSettlementProviderGroup[],
  summary: CashSettlementSummary,
): EvidenceChecklistItem[] {
  const highDebtProviders = providers.filter((provider) => provider.debtAmount >= 500000);
  const rowsWithRefs = rows.filter((row) => row.lastLedgerRef);

  return [
    {
      title: 'Company-fee evidence',
      status: `${rows.length} open row(s)`,
      detail: 'Confirm bank deposit reference or approved offset memo before settling the cash fee debt.',
      operatorRule: 'The settlement action requires an auditable reference and note.',
      href: '/cash-settlements',
      className: rows.length ? 'ops-task-pending' : 'ops-task-done',
      pillClass: rows.length ? 'pill-warn' : 'pill-success',
    },
    {
      title: 'Wallet participation gate',
      status: `${summary.providerCount} Partner(s)`,
      detail:
        'Negative wallet partners can see marketplace demand, but cannot join marketplace bookings or continue booking handoff.',
      operatorRule: 'Reopen marketplace participation only after settlement or approved offset is recorded.',
      href: '/partner-controls',
      className: summary.providerCount ? 'ops-task-blocked' : 'ops-task-done',
      pillClass: summary.providerCount ? 'pill-danger' : 'pill-success',
    },
    {
      title: 'High-debt follow-up',
      status: `${highDebtProviders.length} follow-up`,
      detail: 'Prioritize the highest debt and oldest open rows for operator handoff.',
      operatorRule: 'Use Partner detail, booking detail, and finance closeout together.',
      href: '/finance-closeout',
      className: highDebtProviders.length ? 'ops-task-pending' : 'ops-task-done',
      pillClass: highDebtProviders.length ? 'pill-warn' : 'pill-success',
    },
    {
      title: 'Ledger trace',
      status: `${rowsWithRefs.length} ref(s)`,
      detail: 'Existing wallet ledger references should match the booking, payment, and earning row.',
      operatorRule: 'If a reference is missing, leave the row open until finance has evidence.',
      href: '/audit-log?bucket=Finance%2FCloseout',
      className: rowsWithRefs.length === rows.length ? 'ops-task-done' : 'ops-task-pending',
      pillClass: rowsWithRefs.length === rows.length ? 'pill-success' : 'pill-info',
    },
  ];
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
        ? 'Collect partner deposit or approve admin offset before marketplace participation or direct acceptance resumes.'
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

function cashDebtOriginLabel(earning: AdminEarning) {
  const method = earning.booking?.payment?.method ?? 'CASH';
  const service = bookingServiceLabel(earning);
  if (method === 'CASH') {
    return `${service}: partner collected customer cash; HANDS fee/tax is still unpaid.`;
  }
  return `${service}: negative wallet row needs finance review because payment method is ${method}.`;
}

function cashDebtEvidenceLabel(earning: AdminEarning) {
  if (earning.settlementRef) {
    return `Settlement reference recorded: ${earning.settlementRef}.`;
  }
  const ledgerRef = earning.walletLedgerEntries?.find((entry) => entry.reference)?.reference;
  if (ledgerRef) {
    return `Wallet ledger reference exists: ${ledgerRef}. Confirm whether it is a deposit or offset.`;
  }
  return 'No deposit or approved offset reference is recorded yet.';
}

function cashSettlementRowAgeHours(row: CashSettlementRow) {
  const createdMs = Date.parse(row.earning.createdAt ?? '');
  if (!Number.isFinite(createdMs)) {
    return 0;
  }
  return (Date.now() - createdMs) / (60 * 60 * 1000);
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
