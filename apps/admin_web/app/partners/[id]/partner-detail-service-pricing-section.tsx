import type { ReactNode } from 'react';

import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { AdminEmptyState } from '../../../components/admin-empty-state';
import { AdminFilterChipGroup } from '../../../components/admin-filter-chip-group';
import { AdminTraceSummary } from '../../../components/admin-overview-card';
import { StatusBadge } from '../../../components/status-badge';
import { marketplaceDisplayText } from '../../../lib/admin-copy';
import {
  PartnerDetailVuexyTableFooter,
  PartnerDetailVuexyTablePanel,
  partnerDetailReviewTableClassName,
} from './partner-detail-vuexy-table';

export type PartnerServicePricingDisplayRow = {
  readonly bookable: boolean;
  readonly durationLabel: string;
  readonly id: string;
  readonly issue: string;
  readonly name: string;
  readonly payoutRuleLabel: string;
  readonly priceLine: ReactNode;
};

type PartnerDetailServicePricingSectionProps = {
  readonly readyCount: number;
  readonly rows: readonly PartnerServicePricingDisplayRow[];
};

export function PartnerDetailServicePricingSection({
  readyCount,
  rows,
}: PartnerDetailServicePricingSectionProps) {
  const hiddenCount = rows.length - readyCount;
  const firstHiddenRow = rows.find((row) => !row.bookable);
  const customerVisibility = readyCount
    ? `${readyCount} customer-visible option(s)`
    : 'No customer-visible option';
  const approvalGate = readyCount ? 'Approval clear' : rows.length ? 'Fix before approval' : 'Add service pricing';
  const nextFix = firstHiddenRow
    ? `${firstHiddenRow.name}: ${marketplaceDisplayText(firstHiddenRow.issue)}`
    : readyCount
      ? 'Service pricing can proceed to final Partner approval.'
      : 'Create an active service duration and matching payout rule.';

  return (
    <PartnerDetailVuexyTablePanel
      description="Customer apps only show options with an active partner service and an exact active payout rule."
      id="service-pricing"
      resultLabel={`${readyCount}/${rows.length} bookable`}
      resultTone={readyCount ? 'success' : 'warning'}
      title="Service price readiness"
    >
      <AdminTraceSummary
        ariaLabel="Service pricing approval gate"
        className="admin-mt-12"
        metrics={[
          {
            detail: `${hiddenCount} hidden option(s).`,
            label: 'Customer visibility',
            value: customerVisibility,
          },
          {
            detail: 'Approval requires at least one customer-visible service option.',
            label: 'Approval gate',
            value: approvalGate,
          },
          {
            detail: 'Use the row issue before approving this Partner.',
            label: 'Next fix',
            value: nextFix,
          },
        ]}
      />
      <AdminTableScroll>
        <AdminDataTable
          className={partnerDetailReviewTableClassName}
          emptyMessage={<ServicePricingEmptyState />}
          headers={servicePricingHeaders}
          rowCount={rows.length}
        >
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <strong>{row.name}</strong>
                <AdminFilterChipGroup ariaLabel={`${row.name} pricing status`} className="admin-mt-6">
                  <StatusBadge tone="info">{row.durationLabel}</StatusBadge>
                  <StatusBadge tone="info">{row.payoutRuleLabel}</StatusBadge>
                </AdminFilterChipGroup>
              </td>
              <td>
                <strong>{row.priceLine}</strong>
              </td>
              <td>
                <StatusBadge tone={row.bookable ? 'success' : 'warning'}>
                  {row.bookable ? 'CUSTOMER VISIBLE' : 'HIDDEN'}
                </StatusBadge>
              </td>
              <td>
                <span className="muted">{marketplaceDisplayText(row.issue)}</span>
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
      <PartnerDetailVuexyTableFooter rowCount={rows.length} />
    </PartnerDetailVuexyTablePanel>
  );
}

const servicePricingHeaders = ['Service', 'Pricing', 'Visibility', 'Issue'] as const;

function ServicePricingEmptyState() {
  return (
    <AdminEmptyState
      message="No partner service prices are connected yet."
      title="No service pricing found"
    />
  );
}
