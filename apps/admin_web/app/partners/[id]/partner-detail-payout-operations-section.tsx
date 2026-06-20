import Link from 'next/link';

import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';

export type PartnerPayoutOperationsTone = 'done' | 'pending' | 'blocked';

export type PartnerPayoutOperationsCard = {
  readonly action: string;
  readonly detail: string;
  readonly status: string;
  readonly title: string;
  readonly tone: PartnerPayoutOperationsTone;
};

export type PartnerPayoutOperationsView = {
  readonly blockers: readonly string[];
  readonly cards: readonly PartnerPayoutOperationsCard[];
  readonly hold?: {
    readonly expiresAtLabel: string;
    readonly reason?: string | null;
    readonly startsAtLabel: string;
  } | null;
  readonly status: string;
  readonly tone: PartnerPayoutOperationsTone;
};

export type PartnerPayoutEarningRow = {
  readonly amountLine: string;
  readonly detailLine: string;
  readonly id: string;
  readonly settlementNotes?: string | null;
  readonly settlementRef?: string | null;
  readonly smallLabel: string;
  readonly statusLabel: string;
  readonly title: string;
  readonly walletLines: readonly string[];
};

export type PartnerPayoutBatchRow = {
  readonly createdLine: string;
  readonly href: string;
  readonly id: string;
  readonly paidLine?: string | null;
  readonly status: string;
  readonly totalNetLabel: string;
};

type PartnerDetailPayoutOperationsSectionProps = {
  readonly cardClassForTone: (tone: PartnerPayoutOperationsTone) => string;
  readonly earningsRows: readonly PartnerPayoutEarningRow[];
  readonly hasCashFeeDebt: boolean;
  readonly operations: PartnerPayoutOperationsView;
  readonly partnerControlsHref: string;
  readonly payoutBatchRows: readonly PartnerPayoutBatchRow[];
  readonly pillClassForTone: (tone: PartnerPayoutOperationsTone) => string;
};

