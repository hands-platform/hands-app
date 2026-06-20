import Link from 'next/link';

import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';

import {
  partnerOperatorCommandActionHref,
  type PartnerOperatorCommandAction as PartnerOperatorCommandActionConfig,
} from './partner-detail-operator-command-action';

type PartnerOpsTone = 'done' | 'pending' | 'blocked';

export type PartnerOperatorCommand = {
  readonly action: PartnerOperatorCommandActionConfig;
  readonly detail: string;
  readonly id: string;
  readonly label: string;
  readonly owner: string;
  readonly title: string;
  readonly tone: PartnerOpsTone;
};

export type PartnerOperatorCommandMetric = {
  readonly helper: string;
  readonly label: string;
  readonly value: string;
};

export type PartnerOperatorCommandQueue = {
  readonly commands: readonly PartnerOperatorCommand[];
  readonly metrics: readonly PartnerOperatorCommandMetric[];
  readonly status: string;
  readonly tone: PartnerOpsTone;
};

type PartnerDetailOperatorCommandQueueSectionProps = {
  readonly pillClassForTone: (tone: PartnerOpsTone) => string;
  readonly providerId: string;
  readonly queue: PartnerOperatorCommandQueue;
};

const commandQueueHeaders = ['Queue', 'Command', 'Owner', 'Action'];

export function PartnerDetailOperatorCommandQueueSection({
  pillClassForTone,
  providerId,
  queue,
}: PartnerDetailOperatorCommandQueueSectionProps) {
  return (
    <div className="card admin-mb-16" id="partner-operator-command-queue">
      <div className="ops-section-header">
        <div>
          <h2>Partner operator command queue</h2>
          <p className="muted">
            Same-shift partner operations queue for onboarding, direct and marketplace readiness gates,
            payout, location, app reachability, and service setup. This is factual handling for operators.
          </p>
        </div>
        <span className={`pill ${pillClassForTone(queue.tone)}`}>{queue.status}</span>
      </div>
      <div className="service-trace-summary admin-mt-12">
        {queue.metrics.map((metric) => (
          <div key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.helper}</small>
          </div>
        ))}
      </div>
      <div className="admin-mt-16">
        <AdminTableScroll>
          <AdminDataTable
            emptyMessage={<PartnerCommandQueueEmptyState />}
            headers={commandQueueHeaders}
            rowCount={queue.commands.length}
          >
            {queue.commands.map((command) => (
              <tr key={command.id}>
                <td>
                  <span className="muted">{command.label}</span>
                </td>
                <td>
                  <strong>{command.title}</strong>
                  <p className="muted">{command.detail}</p>
                </td>
                <td>
                  <span className={`pill ${pillClassForTone(command.tone)}`}>{command.owner}</span>
                </td>
                <td>
                  <Link className="text-link" href={partnerOperatorCommandActionHref(providerId, command.action)}>
                    {command.action.label}
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

function PartnerCommandQueueEmptyState() {
  return (
    <div className="empty-state">
      <strong>No records found</strong>
      <p className="muted">No same-shift partner command is currently queued.</p>
    </div>
  );
}
