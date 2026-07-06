import type { ReactNode } from 'react';

import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { AdminEmptyState } from '../../../components/admin-empty-state';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import { AdminTraceSummary } from '../../../components/admin-overview-card';
import { AdminTextLink } from '../../../components/admin-text-link';
import { StatusBadge, statusBadgeToneFromPillClass } from '../../../components/status-badge';

import {
  PartnerDetailVuexyTableFooter,
  partnerDetailReviewCardClassName,
  partnerDetailReviewTableClassName,
} from './partner-detail-vuexy-table';
import {
  partnerOpsCardClass,
  partnerOpsPillClass,
  partnerOpsStatusBadgeTone,
  partnerOpsStepLabel,
  type PartnerOpsTone,
} from './partner-detail-tone';

export type { PartnerOpsTone };

export type PartnerReadinessSnapshotBadge = {
  readonly detail: string;
  readonly detailNode?: ReactNode;
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
    <AdminFilterPanel
      className={`${partnerDetailReviewCardClassName} admin-mb-16`}
      description="Fast active-work checks for direct first-pick, marketplace matching, KYC, service pricing, location, and app reachability. Wallet evidence stays in finance sections."
      resultLabel={snapshot.status}
      resultTone={partnerOpsStatusBadgeTone(snapshot.tone)}
      title="Partner readiness snapshot"
    >
      <div className="participant-list admin-mt-12">
        {snapshot.badges.map((badge) => (
          <StatusBadge
            key={badge.label}
            title={badge.detail}
            tone={statusBadgeToneFromPillClass(partnerOpsPillClass(badge.tone))}
          >
            {badge.label}
            {badge.detailNode ? <span className="sr-only">{badge.detailNode}</span> : null}
          </StatusBadge>
        ))}
      </div>
      <div className="admin-mt-16">
        <AdminTableScroll>
          <AdminDataTable
            className={partnerDetailReviewTableClassName}
            emptyMessage={<AdminEmptyState framed message="No readiness gate loaded." />}
            headers={readinessGateHeaders}
            rowCount={1}
          >
            <tr>
              <td>
                <StatusBadge tone={statusBadgeToneFromPillClass(partnerOpsPillClass(snapshot.tone))}>
                  {snapshot.gate.label}
                </StatusBadge>
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
        <PartnerDetailVuexyTableFooter rowCount={1} />
      </div>
    </AdminFilterPanel>
  );
}

export function PartnerAcceptanceRepairCommandSection({
  command,
}: PartnerAcceptanceRepairCommandSectionProps) {
  return (
    <AdminFilterPanel
      className={`${partnerDetailReviewCardClassName} ${partnerOpsCardClass(command.tone)} admin-mb-16`}
      description="Exact operator diagnosis for dispatch participation, customer handoff, app message, and finance repair."
      resultLabel={command.status}
      resultTone={partnerOpsStatusBadgeTone(command.tone)}
      title="Dispatch repair command"
    >
      <AdminTraceSummary
        className="admin-mt-12"
        metrics={[
          {
            detail: 'What support should expect the partner to see.',
            label: 'Partner app message',
            value: command.partnerAppMessage,
          },
          {
            detail: 'How this affects customer choice and matching.',
            label: 'Customer impact',
            value: command.customerImpact,
          },
          {
            detail: 'Use this before manual override or dispatch.',
            label: 'Operator decision',
            value: command.operatorDecision,
          },
          {
            detail: 'Where live demand should go while blocked.',
            label: 'Marketplace routing',
            value: command.marketplaceRouting,
          },
        ]}
      />
      <div className="admin-mt-16">
        <AdminTableScroll>
          <AdminDataTable
            className={partnerDetailReviewTableClassName}
            emptyMessage={<AdminEmptyState framed message="No repair command steps loaded." />}
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
                  <StatusBadge tone={statusBadgeToneFromPillClass(partnerOpsPillClass(step.tone))}>
                    {partnerOpsStepLabel(step.tone)}
                  </StatusBadge>
                </td>
                <td>
                  <AdminTextLink href={step.href}>
                    {step.actionLabel}
                  </AdminTextLink>
                </td>
              </tr>
            ))}
          </AdminDataTable>
        </AdminTableScroll>
        <PartnerDetailVuexyTableFooter rowCount={command.steps.length} />
      </div>
    </AdminFilterPanel>
  );
}
