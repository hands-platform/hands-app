import Link from 'next/link';

import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { AdminEmptyState } from '../../../components/admin-empty-state';
import { AdminFilterChipGroup } from '../../../components/admin-filter-chip-group';
import { AdminTraceSummary } from '../../../components/admin-overview-card';
import { AdminTextLink } from '../../../components/admin-text-link';
import { StatusBadgeFromPillClass, StatusBadgeLinkFromPillClass } from '../../../components/status-badge';

import {
  partnerOperatorCommandActionHref,
  type PartnerOperatorCommandAction as PartnerOperatorCommandActionConfig,
} from './partner-detail-operator-command-action';
import {
  PartnerDetailVuexyTableFooter,
  PartnerDetailVuexyTablePanel,
  partnerDetailReviewTableClassName,
} from './partner-detail-vuexy-table';
import { partnerOpsStatusBadgeTone, type PartnerOpsTone } from './partner-detail-tone';

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
  const nextCommand = primaryCommands[0] ?? queue.commands[0];
  const shortcutCommands = primaryCommands.filter((command) => command.id !== nextCommand?.id);

  return (
    <PartnerDetailVuexyTablePanel
      className="admin-mb-16"
      description="Same-shift approval queue for account holds, KYC, public profile review, and service setup. Settlement, location, and app reachability evidence stays in the dedicated sections below."
      id="partner-operator-command-queue"
      resultLabel={queue.status}
      resultTone={partnerOpsStatusBadgeTone(queue.tone)}
      title="Partner operator command queue"
    >
      <AdminTraceSummary
        className="admin-mt-12"
        metrics={queue.metrics.map((metric) => ({
          detail: metric.helper,
          label: metric.label,
          value: metric.value,
        }))}
      />
      {nextCommand ? (
        <div className={`partner-command-decision-bar is-${nextCommand.tone}`}>
          <div className="partner-command-decision-copy">
            <span>Next decision</span>
            <strong>{nextCommand.action.label}</strong>
            <small>
              {nextCommand.title} / {nextCommand.owner}
            </small>
            <p className="muted">{nextCommand.detail}</p>
          </div>
          <div className="partner-command-decision-actions">
            <Link
              className={`partner-command-decision-button is-${nextCommand.tone}`}
              href={partnerOperatorCommandActionHref(providerId, nextCommand.action)}
            >
              {nextCommand.action.label}
            </Link>
            <a className="partner-command-decision-link" href="#partner-approval-evidence-summary">
              Review evidence
            </a>
          </div>
        </div>
      ) : null}
      {shortcutCommands.length > 0 ? (
        <div className="partner-command-shortcuts admin-mt-12">
          <AdminFilterChipGroup ariaLabel="Partner command decision shortcuts">
            <span className="muted">Decision shortcuts</span>
            {shortcutCommands.map((command) => (
              <StatusBadgeLinkFromPillClass
                href={partnerOperatorCommandActionHref(providerId, command.action)}
                key={command.id}
                pillClass={pillClassForTone(command.tone)}
              >
                {command.action.label}
              </StatusBadgeLinkFromPillClass>
            ))}
          </AdminFilterChipGroup>
          <p className="muted admin-mt-8">
            Hold and reject actions open a confirmation step with a required reason for the Partner app and audit trail.
          </p>
        </div>
      ) : null}
      <div className="admin-mt-16">
        <AdminTableScroll>
          <AdminDataTable
            className={partnerDetailReviewTableClassName}
            emptyMessage={<AdminEmptyState framed message="No same-shift partner command is currently queued." />}
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
                  <StatusBadgeFromPillClass pillClass={pillClassForTone(command.tone)}>
                    {command.owner}
                  </StatusBadgeFromPillClass>
                </td>
                <td>
                  <AdminTextLink href={partnerOperatorCommandActionHref(providerId, command.action)}>
                    {command.action.label}
                  </AdminTextLink>
                </td>
              </tr>
            ))}
          </AdminDataTable>
        </AdminTableScroll>
        <PartnerDetailVuexyTableFooter rowCount={queue.commands.length} />
      </div>
    </PartnerDetailVuexyTablePanel>
  );
}
