import Link from 'next/link';

import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';

export type PartnerOpsTone = 'blocked' | 'done' | 'pending';

export type PartnerReadinessSnapshotBadge = {
  readonly detail: string;
  readonly label: string;
  readonly tone: PartnerOpsTone;
};

export type PartnerReadinessSnapshotView = {
  readonly badges: readonly PartnerReadinessSnapshotBadge[];
  readonly gate: {
    readonly detail: string;
    readonly helper: string;
    readonly label: string;
    readonly title: string;
  };
  readonly status: string;
  readonly tone: PartnerOpsTone;
};

export type PartnerAcceptanceRepairCommandView = {
  readonly customerImpact: string;
  readonly marketplaceRouting: string;
  readonly operatorDecision: string;
  readonly partnerAppMessage: string;
  readonly status: string;
  readonly steps: readonly PartnerAcceptanceRepairStep[];
  readonly tone: PartnerOpsTone;
};

type PartnerAcceptanceRepairStep = {
  readonly actionLabel: string;
  readonly blocker: string;
  readonly href: string;
  readonly operatorAction: string;
  readonly owner: string;
  readonly reason: string;
  readonly tone: PartnerOpsTone;
};

type PartnerDetailReadinessSnapshotSectionProps = {
  readonly snapshot: PartnerReadinessSnapshotView;
};

type PartnerAcceptanceRepairCommandSectionProps = {
  readonly command: PartnerAcceptanceRepairCommandView;
};

const readinessGateHeaders = ['Gate', 'Readiness', 'Operator helper'];
const repairCommandHeaders = ['Step', 'Owner / blocker', 'Reason', 'Operator action', 'Status', 'Action'];

export function PartnerDetailReadinessSnapshotSection({
  snapshot,
}: PartnerDetailReadinessSnapshotSectionProps) {
  return (
    <div className="card admin-mb-16">
      <div className="ops-section-header">
        <div>
          <h2>Partner readiness snapshot</h2>
          <p className="muted">
            Fast operating checks for dispatch, marketplace matching, cash settlement, KYC, payout, and
            service readiness.
          </p>
        </div>
        <span className={`pill ${pillClassForTone(snapshot.tone)}`}>{snapshot.status}</span>
      </div>
      <div className="participant-list admin-mt-12">
        {snapshot.badges.map((badge) => (
          <span className={`pill ${pillClassForTone(badge.tone)}`} key={badge.label} title={badge.detail}>
            {badge.label}
          </span>
        ))}
      </div>
      <div className="admin-mt-16">
        <AdminTableScroll>
          <AdminDataTable
            emptyMessage={<PartnerReadinessEmptyState message="No readiness gate loaded." />}
            headers={readinessGateHeaders}
            rowCount={1}
          >
            <tr>
              <td>
                <span className={`pill ${pillClassForTone(snapshot.tone)}`}>{snapshot.gate.label}</span>
              </td>
              <td>
                <strong>{snapshot.gate.title}</strong>
                <p className="muted">{snapshot.gate.detail}</p>
              </td>
              <td>
                <span className="muted">{snapshot.gate.helper}</span>
              </td>
            </tr>
          </AdminDataTable>
        </AdminTableScroll>
      </div>
    </div>
  );
}

export function PartnerAcceptanceRepairCommandSection({
  command,
}: PartnerAcceptanceRepairCommandSectionProps) {
  return (
    <div className={`card ${cardClassForTone(command.tone)} admin-mb-16`}>
      <div className="ops-section-header">
        <div>
          <h2>Marketplace repair command</h2>
          <p className="muted">
            Exact operator diagnosis for marketplace participation, customer handoff, app message, and finance
            repair.
          </p>
        </div>
        <span className={`pill ${pillClassForTone(command.tone)}`}>{command.status}</span>
      </div>
      <div className="service-trace-summary admin-mt-12">
        <TraceSummaryItem
          helper="What support should expect the partner to see."
          label="Partner app block message"
          value={command.partnerAppMessage}
        />
        <TraceSummaryItem
          helper="How this affects customer choice and matching."
          label="Customer impact"
          value={command.customerImpact}
        />
        <TraceSummaryItem
          helper="Use this before manual override or dispatch."
          label="Operator decision"
          value={command.operatorDecision}
        />
        <TraceSummaryItem
          helper="Where live demand should go while blocked."
          label="Marketplace routing"
          value={command.marketplaceRouting}
        />
      </div>
      <div className="admin-mt-16">
        <AdminTableScroll>
          <AdminDataTable
            emptyMessage={<PartnerReadinessEmptyState message="No repair command steps loaded." />}
            headers={repairCommandHeaders}
            rowCount={command.steps.length}
          >
            {command.steps.map((step, index) => (
              <tr key={`${step.owner}-${step.blocker}`}>
                <td>
                  <span className="muted">{index + 1}</span>
                </td>
                <td>
                  <strong>
                    {step.owner}: {step.blocker}
                  </strong>
                </td>
                <td>
                  <p className="muted">{step.reason}</p>
                </td>
                <td>
                  <p className="muted">{step.operatorAction}</p>
                </td>
                <td>
                  <span className={`pill ${pillClassForTone(step.tone)}`}>{stepToneLabel(step.tone)}</span>
                </td>
                <td>
                  <Link className="text-link" href={step.href}>
                    {step.actionLabel}
                  </Link>
                </td>
              </tr>
            ))}
          </AdminDataTable>
        </AdminTableScroll>
      </div>
    </div>
  );
}

function TraceSummaryItem({
  helper,
  label,
  value,
}: {
  readonly helper: string;
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{helper}</small>
    </div>
  );
}

function PartnerReadinessEmptyState({ message }: { readonly message: string }) {
  return (
    <div className="empty-state">
      <strong>No records found</strong>
      <p className="muted">{message}</p>
    </div>
  );
}

function stepToneLabel(tone: PartnerOpsTone) {
  if (tone === 'done') {
    return 'Clear';
  }
  if (tone === 'blocked') {
    return 'Blocks booking';
  }
  return 'Operator check';
}

function pillClassForTone(tone: PartnerOpsTone) {
  if (tone === 'done') {
    return 'pill-success';
  }
  if (tone === 'blocked') {
    return 'pill-danger';
  }
  return 'pill-warn';
}

function cardClassForTone(tone: PartnerOpsTone) {
  if (tone === 'done') {
    return 'ops-task-done';
  }
  if (tone === 'blocked') {
    return 'ops-task-blocked';
  }
  return 'ops-task-pending';
}
