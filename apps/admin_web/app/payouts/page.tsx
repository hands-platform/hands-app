import { AdminEarning, AdminPayoutBatch, adminGet } from '../../lib/admin-api';
import { markPayoutFailed, markPayoutPaid, markPayoutProcessing, updatePayoutTransferRef } from './actions';

export default async function PayoutsPage() {
  const batches = sortBatches(await adminGet<AdminPayoutBatch[]>('/admin/payout-batches', []));
  const summary = buildSummary(batches);
  const commandSignals = buildPayoutCommandSignals(batches);
  const payoutLanes = buildPayoutLanes(batches);
  const serviceEvidence = buildPayoutServiceEvidence(batches);
  const moneyFlowCards = buildPayoutMoneyFlowCards(summary, serviceEvidence);
  const moneyFlowChecks = buildPayoutMoneyFlowChecks(batches, serviceEvidence);
  const releaseQueue = buildPayoutReleaseQueue(batches);

  return (
    <>
      <h1>Provider Payouts</h1>
      <section className="grid" style={{ marginBottom: 16 }}>
        <div className="card">
          <p>Total batches</p>
          <h2>{summary.total}</h2>
        </div>
        <div className="card">
          <p>Needs review</p>
          <h2>{summary.needsReview}</h2>
        </div>
        <div className="card">
          <p>In progress</p>
          <h2>{summary.inProgress}</h2>
        </div>
        <div className="card">
          <p>Payout holds</p>
          <h2>{summary.payoutHolds}</h2>
        </div>
        <div className="card">
          <p>Missing refs</p>
          <h2>{summary.missingTransferRefs}</h2>
        </div>
        <div className="card">
          <p>Settled</p>
          <h2>{summary.settled}</h2>
        </div>
        <div className="card">
          <p>Total net</p>
          <h2>{formatMoney(summary.totalNetAmount, summary.currency)}</h2>
        </div>
        <div className="card">
          <p>Withheld tax</p>
          <h2>{formatMoney(summary.withholdingAmount, summary.currency)}</h2>
        </div>
      </section>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Payout money flow</h2>
            <p className="muted">
              Reconciles payout batches against service pricing evidence before transfer: gross represented,
              provider payout, HANDS fee, withholding, and cash debt.
            </p>
          </div>
          <a className="text-link" href="/bookings">
            Trace bookings
          </a>
        </div>
        <div className="service-trace-summary">
          {moneyFlowCards.map((card) => (
            <div key={card.label}>
              <span>{card.label}</span>
              <strong>{formatMoney(card.amount, summary.currency)}</strong>
              <small>{card.detail}</small>
            </div>
          ))}
        </div>
        <div className="ops-task-grid" style={{ marginTop: 16 }}>
          {moneyFlowChecks.map((check) => (
            <div className={`ops-task-card ${check.className}`} key={check.title}>
              <div>
                <span className={`pill ${check.pillClass}`}>{check.status}</span>
                <h3>{check.title}</h3>
                <p className="muted">{check.detail}</p>
              </div>
              <small>{check.action}</small>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Payout command queue</h2>
            <p className="muted">
              Finance-first view for review money, active transfers, payout holds, and reconciliation
              warnings.
            </p>
          </div>
          <a className="text-link" href="/earnings">
            Review earnings queue
          </a>
        </div>
        <div className="ops-task-grid">
          {commandSignals.map((signal) => (
            <div className={`ops-task-card ${signal.className}`} key={signal.title}>
              <div>
                <span className={`pill ${signal.pillClass}`}>{signal.status}</span>
                <h3>{signal.title}</h3>
                <p className="muted">{signal.detail}</p>
              </div>
              <small>{signal.action}</small>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Release blocker queue</h2>
            <p className="muted">
              Transfer-facing list of batches that should not be paid until finance, tax, risk, and bank
              references are clean.
            </p>
          </div>
          <span className={`pill ${releaseQueue.length ? 'pill-danger' : 'pill-success'}`}>
            {releaseQueue.length ? `${releaseQueue.length} blocker(s)` : 'Clear'}
          </span>
        </div>
        <div className="setup-stage-list">
          {releaseQueue.map((item) => (
            <div className="setup-stage-item" key={`${item.batch.id}-${item.reason.label}`}>
              <span>{item.severity}</span>
              <div>
                <strong>
                  {item.providerLabel} / {formatMoney(item.batch.totalNetAmount, item.batch.currency)}
                </strong>
                <p className="muted">
                  {item.reason.label}: {item.reason.detail}
                </p>
                <p className="muted">{item.reason.action}</p>
                <div className="participant-list" style={{ marginTop: 8 }}>
                  {payoutBlockingReasons(item.batch).map((reason) => (
                    <span className={`pill ${reason.pillClass}`} key={reason.label}>
                      {reason.label}
                    </span>
                  ))}
                </div>
              </div>
              <a className="text-link" href={`#${item.batch.id}`}>
                Row
              </a>
            </div>
          ))}
          {releaseQueue.length === 0 ? (
            <div className="setup-stage-item">
              <span>OK</span>
              <div>
                <strong>No payout release blocker</strong>
                <p className="muted">
                  Transfer refs, withholding logs, payout holds, and earning attachments are clean for the
                  current queue.
                </p>
              </div>
              <small>Clear</small>
            </div>
          ) : null}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16, overflowX: 'auto' }}>
        <div className="risk-watch-header">
          <div>
            <h2>Payout service evidence</h2>
            <p className="muted">
              Shows which service duration options are inside payout batches, so finance can reconcile
              provider net, HANDS fee, tax withholding, and cash wallet debt before bank transfer.
            </p>
          </div>
          <a className="text-link" href="/services">
            Review service pricing
          </a>
        </div>
        <div className="service-trace-summary">
          <div>
            <span>Service options</span>
            <strong>{serviceEvidence.length}</strong>
          </div>
          <div>
            <span>Batches</span>
            <strong>{batches.filter((batch) => (batch.earnings?.length ?? 0) > 0).length}</strong>
          </div>
          <div>
            <span>Gross</span>
            <strong>
              {formatMoney(
                serviceEvidence.reduce((sum, item) => sum + item.grossAmount, 0),
                summary.currency,
              )}
            </strong>
          </div>
          <div>
            <span>Provider net</span>
            <strong>
              {formatMoney(
                serviceEvidence.reduce((sum, item) => sum + item.netAmount, 0),
                summary.currency,
              )}
            </strong>
          </div>
          <div>
            <span>Platform fee</span>
            <strong>
              {formatMoney(
                serviceEvidence.reduce((sum, item) => sum + item.platformFee, 0),
                summary.currency,
              )}
            </strong>
          </div>
          <div>
            <span>Tax withheld</span>
            <strong>
              {formatMoney(
                serviceEvidence.reduce((sum, item) => sum + item.withholdingAmount, 0),
                summary.currency,
              )}
            </strong>
          </div>
        </div>
        {serviceEvidence.length ? (
          <table className="table service-trace">
            <thead>
              <tr>
                <th>Service option</th>
                <th>Batches</th>
                <th>Earnings</th>
                <th>Gross</th>
                <th>Provider net</th>
                <th>Platform fee</th>
                <th>Tax</th>
                <th>Cash debt</th>
              </tr>
            </thead>
            <tbody>
              {serviceEvidence.map((item) => (
                <tr key={item.key}>
                  <td>
                    <strong>{item.label}</strong>
                    <p className="muted">{item.groupKey}</p>
                  </td>
                  <td>{item.batchCount}</td>
                  <td>{item.earningCount}</td>
                  <td>{formatMoney(item.grossAmount, item.currency)}</td>
                  <td>{formatMoney(item.netAmount, item.currency)}</td>
                  <td>{formatMoney(item.platformFee, item.currency)}</td>
                  <td>{formatMoney(item.withholdingAmount, item.currency)}</td>
                  <td>
                    <span className={`pill ${item.cashDebtAmount ? 'pill-danger' : 'pill-success'}`}>
                      {formatMoney(item.cashDebtAmount, item.currency)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">No payout batch has linked service evidence yet.</p>
        )}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Payout status lanes</h2>
            <p className="muted">
              Work from blocked and failed lanes first, then draft review, processing confirmation, and paid
              reconciliation.
            </p>
          </div>
          <span className="pill pill-info">{batches.length} batch(es)</span>
        </div>
        <div className="detail-grid" style={{ marginTop: 16 }}>
          {payoutLanes.map((lane) => (
            <div key={lane.title}>
              <div className="risk-watch-header">
                <h3>{lane.title}</h3>
                <span className={`pill ${lane.pillClass}`}>{lane.batches.length}</span>
              </div>
              {lane.batches.length ? (
                <div className="setup-stage-list">
                  {lane.batches.slice(0, 4).map((batch) => (
                    <div className="setup-stage-item" key={`${lane.title}-${batch.id}`}>
                      <span>{shortId(batch.id)}</span>
                      <div>
                        <strong>
                          {batch.providerProfile?.displayName ??
                            batch.providerProfile?.user?.phone ??
                            'Unknown provider'}
                        </strong>
                        <p className="muted">
                          {formatMoney(batch.totalNetAmount, batch.currency)} / {batch.earnings?.length ?? 0}{' '}
                          earning(s)
                        </p>
                        <p className="muted">{opsHint(batch)}</p>
                      </div>
                      <a className="text-link" href={`#${batch.id}`}>
                        Row
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted">{lane.emptyText}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="toolbar">
          <div>
            <p className="muted">
              Provider settlement batches ordered so unresolved money movement stays at the top.
            </p>
          </div>
          <div className="participant-list">
            <span className="pill pill-success">Newest active first</span>
            <span className="pill pill-info">Payout signal</span>
            <span className="pill pill-warn">Reconciliation</span>
            <a className="pill" href="/earnings">
              Review earnings
            </a>
          </div>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>Batch</th>
              <th>Provider</th>
              <th>Status</th>
              <th>Ops signal</th>
              <th>Blocking reasons</th>
              <th>Transfer ref</th>
              <th>Earnings</th>
              <th>Checklist</th>
              <th>Total</th>
              <th>Tax withheld</th>
              <th>Paid at</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {batches.map((batch) => {
              const checklist = payoutChecklist(batch);
              const payoutHold = activePayoutHold(batch);
              const blockingReasons = payoutBlockingReasons(batch);
              const paidBlockedByMissingRef =
                batch.status !== 'PAID' && batch.status !== 'CANCELLED' && !batch.transferRef;
              return (
                <tr id={batch.id} key={batch.id}>
                  <td>
                    <div>{shortId(batch.id)}</div>
                    <div className="muted">{relativeTime(batch.createdAt)}</div>
                  </td>
                  <td>
                    <div>
                      {batch.providerProfile?.displayName ?? batch.providerProfile?.user?.phone ?? 'Unknown'}
                    </div>
                    <div className="muted">{batch.providerProfile?.user?.phone ?? 'No phone on file'}</div>
                    {payoutHold && (
                      <div style={{ marginTop: 6 }}>
                        <span className="pill pill-danger">Payout hold</span>
                      </div>
                    )}
                  </td>
                  <td>
                    <div>{humanizeStatus(batch.status)}</div>
                    <div className="muted">{payoutPhase(batch.status)}</div>
                  </td>
                  <td>
                    <span className={payoutHold ? 'signal signal-warn' : signalClass(batch.status)}>
                      {opsSignal(batch)}
                    </span>
                    <div className="muted" style={{ marginTop: 6 }}>
                      {opsHint(batch)}
                    </div>
                  </td>
                  <td>
                    <div className="participant-list">
                      {blockingReasons.length ? (
                        blockingReasons.map((reason) => (
                          <span
                            className={`pill ${reason.pillClass}`}
                            key={reason.label}
                            title={reason.detail}
                          >
                            {reason.label}
                          </span>
                        ))
                      ) : (
                        <span className="pill pill-success">Clear</span>
                      )}
                    </div>
                    <div className="muted" style={{ marginTop: 6 }}>
                      {blockingReasons.length
                        ? blockingReasons.map((reason) => reason.action).join(' ')
                        : 'No blocking reason is preventing the next finance action.'}
                    </div>
                  </td>
                  <td>
                    <div>{batch.transferRef ?? '-'}</div>
                    <div className="muted">{batch.notes?.trim() ? batch.notes : 'No transfer notes'}</div>
                  </td>
                  <td>
                    <div>{batch.earnings?.length ?? 0} item(s)</div>
                    <div className="muted">{earningsStatusHint(batch)}</div>
                    <div className="participant-list" style={{ marginTop: 8 }}>
                      {batchServiceEvidence(batch)
                        .slice(0, 3)
                        .map((item) => (
                          <span className="pill pill-info" key={`${batch.id}-${item.key}`}>
                            {item.label}: {formatMoney(item.netAmount, item.currency)}
                          </span>
                        ))}
                    </div>
                  </td>
                  <td>
                    <div className="participant-list">
                      {checklist.map((item) => (
                        <span
                          className={item.ok ? 'pill pill-success' : 'pill pill-warn'}
                          key={item.label}
                          title={item.detail}
                        >
                          {item.label}
                        </span>
                      ))}
                    </div>
                    <div className="muted" style={{ marginTop: 6 }}>
                      {payoutReadinessSummary(batch)}
                    </div>
                  </td>
                  <td>{formatMoney(batch.totalNetAmount, batch.currency)}</td>
                  <td>
                    <div>{formatMoney(batchWithholdingAmount(batch), batch.currency)}</div>
                    <div className="muted">{batch.withholdingLogs?.length ?? 0} tax log(s)</div>
                  </td>
                  <td>
                    <div>{batch.paidAt ? new Date(batch.paidAt).toLocaleString() : '-'}</div>
                    <div className="muted">
                      {batch.paidAt ? relativeTime(batch.paidAt) : 'Awaiting settlement'}
                    </div>
                  </td>
                  <td>
                    <form className="actions" action={updatePayoutTransferRef}>
                      <input type="hidden" name="payoutBatchId" value={batch.id} />
                      <input
                        aria-label="Transfer reference"
                        name="transferRef"
                        placeholder="Bank ref"
                        defaultValue={batch.transferRef ?? ''}
                      />
                      <input
                        aria-label="Transfer notes"
                        name="notes"
                        placeholder="Notes"
                        defaultValue={batch.notes ?? ''}
                      />
                      <button type="submit">Save</button>
                    </form>
                    <div className="actions" style={{ marginTop: 8 }}>
                      {batch.status === 'DRAFT' && (
                        <PayoutStatusForm
                          action={markPayoutProcessing}
                          batch={batch}
                          disabled={Boolean(payoutHold)}
                          label="Processing"
                        />
                      )}
                      {batch.status !== 'PAID' && batch.status !== 'CANCELLED' && (
                        <PayoutStatusForm
                          action={markPayoutPaid}
                          batch={batch}
                          disabled={Boolean(payoutHold) || paidBlockedByMissingRef}
                          label="Paid"
                        />
                      )}
                      {batch.status === 'PROCESSING' && (
                        <PayoutStatusForm action={markPayoutFailed} batch={batch} label="Failed" />
                      )}
                      {payoutHold && (
                        <a className="pill pill-danger" href={`/providers/${batch.providerProfileId}`}>
                          Open provider risk
                        </a>
                      )}
                      {paidBlockedByMissingRef && (
                        <span className="pill pill-warn">Save bank ref before paid</span>
                      )}
                      {(batch.status === 'PAID' || batch.status === 'CANCELLED') && (
                        <span className="muted">No status action</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {batches.length === 0 && (
              <tr>
                <td colSpan={12}>No payout batches loaded.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function PayoutStatusForm({
  action,
  batch,
  disabled,
  label,
}: {
  action: (formData: FormData) => Promise<void>;
  batch: AdminPayoutBatch;
  disabled?: boolean;
  label: string;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="payoutBatchId" value={batch.id} />
      <input type="hidden" name="transferRef" value={batch.transferRef ?? ''} />
      <button disabled={disabled} type="submit">
        {label}
      </button>
    </form>
  );
}

function sortBatches(batches: AdminPayoutBatch[]) {
  return [...batches].sort((left, right) => {
    const scoreDiff = payoutPriority(left.status) - payoutPriority(right.status);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }
    return Date.parse(right.createdAt) - Date.parse(left.createdAt);
  });
}

function payoutPriority(status: string) {
  switch (status) {
    case 'FAILED':
      return 0;
    case 'DRAFT':
      return 1;
    case 'PROCESSING':
      return 2;
    case 'PAID':
      return 3;
    case 'CANCELLED':
      return 4;
    default:
      return 5;
  }
}

function buildSummary(batches: AdminPayoutBatch[]) {
  const currency = batches[0]?.currency ?? 'VND';
  return {
    total: batches.length,
    needsReview: batches.filter((batch) => batch.status === 'DRAFT' || batch.status === 'FAILED').length,
    inProgress: batches.filter((batch) => batch.status === 'PROCESSING').length,
    payoutHolds: batches.filter((batch) => Boolean(activePayoutHold(batch))).length,
    missingTransferRefs: batches.filter((batch) => transferRefRequiredBeforePaid(batch)).length,
    settled: batches.filter((batch) => batch.status === 'PAID').length,
    totalNetAmount: batches.reduce((sum, batch) => sum + batch.totalNetAmount, 0),
    withholdingAmount: batches.reduce((sum, batch) => sum + batchWithholdingAmount(batch), 0),
    currency,
  };
}

type PayoutCommandSignal = {
  title: string;
  status: string;
  detail: string;
  action: string;
  className: string;
  pillClass: string;
};

type MoneyFlowCard = {
  label: string;
  amount: number;
  detail: string;
};

type PayoutLane = {
  title: string;
  batches: AdminPayoutBatch[];
  pillClass: string;
  emptyText: string;
};

type PayoutBlockingReason = {
  label: string;
  detail: string;
  action: string;
  pillClass: string;
};

type PayoutReleaseQueueItem = {
  batch: AdminPayoutBatch;
  reason: PayoutBlockingReason;
  providerLabel: string;
  severity: 'Block' | 'Check';
};

type PayoutServiceEvidenceItem = {
  key: string;
  label: string;
  groupKey: string;
  currency: string;
  batchCount: number;
  earningCount: number;
  grossAmount: number;
  netAmount: number;
  platformFee: number;
  withholdingAmount: number;
  cashDebtAmount: number;
};

type InternalPayoutServiceEvidenceItem = PayoutServiceEvidenceItem & {
  batchIds: Set<string>;
  earningIds: Set<string>;
};

function buildPayoutServiceEvidence(batches: AdminPayoutBatch[]): PayoutServiceEvidenceItem[] {
  const grouped = new Map<string, InternalPayoutServiceEvidenceItem>();

  batches.forEach((batch) => {
    (batch.earnings ?? []).forEach((earning) => {
      addEarningToServiceEvidence(grouped, batch.id, earning);
    });
  });

  return [...grouped.values()]
    .map(({ batchIds, earningIds, ...item }) => ({
      ...item,
      batchCount: batchIds.size,
      earningCount: earningIds.size,
    }))
    .sort((left, right) => right.netAmount - left.netAmount || left.label.localeCompare(right.label))
    .slice(0, 12);
}

function buildPayoutMoneyFlowCards(
  summary: ReturnType<typeof buildSummary>,
  serviceEvidence: PayoutServiceEvidenceItem[],
): MoneyFlowCard[] {
  const grossRepresented = sumPayoutServiceEvidence(serviceEvidence, 'grossAmount');
  const providerNetRepresented = sumPayoutServiceEvidence(serviceEvidence, 'netAmount');
  const platformFeeRepresented = sumPayoutServiceEvidence(serviceEvidence, 'platformFee');
  const taxRepresented = sumPayoutServiceEvidence(serviceEvidence, 'withholdingAmount');
  const cashDebtRepresented = sumPayoutServiceEvidence(serviceEvidence, 'cashDebtAmount');

  return [
    {
      label: 'Gross represented',
      amount: grossRepresented,
      detail: 'Customer charge attached to earnings inside payout batches.',
    },
    {
      label: 'Provider payout',
      amount: summary.totalNetAmount,
      detail: 'Batch net amount scheduled for provider transfer.',
    },
    {
      label: 'Provider net evidence',
      amount: providerNetRepresented,
      detail: 'Service evidence net amount used to cross-check batch totals.',
    },
    {
      label: 'HANDS fee',
      amount: platformFeeRepresented,
      detail: 'Platform fee represented by earnings inside payout batches.',
    },
    {
      label: 'Tax withheld',
      amount: taxRepresented || summary.withholdingAmount,
      detail: 'Withholding logs and earning tax amount before final settlement.',
    },
    {
      label: 'Cash debt represented',
      amount: cashDebtRepresented,
      detail: 'Negative wallet amount that should not be paid out as provider net.',
    },
  ];
}

function buildPayoutMoneyFlowChecks(
  batches: AdminPayoutBatch[],
  serviceEvidence: PayoutServiceEvidenceItem[],
): PayoutCommandSignal[] {
  const currency = batches[0]?.currency ?? 'VND';
  const serviceNet = sumPayoutServiceEvidence(serviceEvidence, 'netAmount');
  const batchNet = batches.reduce((sum, batch) => sum + batch.totalNetAmount, 0);
  const netGap = Math.abs(batchNet - serviceNet);
  const missingServiceEvidence =
    batches.filter((batch) => (batch.earnings?.length ?? 0) > 0).length > 0 && !serviceEvidence.length;
  const cashDebtEvidence = sumPayoutServiceEvidence(serviceEvidence, 'cashDebtAmount');
  const activeMissingRef = batches.filter((batch) => transferRefRequiredBeforePaid(batch));
  const paidMissingRef = batches.filter((batch) => batch.status === 'PAID' && !batch.transferRef);
  const taxOpen = batches.filter((batch) =>
    (batch.withholdingLogs ?? []).some((log) => log.status !== 'PAID'),
  );

  return [
    {
      title: 'Batch net reconciliation',
      status: netGap > 0 ? 'CHECK' : 'MATCHED',
      detail: `Batch net versus service evidence gap: ${formatMoney(netGap, currency)}.`,
      action:
        netGap > 0
          ? 'Review batch composition before marking bank transfer complete.'
          : 'Batch net aligns with service evidence.',
      className: netGap > 0 ? 'ops-task-pending' : 'ops-task-done',
      pillClass: netGap > 0 ? 'pill-warn' : 'pill-success',
    },
    {
      title: 'Service evidence',
      status: missingServiceEvidence ? 'MISSING' : `${serviceEvidence.length} OPTION(S)`,
      detail: missingServiceEvidence
        ? 'At least one payout batch has earnings but no service evidence was generated.'
        : 'Payout batches are traceable to service duration options where available.',
      action: missingServiceEvidence
        ? 'Check booking service links before approving payout.'
        : 'Service trace is ready for finance review.',
      className: missingServiceEvidence ? 'ops-task-blocked' : 'ops-task-done',
      pillClass: missingServiceEvidence ? 'pill-danger' : 'pill-success',
    },
    {
      title: 'Cash debt exclusion',
      status: cashDebtEvidence > 0 ? 'CHECK' : 'CLEAR',
      detail: cashDebtEvidence
        ? `${formatMoney(cashDebtEvidence, currency)} negative wallet amount appears in payout evidence.`
        : 'No negative wallet amount is represented in payout evidence.',
      action: cashDebtEvidence
        ? 'Remove or settle cash debt before transfer.'
        : 'Cash payment fee debt is not leaking into payout transfer.',
      className: cashDebtEvidence > 0 ? 'ops-task-blocked' : 'ops-task-done',
      pillClass: cashDebtEvidence > 0 ? 'pill-danger' : 'pill-success',
    },
    {
      title: 'Settlement references',
      status: `${activeMissingRef.length + paidMissingRef.length + taxOpen.length} CHECK`,
      detail: `${activeMissingRef.length} active batch(es) need bank ref before paid, ${paidMissingRef.length} paid missing ref, ${taxOpen.length} batch(es) with open tax logs.`,
      action:
        activeMissingRef.length || paidMissingRef.length || taxOpen.length
          ? 'Complete transfer refs and withholding log status.'
          : 'Transfer references and withholding logs look complete.',
      className:
        activeMissingRef.length || paidMissingRef.length || taxOpen.length
          ? 'ops-task-blocked'
          : 'ops-task-done',
      pillClass:
        activeMissingRef.length || paidMissingRef.length || taxOpen.length ? 'pill-danger' : 'pill-success',
    },
  ];
}

function sumPayoutServiceEvidence(
  serviceEvidence: PayoutServiceEvidenceItem[],
  field: keyof Pick<
    PayoutServiceEvidenceItem,
    'grossAmount' | 'netAmount' | 'platformFee' | 'withholdingAmount' | 'cashDebtAmount'
  >,
) {
  return serviceEvidence.reduce((sum, item) => sum + item[field], 0);
}

function buildPayoutReleaseQueue(batches: AdminPayoutBatch[]): PayoutReleaseQueueItem[] {
  return batches
    .map<PayoutReleaseQueueItem | null>((batch) => {
      const reasons = payoutBlockingReasons(batch);
      const primaryReason = reasons[0];
      if (!primaryReason) {
        return null;
      }

      return {
        batch,
        reason: primaryReason,
        providerLabel:
          batch.providerProfile?.displayName ?? batch.providerProfile?.user?.phone ?? 'Unknown provider',
        severity: primaryReason.pillClass === 'pill-danger' ? 'Block' : 'Check',
      };
    })
    .filter((item): item is PayoutReleaseQueueItem => Boolean(item))
    .sort((left, right) => {
      if (left.severity !== right.severity) {
        return left.severity === 'Block' ? -1 : 1;
      }
      return Date.parse(right.batch.createdAt) - Date.parse(left.batch.createdAt);
    })
    .slice(0, 6);
}

function batchServiceEvidence(batch: AdminPayoutBatch[]): PayoutServiceEvidenceItem[];
function batchServiceEvidence(batch: AdminPayoutBatch): PayoutServiceEvidenceItem[];
function batchServiceEvidence(batch: AdminPayoutBatch | AdminPayoutBatch[]) {
  return buildPayoutServiceEvidence(Array.isArray(batch) ? batch : [batch]);
}

function addEarningToServiceEvidence(
  grouped: Map<string, InternalPayoutServiceEvidenceItem>,
  batchId: string,
  earning: AdminEarning,
) {
  if (earning.status === 'CANCELLED') {
    return;
  }

  const bookingServices =
    earning.booking?.services && earning.booking.services.length > 0
      ? earning.booking.services
      : [
          {
            id: `earning-${earning.id}`,
            serviceId: 'unknown-service',
            quantity: 1,
            price: earning.grossAmount,
            service: null,
          },
        ];

  const allocationBase =
    bookingServices.reduce(
      (sum, bookingService) =>
        sum + Number(bookingService.price ?? 0) * Math.max(1, Number(bookingService.quantity ?? 1)),
      0,
    ) ||
    earning.grossAmount ||
    1;

  bookingServices.forEach((bookingService) => {
    const quantity = Math.max(1, Number(bookingService.quantity ?? 1));
    const serviceGross = Number(bookingService.price ?? 0) * quantity;
    const allocationShare = allocationBase > 0 ? serviceGross / allocationBase : 1 / bookingServices.length;
    const service = bookingService.service;
    const key = service?.id ?? bookingService.serviceId ?? 'unknown-service';
    const duration = service?.durationMin ? `${service.durationMin} min` : 'duration not linked';
    const label = service?.name ? `${service.name} / ${duration}` : 'Unlinked service option';
    const item = grouped.get(key) ?? {
      key,
      label,
      groupKey: service?.serviceGroupKey ?? bookingService.serviceId ?? 'unknown',
      currency: earning.currency,
      batchCount: 0,
      earningCount: 0,
      grossAmount: 0,
      netAmount: 0,
      platformFee: 0,
      withholdingAmount: 0,
      cashDebtAmount: 0,
      batchIds: new Set<string>(),
      earningIds: new Set<string>(),
    };

    item.batchIds.add(batchId);
    item.earningIds.add(earning.id);
    item.grossAmount += Math.round(earning.grossAmount * allocationShare);
    item.netAmount += Math.round(earning.netAmount * allocationShare);
    item.platformFee += Math.round(earning.platformFee * allocationShare);
    item.withholdingAmount += Math.round((earning.withholdingAmount ?? 0) * allocationShare);
    if (earning.netAmount < 0) {
      item.cashDebtAmount += Math.round(Math.abs(earning.netAmount) * allocationShare);
    }

    grouped.set(key, item);
  });
}

function buildPayoutCommandSignals(batches: AdminPayoutBatch[]): PayoutCommandSignal[] {
  const needsReview = batches.filter((batch) => batch.status === 'DRAFT' || batch.status === 'FAILED');
  const processing = batches.filter((batch) => batch.status === 'PROCESSING');
  const held = batches.filter((batch) => Boolean(activePayoutHold(batch)));
  const activeMissingRef = batches.filter((batch) => transferRefRequiredBeforePaid(batch));
  const missingTransferRef = batches.filter((batch) => batch.status === 'PAID' && !batch.transferRef);
  const missingEarnings = batches.filter((batch) => !batch.earnings?.length);
  const missingWithholdingLogs = batches.filter(
    (batch) => batchWithholdingAmount(batch) > 0 && !batch.withholdingLogs?.length,
  );
  const pendingWithholding = batches.filter((batch) =>
    (batch.withholdingLogs ?? []).some((log) => log.status !== 'PAID'),
  );
  const reconciliationWarnings =
    missingTransferRef.length +
    activeMissingRef.length +
    missingEarnings.length +
    missingWithholdingLogs.length +
    pendingWithholding.length;
  const currency = batches[0]?.currency ?? 'VND';

  return [
    {
      title: 'Review amount',
      status: `${needsReview.length} BATCH(ES)`,
      detail: formatMoney(
        needsReview.reduce((sum, batch) => sum + batch.totalNetAmount, 0),
        currency,
      ),
      action: needsReview.length
        ? 'Check failed and draft batches before starting bank transfer.'
        : 'No batch currently needs finance review.',
      className: needsReview.length ? 'ops-task-pending' : 'ops-task-done',
      pillClass: needsReview.length ? 'pill-warn' : 'pill-success',
    },
    {
      title: 'Banking in motion',
      status: `${processing.length} PROCESSING`,
      detail: formatMoney(
        processing.reduce((sum, batch) => sum + batch.totalNetAmount, 0),
        currency,
      ),
      action: processing.length
        ? 'Confirm transfer results, then mark paid or failed.'
        : 'No payout is currently in banking transfer.',
      className: processing.length ? 'ops-task-pending' : 'ops-task-done',
      pillClass: processing.length ? 'pill-info' : 'pill-success',
    },
    {
      title: 'Payout holds',
      status: `${held.length} HELD`,
      detail: held.length
        ? held
            .map((batch) => activePayoutHold(batch)?.reason ?? 'Active hold')
            .slice(0, 2)
            .join(' ')
        : 'No active payout hold on listed batches.',
      action: held.length ? 'Open provider risk before attempting payout.' : 'No risk hold action.',
      className: held.length ? 'ops-task-blocked' : 'ops-task-done',
      pillClass: held.length ? 'pill-danger' : 'pill-success',
    },
    {
      title: 'Reconciliation',
      status: `${reconciliationWarnings} CHECK`,
      detail: `${activeMissingRef.length} active missing ref, ${missingTransferRef.length} paid missing ref, ${pendingWithholding.length} tax open, ${missingWithholdingLogs.length} tax missing, ${missingEarnings.length} empty batch.`,
      action: reconciliationWarnings
        ? 'Fix active transfer refs, withholding status, or empty batch records.'
        : 'Paid batch references and tax logs look consistent.',
      className: reconciliationWarnings ? 'ops-task-blocked' : 'ops-task-done',
      pillClass: reconciliationWarnings ? 'pill-danger' : 'pill-success',
    },
  ];
}

function transferRefRequiredBeforePaid(batch: AdminPayoutBatch) {
  return batch.status !== 'PAID' && batch.status !== 'CANCELLED' && !batch.transferRef;
}

function payoutBlockingReasons(batch: AdminPayoutBatch): PayoutBlockingReason[] {
  const reasons: PayoutBlockingReason[] = [];
  const payoutHold = activePayoutHold(batch);
  const withholdingAmount = batchWithholdingAmount(batch);
  const withholdingLogs = batch.withholdingLogs ?? [];
  const earnings = batch.earnings ?? [];

  if (payoutHold) {
    reasons.push({
      label: 'Payout hold',
      detail: payoutHold.reason,
      action: 'Lift the provider payout hold before changing this payout.',
      pillClass: 'pill-danger',
    });
  }

  if (transferRefRequiredBeforePaid(batch)) {
    reasons.push({
      label: 'Bank ref required',
      detail: 'A transfer reference must be saved before this batch can be marked paid.',
      action: 'Save the bank transfer reference first.',
      pillClass: 'pill-warn',
    });
  }

  if (batch.status === 'PAID' && !batch.transferRef) {
    reasons.push({
      label: 'Paid missing ref',
      detail: 'This paid batch is missing its banking reference for reconciliation.',
      action: 'Add the historical bank reference.',
      pillClass: 'pill-danger',
    });
  }

  if (!earnings.length) {
    reasons.push({
      label: 'No earnings',
      detail: 'The payout batch has no linked earning records.',
      action: 'Attach payable earnings or cancel the batch.',
      pillClass: 'pill-warn',
    });
  }

  if (withholdingAmount > 0 && !withholdingLogs.length) {
    reasons.push({
      label: 'Tax log missing',
      detail: `Withholding exists (${formatMoney(withholdingAmount, batch.currency)}) but no tax log is linked.`,
      action: 'Create or repair withholding logs before reconciliation.',
      pillClass: 'pill-warn',
    });
  }

  if (withholdingLogs.some((log) => log.status !== 'PAID')) {
    reasons.push({
      label: 'Tax open',
      detail: 'One or more withholding logs are not marked paid.',
      action: 'Complete withholding settlement status.',
      pillClass: 'pill-warn',
    });
  }

  if (batch.status === 'PAID' && earnings.some((earning) => earning.status !== 'PAID')) {
    reasons.push({
      label: 'Earning mismatch',
      detail: 'The batch is paid but at least one attached earning is not paid.',
      action: 'Repair earning status so provider ledger matches payout.',
      pillClass: 'pill-danger',
    });
  }

  return reasons;
}

function buildPayoutLanes(batches: AdminPayoutBatch[]): PayoutLane[] {
  return [
    {
      title: 'Blocked by hold',
      batches: batches.filter((batch) => Boolean(activePayoutHold(batch))),
      pillClass: 'pill-danger',
      emptyText: 'No active payout hold in the current payout list.',
    },
    {
      title: 'Failed recovery',
      batches: batches.filter((batch) => batch.status === 'FAILED'),
      pillClass: 'pill-warn',
      emptyText: 'No failed batch needs recovery.',
    },
    {
      title: 'Draft review',
      batches: batches.filter((batch) => batch.status === 'DRAFT' && !activePayoutHold(batch)),
      pillClass: 'pill-warn',
      emptyText: 'No draft batch is waiting for review.',
    },
    {
      title: 'Processing confirmation',
      batches: batches.filter((batch) => batch.status === 'PROCESSING' && !activePayoutHold(batch)),
      pillClass: 'pill-info',
      emptyText: 'No bank transfer is currently in progress.',
    },
    {
      title: 'Paid reconciliation',
      batches: batches.filter((batch) => batch.status === 'PAID'),
      pillClass: 'pill-success',
      emptyText: 'No paid batch is available for reconciliation yet.',
    },
    {
      title: 'Cancelled archive',
      batches: batches.filter((batch) => batch.status === 'CANCELLED'),
      pillClass: 'pill-neutral',
      emptyText: 'No cancelled payout batch is in the current list.',
    },
  ];
}

function batchWithholdingAmount(batch: AdminPayoutBatch) {
  if (batch.withholdingLogs?.length) {
    return batch.withholdingLogs.reduce((sum, log) => sum + log.amount, 0);
  }
  return (batch.earnings ?? []).reduce((sum, earning) => sum + (earning.withholdingAmount ?? 0), 0);
}

function humanizeStatus(status: string) {
  return status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function payoutPhase(status: string) {
  switch (status) {
    case 'DRAFT':
      return 'Waiting for finance review';
    case 'PROCESSING':
      return 'Transfer is in motion';
    case 'PAID':
      return 'Settlement finished';
    case 'FAILED':
      return 'Needs payout recovery';
    case 'CANCELLED':
      return 'Batch was stopped';
    default:
      return 'Monitor this payout batch';
  }
}

function signalClass(status: string) {
  switch (status) {
    case 'PAID':
      return 'signal signal-ok';
    case 'PROCESSING':
      return 'signal signal-info';
    case 'DRAFT':
    case 'FAILED':
      return 'signal signal-warn';
    default:
      return 'signal';
  }
}

function opsSignal(batch: AdminPayoutBatch) {
  if (activePayoutHold(batch)) {
    return 'Payout hold';
  }
  switch (batch.status) {
    case 'DRAFT':
      return 'Needs review';
    case 'PROCESSING':
      return 'Transfer in progress';
    case 'PAID':
      return batch.transferRef ? 'Settled' : 'Settled, missing ref';
    case 'FAILED':
      return 'Retry payout';
    case 'CANCELLED':
      return 'Stopped';
    default:
      return 'Monitor';
  }
}

function opsHint(batch: AdminPayoutBatch) {
  const payoutHold = activePayoutHold(batch);
  if (payoutHold) {
    return `Finance actions are locked until this active sanction is lifted: ${payoutHold.reason}`;
  }
  switch (batch.status) {
    case 'DRAFT':
      return 'Check included earnings, confirm the therapist, and release only if totals look right.';
    case 'PROCESSING':
      return 'Watch for banking confirmation before marking the batch complete.';
    case 'PAID':
      return batch.transferRef
        ? 'Payment already landed. Keep this for reconciliation and support follow-up.'
        : 'Payment is marked paid but still needs a banking transfer reference.';
    case 'FAILED':
      return 'Review transfer notes and retry path before earnings age further.';
    case 'CANCELLED':
      return 'Make sure related earnings are reassigned or rebatched if still payable.';
    default:
      return 'Use this row to understand payout readiness and reconcile provider earnings.';
  }
}

function earningsStatusHint(batch: AdminPayoutBatch) {
  if (!batch.earnings?.length) {
    return 'No earnings attached';
  }
  const payoutLinked = batch.earnings.filter((earning) => earning.payoutBatchId === batch.id).length;
  return `${payoutLinked}/${batch.earnings.length} linked to this batch`;
}

function payoutChecklist(batch: AdminPayoutBatch) {
  const earnings = batch.earnings ?? [];
  const allEarningsPaid = earnings.length > 0 && earnings.every((earning) => earning.status === 'PAID');
  const payoutHold = activePayoutHold(batch);
  const withholdingAmount = batchWithholdingAmount(batch);
  const withholdingLogs = batch.withholdingLogs ?? [];
  const withholdingLogsPaid =
    withholdingAmount <= 0 ||
    (withholdingLogs.length > 0 && withholdingLogs.every((log) => log.status === 'PAID'));
  const transferRefReady = batch.status !== 'PAID' || Boolean(batch.transferRef);
  const paidDateReady = batch.status !== 'PAID' || Boolean(batch.paidAt);
  const earningsAttached = earnings.length > 0;
  return [
    {
      label: payoutHold ? 'Held' : 'No hold',
      ok: !payoutHold,
      detail: payoutHold
        ? `Provider has an active payout hold: ${payoutHold.reason}`
        : 'No active payout hold is attached to this provider.',
    },
    {
      label: earningsAttached ? 'Earnings linked' : 'No earnings',
      ok: earningsAttached,
      detail: earningsAttached
        ? `${earnings.length} earning record(s) are attached to this batch.`
        : 'This payout batch has no earning records attached.',
    },
    {
      label:
        withholdingAmount <= 0
          ? 'No tax due'
          : withholdingLogs.length
            ? withholdingLogsPaid
              ? 'Tax paid'
              : 'Tax open'
            : 'Tax log missing',
      ok: withholdingLogsPaid,
      detail:
        withholdingAmount <= 0
          ? 'No withholding amount is recorded for this batch.'
          : withholdingLogs.length
            ? `${withholdingLogs.length} withholding log(s), ${formatMoney(withholdingAmount, batch.currency)} total.`
            : `Withholding amount exists (${formatMoney(withholdingAmount, batch.currency)}) but no withholding log is linked.`,
    },
    {
      label: batch.transferRef ? 'Bank ref' : batch.status === 'PAID' ? 'No ref' : 'Ref later',
      ok: transferRefReady,
      detail: batch.transferRef
        ? `Bank transfer reference: ${batch.transferRef}`
        : batch.status === 'PAID'
          ? 'Paid batches must keep a bank transfer reference for reconciliation.'
          : 'Bank transfer reference can be added when finance starts or completes the payout.',
    },
    {
      label: allEarningsPaid
        ? 'Earnings paid'
        : batch.status === 'PAID'
          ? 'Earnings open'
          : 'Earnings pending',
      ok: batch.status === 'PAID' ? allEarningsPaid : earningsAttached,
      detail: allEarningsPaid
        ? 'Every attached earning is marked PAID.'
        : batch.status === 'PAID'
          ? 'The payout is PAID, but one or more attached earnings are not marked PAID.'
          : 'Attached earnings will be marked paid when payout settlement is complete.',
    },
    {
      label: batch.paidAt ? 'Paid date' : batch.status === 'PAID' ? 'No paid date' : 'Date later',
      ok: paidDateReady,
      detail: batch.paidAt
        ? `Paid at ${new Date(batch.paidAt).toLocaleString()}.`
        : batch.status === 'PAID'
          ? 'Paid batches need a paid timestamp.'
          : 'Paid timestamp is expected only after settlement.',
    },
  ];
}

function payoutReadinessSummary(batch: AdminPayoutBatch) {
  const failedItems = payoutChecklist(batch).filter((item) => !item.ok);
  if (!failedItems.length) {
    return 'Ready for the current payout phase.';
  }
  return `Check ${failedItems.map((item) => item.label.toLowerCase()).join(', ')} before advancing.`;
}

function activePayoutHold(batch: AdminPayoutBatch) {
  return batch.providerProfile?.sanctions?.find(
    (sanction) => sanction.type === 'PAYOUT_HOLD' && sanction.status === 'ACTIVE',
  );
}

function formatMoney(amount: number, currency: string) {
  return `${new Intl.NumberFormat('vi-VN').format(amount)} ${currency}`;
}

function shortId(value: string) {
  return value.length > 12 ? value.slice(0, 12) : value;
}

function relativeTime(value: string) {
  const diffMs = Date.now() - Date.parse(value);
  if (!Number.isFinite(diffMs)) {
    return 'Unknown time';
  }
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) {
    return 'Updated just now';
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
