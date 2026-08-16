import { Edit3, Plus, RefreshCw } from 'lucide-react';

import {
  AdminFormControlLink,
} from '../../components/admin-form-controls';
import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminNoticeCard, AdminSection } from '../../components/admin-surface';
import { MoneyText } from '../../components/money-text';
import { StatusBadge } from '../../components/status-badge';
import type { AdminServiceCatalogHealth, AdminServiceCatalogImpact } from '../../lib/admin-api';
import { serviceBasePayoutRule } from '../../lib/service-base-payout-rule';
import type { ServiceCatalogGroup } from '../../lib/service-catalog-filters';
import { ServiceCatalogEditorForm } from './service-catalog-editor-form';
import { ServiceCatalogDrawerShell } from './service-catalog-drawer-shell';

type ServiceCatalogManagerSectionProps = {
  readonly dataAvailable: boolean;
  readonly dialogMode: 'new' | 'edit' | null;
  readonly editGroup: ServiceCatalogGroup | null;
  readonly impact?: AdminServiceCatalogImpact | null;
  readonly impactAvailable?: boolean;
  readonly invalidEditGroupKey?: string | null;
  readonly groups: readonly ServiceCatalogGroup[];
  readonly health: AdminServiceCatalogHealth | null;
  readonly healthAvailable?: boolean;
};

const SERVICE_DURATIONS = [60, 90, 120] as const;

export function ServiceCatalogManagerSection({
  dataAvailable,
  dialogMode,
  editGroup,
  impact,
  impactAvailable = true,
  invalidEditGroupKey,
  groups,
  health,
  healthAvailable = true,
}: ServiceCatalogManagerSectionProps) {
  return (
    <>
      <AdminSection
        actions={
          <>
            <AdminFormControlLink className="button-secondary" href="/services">
              <RefreshCw aria-hidden="true" size={16} />
              Refresh
            </AdminFormControlLink>
            <AdminFormControlLink className="button-primary" href={serviceDialogHref('new', null)}>
              <Plus aria-hidden="true" size={16} />
              Add service
            </AdminFormControlLink>
          </>
        }
        className="service-catalog-manager-card"
        description="Draft safely, compare customer price with Partner payout, then publish all duration changes together."
        title="Catalog control"
      >
        {!dataAvailable ? (
          <AdminNoticeCard role="alert" tone="danger">
            Service catalog data could not be loaded. Refresh before changing app-visible services or payouts.
          </AdminNoticeCard>
        ) : null}

        {dialogMode === 'edit' && invalidEditGroupKey ? (
          <AdminNoticeCard className="service-catalog-not-found" role="alert" tone="danger">
            <strong>Service group not found.</strong>
            <span>The requested group is not part of the operational catalog.</span>
            <AdminFormControlLink className="button-secondary" href="/services">
              Back to catalog
            </AdminFormControlLink>
          </AdminNoticeCard>
        ) : null}

        {!healthAvailable || !health ? (
          <AdminNoticeCard role="alert" tone="danger">
            Public catalog health could not be checked. Refresh before treating any service as live in the apps.
          </AdminNoticeCard>
        ) : (
          <>
            {health.status === 'degraded' ? (
              <AdminNoticeCard role="alert" tone="danger">
                {health.blockedOptionCount} published option(s) are blocked from the public catalog. Review payout and publication readiness before the next release.
              </AdminNoticeCard>
            ) : null}
            <dl aria-label="Live public catalog health" className="service-catalog-health-strip">
              <HealthFact detail={`${health.liveOptionCount} app-visible duration options`} label="Live service groups" tone="success" value={health.liveGroupCount} />
              <HealthFact
                detail={`${health.historicalPayoutRuleCount} historical · ${health.blockedOptionCount} blocked options`}
                label="Current payout rules"
                tone={health.blockedOptionCount ? 'danger' : 'success'}
                value={health.currentPayoutRuleCount}
              />
              <HealthFact
                detail={`of ${health.liveGroupCount} live service groups`}
                label="Live EN + VI ready"
                tone={health.liveEnViReadyGroupCount === health.liveGroupCount ? 'success' : 'warning'}
                value={health.liveEnViReadyGroupCount}
              />
              <HealthFact
                detail={health.anomalyCount ? 'Published options blocked or ambiguous' : 'Customer app projection healthy'}
                label="Public anomalies"
                tone={health.anomalyCount ? 'danger' : 'success'}
                value={health.anomalyCount}
              />
              <HealthFact detail="Unpublished operator changes" label="Working drafts" tone={health.workingDraftCount ? 'warning' : 'neutral'} value={health.workingDraftCount} />
              <HealthFact
                detail={health.lastPublishedAt ? formatPublishedTime(health.lastPublishedAt) : 'No publisher timestamp'}
                label="Last published"
                value={health.lastPublishedById ?? 'Unknown actor'}
              />
            </dl>
            <p className="muted service-catalog-health-checked">
              Public projection checked {formatPublishedTime(health.checkedAt)}.
              {health.auditTarget ? (
                <AdminFormControlLink
                  className="text-link"
                  href={`/audit-log?target=${encodeURIComponent(health.auditTarget)}`}
                >
                  View last publish audit
                </AdminFormControlLink>
              ) : null}
            </p>
          </>
        )}

        {groups.length ? (
          <AdminTableScroll ariaLabel="Service catalog comparison table" className="service-catalog-table-scroll">
            <AdminDataTable
              className="service-catalog-table"
              emptyMessage={null}
              headers={[
                'Service',
                'Live in apps',
                'Working draft',
                'Live localization',
                ...SERVICE_DURATIONS.map((duration) => `${duration} min`),
                'Action',
              ]}
              rowCount={groups.length}
            >
              {groups.map((group) => <ServiceCatalogRow group={group} key={group.key} />)}
            </AdminDataTable>
          </AdminTableScroll>
        ) : dataAvailable ? (
          <AdminEmptyState
            className="service-menu-empty-state"
            framed
            message="Save a draft first, then publish it after EN, VI, customer price, and Partner payout are ready."
            title="No operational service groups are registered."
          />
        ) : null}
      </AdminSection>

      {dialogMode === 'new' ? (
        <ServiceCatalogDrawerShell returnHref="/services" title="Add service group">
          <ServiceCatalogEditorForm />
        </ServiceCatalogDrawerShell>
      ) : null}
      {dialogMode === 'edit' && editGroup ? (
        <ServiceCatalogDrawerShell
          returnFocusHref={serviceDialogHref('edit', editGroup.key)}
          returnHref="/services"
          title={`Edit ${editGroup.label}`}
        >
          <ServiceCatalogEditorForm group={editGroup} impact={impact} impactAvailable={impactAvailable} />
        </ServiceCatalogDrawerShell>
      ) : null}
    </>
  );
}