export function PartnerDetailPayoutOperationsSection({
  cardClassForTone,
  earningsRows,
  hasCashFeeDebt,
  operations,
  partnerControlsHref,
  payoutBatchRows,
  pillClassForTone,
}: PartnerDetailPayoutOperationsSectionProps) {
  return (
    <div className="card admin-mb-16">
      <div className="ops-section-header">
        <div>
          <h2>Payout operations</h2>
          <p className="muted">
            Settlement view for unpaid earnings, withholding, payout batches, and payout holds.
          </p>
        </div>
        <span className={`pill ${pillClassForTone(operations.tone)}`}>{operations.status}</span>
      </div>
      <div className="ops-task-grid">
        {operations.cards.map((card) => (
          <div className={`ops-task-card ${cardClassForTone(card.tone)}`} key={card.title}>
            <div>
              <span className={`pill ${pillClassForTone(card.tone)}`}>{card.status}</span>
              <h3>{card.title}</h3>
              <p className="muted">{card.detail}</p>
            </div>
            <small>{card.action}</small>
          </div>
        ))}
      </div>
      {operations.hold ? (
        <AdminTableScroll>
          <AdminDataTable
            emptyMessage={<PartnerPayoutTableEmptyState message="No active payout hold." />}
            headers={payoutHoldHeaders}
            rowCount={1}
          >
            <tr>
              <td>
                <span className="pill pill-danger">HELD</span>
                <p>
                  <strong>Active payout hold</strong>
                </p>
              </td>
              <td>
                <p className="muted">{operations.hold.reason ?? 'No hold reason recorded.'}</p>
              </td>
              <td>
                <span className="muted">Started {operations.hold.startsAtLabel}</span>
                <p className="muted">Expires {operations.hold.expiresAtLabel}</p>
              </td>
              <td>
                <Link className="text-link" href={partnerControlsHref}>
                  Reports desk
                </Link>
              </td>
            </tr>
          </AdminDataTable>
        </AdminTableScroll>
      ) : null}
      {operations.blockers.length ? (
        <AdminTableScroll>
          <AdminDataTable
            emptyMessage={<PartnerPayoutTableEmptyState message="No payout blockers." />}
            headers={payoutBlockerHeaders}
            rowCount={operations.blockers.length}
          >
            {operations.blockers.map((blocker) => (
              <tr key={blocker}>
                <td>
                  <span className="pill pill-warn">GATE</span>
                  <p>
                    <strong>Payout blocker</strong>
                  </p>
                </td>
                <td>
                  <p className="muted">{blocker}</p>
                </td>
                <td>
                  <span className="muted">Resolve</span>
                </td>
              </tr>
            ))}
          </AdminDataTable>
        </AdminTableScroll>
      ) : null}
      <div className="detail-grid admin-mt-16">
        <div>
          <div className="ops-section-header">
            <h3>Recent earnings</h3>
            <div className="actions">
              {hasCashFeeDebt ? (
                <Link className="text-link" href="/cash-settlements">
                  Cash debt queue
                </Link>
              ) : null}
              <Link className="text-link" href="/earnings">
                Open earnings
              </Link>
            </div>
          </div>
          <AdminTableScroll>
            <AdminDataTable
              emptyMessage={
                <PartnerPayoutTableEmptyState message="No earnings yet. Payout eligibility starts after the first completed service." />
              }
              headers={earningHeaders}
              rowCount={earningsRows.length}
            >
              {earningsRows.map((earning) => (
                <tr key={earning.id}>
                  <td>
                    <span className="muted">{earning.statusLabel}</span>
                    <p>
                      <strong>{earning.title}</strong>
                    </p>
                    <p className="muted">{earning.detailLine}</p>
                  </td>
                  <td>
                    <span>{earning.amountLine}</span>
                  </td>
                  <td>
                    {earning.settlementRef ? (
                      <span className="muted">Settlement ref {earning.settlementRef}</span>
                    ) : (
                      <span className="muted">No settlement ref</span>
                    )}
                    {earning.settlementNotes ? <p className="muted">{earning.settlementNotes}</p> : null}
                  </td>
                  <td>
                    {earning.walletLines.length ? (
                      earning.walletLines.map((line, index) => (
                        <p className="muted" key={`${earning.id}-wallet-${index}`}>
                          {line}
                        </p>
                      ))
                    ) : (
                      <span className="muted">No wallet adjustment</span>
                    )}
                  </td>
                  <td>
                    <span className="muted">{earning.smallLabel}</span>
                  </td>
                </tr>
              ))}
            </AdminDataTable>
          </AdminTableScroll>
        </div>
        <div>
          <div className="ops-section-header">
            <h3>Recent payout batches</h3>
            <Link className="text-link" href="/payouts">
              Open payouts
            </Link>
          </div>
          <AdminTableScroll>
            <AdminDataTable
              emptyMessage={
                <PartnerPayoutTableEmptyState message="No payout batch has been created for this partner yet." />
              }
              headers={payoutBatchHeaders}
              rowCount={payoutBatchRows.length}
            >
              {payoutBatchRows.map((batch) => (
                <tr key={batch.id}>
                  <td>
                    <strong>{batch.totalNetLabel}</strong>
                  </td>
                  <td>
                    <span className={`pill ${payoutBatchPill(batch.status)}`}>{batch.status}</span>
                  </td>
                  <td>
                    <span className="muted">{batch.createdLine}</span>
                    {batch.paidLine ? <p className="muted">{batch.paidLine}</p> : null}
                  </td>
                  <td>
                    <Link className="text-link" href={batch.href}>
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </AdminDataTable>
          </AdminTableScroll>
        </div>
      </div>
    </div>
  );
}

const payoutHoldHeaders = ['Hold', 'Reason', 'Timeline', 'Action'] as const;
const payoutBlockerHeaders = ['Gate', 'Detail', 'Action'] as const;
const earningHeaders = ['Earning', 'Amount', 'Settlement', 'Wallet', 'Action'] as const;
const payoutBatchHeaders = ['Batch', 'Status', 'Timeline', 'Action'] as const;

function payoutBatchPill(status: string) {
  const normalizedStatus = status.toUpperCase();

  if (normalizedStatus.includes('PAID') || normalizedStatus.includes('COMPLETED')) {
    return 'pill-success';
  }
  if (normalizedStatus.includes('FAILED') || normalizedStatus.includes('HELD')) {
    return 'pill-danger';
  }
  return 'pill-warn';
}

function PartnerPayoutTableEmptyState({ message }: { readonly message: string }) {
  return (
    <>
      <strong>No records found</strong>
      <p className="muted">{message}</p>
    </>
  );
}
