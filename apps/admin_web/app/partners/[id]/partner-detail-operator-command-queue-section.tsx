import Link from 'next/link';

import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import type { StatusBadgeTone } from '../../../components/status-badge';

import {
  partnerOperatorCommandActionHref,
  type PartnerOperatorCommandAction as PartnerOperatorCommandActionConfig,
} from './partner-detail-operator-command-action';
import {
  PartnerDetailVuexyTableFooter,
  partnerDetailReviewCardClassName,
  partnerDetailReviewTableClassName,
} from './partner-detail-vuexy-table';

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
  const primaryCommands = queue.commands.filter((command) => command.action.type !== 'link').slice(0, 4);

  return (
    <AdminFilterPanel
      className={`${partnerDetailReviewCardClassName} admin-mb-16`}
      description="Same-shift approval queue for account holds, KYC, public profile review, and service setup. Settlement, location, and app reachability evidence stays in the dedicated sections below."
      id="partner-operator-command-queue"
      resultLabel={queue.status}
      resultTone={statusBadgeToneForPartnerOps(queue.tone)}
      title="Partner operator command queue"
    >
      <div className="service-trace-summary admin-mt-12">
        {queue.metrics.map((metric) => (
          <div key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.helper}</small>
          </div>
        ))}
      </div>
      {primaryCommands.length > 0 ? (
        <div className="admin-mt-12">
          <div className="participant-list">
            <span className="muted">Primary review actions</span>
            {primaryCommands.map((command) => (
              <Link
                className={`pill ${pillClassForTone(command.tone)}`}
                href={partnerOperatorCommandActionHref(providerId, command.action)}
                key={command.id}
              >
                {command.action.label}
              </Link>
            ))}
          </div>
          <p className="muted admin-mt-8">
            Hold and reject actions open a confirmation step with a required reason for the Partner app and audit
            trail.
          </p>
        </div>
      ) : null}
      <div className="admin-mt-16">
        <AdminTableScroll>
          <AdminDataTable
            className={partnerDetailReviewTableClassName}
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
        <PartnerDetailVuexyTableFooter rowCount={queue.commands.length} />
      </div>
    </AdminFilterPanel>
  );
}

function statusBadgeToneForPartnerOps(tone: PartnerOpsTone): StatusBadgeTone {
  if (tone === 'done') return 'success';
  if (tone === 'pending') return 'warning';
  return 'danger';
}

function PartnerCommandQueueEmptyState() {
  return (
    <div className="empty-state">
      <strong>No records found</strong>
      <p className="muted">No same-shift partner command is currently queued.</p>
    </div>
  );
}