function HealthFact({
  detail,
  label,
  tone = 'neutral',
  value,
}: {
  readonly detail: string;
  readonly label: string;
  readonly tone?: 'neutral' | 'success' | 'warning' | 'danger';
  readonly value: number | string;
}) {
  return (
    <div className={`service-catalog-health-fact is-${tone}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
      <small>{detail}</small>
    </div>
  );
}

function ServiceCatalogRow({ group }: { readonly group: ServiceCatalogGroup }) {
  const state = serviceGroupState(group);
  const translations = group.nameTranslations ?? {};
  const localizationReady = Boolean(translations.en && translations.vi);
  const draft = serviceGroupDraftState(group);
  return (
    <tr>
      <th className="service-catalog-identity-cell" scope="row">
        <div className="service-catalog-cell-stack">
          <strong>{group.label}</strong>
          <small>{group.key}</small>
        </div>
      </th>
      <td>
        <div className="service-catalog-cell-stack">
          <StatusBadge tone={state.tone}>{state.label}</StatusBadge>
          <small>{state.label === 'Published' ? 'Customer & Partner apps' : 'Not app-visible'}</small>
        </div>
      </td>
      <td>
        <div className="service-catalog-cell-stack">
          <StatusBadge tone={draft.tone}>{draft.label}</StatusBadge>
          {group.draft ? <small>Version {group.draft.version}</small> : <small>No unpublished changes</small>}
        </div>
      </td>
      <td>
        <div className="service-catalog-cell-stack">
          <StatusBadge tone={localizationReady ? 'success' : 'warning'}>
          {localizationReady ? 'EN + VI ready' : 'Live translation gap'}
          </StatusBadge>
        </div>
      </td>
      {SERVICE_DURATIONS.map((duration) => {
        const option = group.items.find((item) => item.durationMin === duration);
        return <ServiceDurationCell key={duration} option={option} />;
      })}
      <td>
        <AdminFormControlLink
          aria-label={`Edit ${group.label}`}
          className="button-secondary service-table-action"
          href={serviceDialogHref('edit', group.key)}
        >
          <Edit3 aria-hidden="true" size={15} />
          Edit
        </AdminFormControlLink>
      </td>
    </tr>
  );
}

function ServiceDurationCell({ option }: { readonly option?: ServiceCatalogGroup['items'][number] }) {
  if (!option) return <td><span className="muted">Not configured</span></td>;
  const payout = serviceBasePayoutRule(option);
  return (
    <td className="service-catalog-price-cell">
      <div className="service-catalog-cell-stack service-catalog-price-cell-content">
        <StatusBadge tone={option.active ? 'success' : 'neutral'}>{option.active ? 'Enabled' : 'Disabled'}</StatusBadge>
        <span><small>Customer</small><MoneyText amount={option.basePrice} /></span>
        <span><small>Partner</small><MoneyText amount={payout?.providerPayoutAmount} /></span>
        <span><small>Gross fee</small><MoneyText amount={payout ? option.basePrice - payout.providerPayoutAmount : undefined} /></span>
      </div>
    </td>
  );
}

function serviceGroupState(group: ServiceCatalogGroup) {
  if (!group.items.length) return { label: 'Draft', tone: 'warning' as const };
  const statuses = new Set(group.items.map((item) => item.publicationStatus ?? 'DRAFT'));
  if (statuses.size > 1) return { label: 'Invalid mixed state', tone: 'danger' as const };
  const status = [...statuses][0];
  if (status === 'PUBLISHED') return { label: 'Published', tone: 'success' as const };
  if (status === 'HIDDEN') return { label: 'Hidden', tone: 'warning' as const };
  if (status === 'ARCHIVED') return { label: 'Archived', tone: 'neutral' as const };
  return { label: 'Draft', tone: 'warning' as const };
}

function serviceGroupDraftState(group: ServiceCatalogGroup) {
  if (!group.draft) return { label: 'No draft', tone: 'neutral' as const };
  const publishedVersion = Math.max(...group.items.map((item) => item.catalogVersion ?? 0), 0);
  return group.draft.version > publishedVersion
    ? { label: 'Changes waiting', tone: 'warning' as const }
    : { label: 'Published snapshot', tone: 'neutral' as const };
}

function serviceDialogHref(mode: 'new' | 'edit', groupKey: string | null) {
  const params = new URLSearchParams();
  params.set('dialog', mode);
  if (groupKey) params.set('group', groupKey);
  return `/services?${params.toString()}`;
}

function formatPublishedTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Timestamp unavailable'
    : new Intl.DateTimeFormat('en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Ho_Chi_Minh',
      }).format(date);
}
