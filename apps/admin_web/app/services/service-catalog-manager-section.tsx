import { Edit3, Plus } from 'lucide-react';

import {
  AdminFormControlLink,
} from '../../components/admin-form-controls';
import { AdminEmptyState } from '../../components/admin-empty-state';
import { DateTimeText } from '../../components/date-time-text';
import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminNoticeCard, AdminSection } from '../../components/admin-surface';
import { MoneyText } from '../../components/money-text';
import { StatusBadge } from '../../components/status-badge';
import type {
  AdminAuditLog,
  AdminServiceCatalogAuditEvidence,
  AdminServiceCatalogHealth,
  AdminServiceCatalogImpact,
} from '../../lib/admin-api';
import { serviceBasePayoutRule } from '../../lib/service-base-payout-rule';
import type { ServiceCatalogGroup } from '../../lib/service-catalog-filters';
import { ServiceCatalogEditorForm } from './service-catalog-editor-form';
import { ServiceCatalogDrawerShell } from './service-catalog-drawer-shell';
import { ServiceCatalogRefreshButton } from './service-catalog-refresh-button';

type ServiceCatalogManagerSectionProps = {
  readonly canOpenFullAuditLog?: boolean;
  readonly dataAvailable: boolean;
  readonly dialogMode: 'new' | 'edit' | null;
  readonly editGroup: ServiceCatalogGroup | null;
  readonly evidence?: AdminServiceCatalogAuditEvidence | null;
  readonly evidenceAvailable?: boolean;
  readonly evidenceGroupKey?: string | null;
  readonly impact?: AdminServiceCatalogImpact | null;
  readonly impactAvailable?: boolean;
  readonly invalidEditGroupKey?: string | null;
  readonly groups: readonly ServiceCatalogGroup[];
  readonly health: AdminServiceCatalogHealth | null;
  readonly healthAvailable?: boolean;
};

const SERVICE_DURATIONS = [60, 90, 120] as const;

export function ServiceCatalogManagerSection({
  canOpenFullAuditLog = false,
  dataAvailable,
  dialogMode,
  editGroup,
  evidence,
  evidenceAvailable = true,
  evidenceGroupKey,
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
            <ServiceCatalogRefreshButton />
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
              <HealthFact
                detail={health.anomalyCount ? 'Published options blocked or ambiguous' : 'Customer app projection healthy'}
                label="Public anomalies"
                priority="primary"
                tone={health.anomalyCount ? 'danger' : 'neutral'}
                value={health.anomalyCount}
              />
              <HealthFact
                detail="Unpublished operator changes"
                label="Working drafts"
                priority="primary"
                tone={health.workingDraftCount ? 'warning' : 'neutral'}
                value={health.workingDraftCount}
              />
              <HealthFact
                detail={health.lastPublishedAt ? formatPublishedTime(health.lastPublishedAt) : 'No publisher timestamp'}
                label="Last published"
                priority="primary"
                value={health.lastPublishedByLabel}
                valueKind="evidence"
              />
              <HealthFact detail={`${health.liveOptionCount} app-visible duration options`} label="Live service groups" priority="secondary" tone="success" value={health.liveGroupCount} />
              <HealthFact
                detail={`${health.historicalPayoutRuleCount} historical · ${health.blockedOptionCount} blocked options`}
                label="Current payout rules"
                priority="secondary"
                tone={health.blockedOptionCount ? 'danger' : 'success'}
                value={health.currentPayoutRuleCount}
              />
              <HealthFact
                detail={`of ${health.liveGroupCount} live service groups`}
                label="Live EN + VI ready"
                priority="secondary"
                tone={health.liveEnViReadyGroupCount === health.liveGroupCount ? 'success' : 'warning'}
                value={health.liveEnViReadyGroupCount}
              />
            </dl>
            <p className="muted service-catalog-health-checked">
              Public projection checked {formatPublishedTime(health.checkedAt)}.
              {health.auditTarget ? (
                <AdminFormControlLink
                  className="text-link"
                  href={canOpenFullAuditLog
                    ? `/audit-log?target=${encodeURIComponent(health.auditTarget)}`
                    : `/services?evidence=${encodeURIComponent(health.lastPublishedGroupKey ?? '')}`}
                >
                  {canOpenFullAuditLog ? 'View last publish audit' : 'View last publish evidence'}
                </AdminFormControlLink>
              ) : null}
            </p>
          </>
        )}

        {evidenceGroupKey ? (
          <ServiceCatalogEvidencePanel
            canOpenFullAuditLog={canOpenFullAuditLog}
            evidence={evidence}
            evidenceAvailable={evidenceAvailable}
            groupKey={evidenceGroupKey}
          />
        ) : null}

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
        <ServiceCatalogDrawerShell
          returnFocusHref="/services?dialog=new"
          returnHref="/services"
          title="Add service group"
        >
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

function ServiceCatalogEvidencePanel({
  canOpenFullAuditLog,
  evidence,
  evidenceAvailable,
  groupKey,
}: {
  readonly canOpenFullAuditLog: boolean;
  readonly evidence: AdminServiceCatalogAuditEvidence | null | undefined;
  readonly evidenceAvailable: boolean;
  readonly groupKey: string;
}) {
  return (
    <section aria-labelledby="service-catalog-evidence-title" className="service-catalog-evidence">
      <div className="service-catalog-evidence-heading">
        <div>
          <h3 id="service-catalog-evidence-title">Service change evidence</h3>
          <p>Only service catalog actions retained for <code>{groupKey}</code> are shown.</p>
        </div>
        <AdminFormControlLink className="button-secondary" href="/services">
          Close evidence
        </AdminFormControlLink>
      </div>
      {!evidenceAvailable || !evidence ? (
        <AdminNoticeCard role="alert" tone="danger">
          Scoped service evidence could not be loaded. No full audit access was assumed.
        </AdminNoticeCard>
      ) : evidence.items.length ? (
        <ol className="service-catalog-evidence-list">
          {evidence.items.map((item) => (
            <li key={item.id}>
              <div>
                <strong>{serviceCatalogAuditActionLabel(item.action)}</strong>
                <span>{serviceCatalogAuditActor(item)}</span>
              </div>
              <DateTimeText fallback="Evidence time unavailable" value={item.createdAt} />
              <code>{item.id}</code>
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted">No retained service catalog actions were found for this group.</p>
      )}
      {canOpenFullAuditLog && evidence ? (
        <AdminFormControlLink
          className="text-link"
          href={`/audit-log?target=${encodeURIComponent(evidence.target)}`}
        >
          Open full audit log
        </AdminFormControlLink>
      ) : null}
    </section>
  );
}

function serviceCatalogAuditActor(item: AdminAuditLog) {
  return item.actor?.fullName?.trim() || item.actor?.email?.trim() || 'Legacy/seed actor not recorded';
}

function serviceCatalogAuditActionLabel(action: string) {
  if (action === 'service_catalog.published') return 'Published';
  if (action === 'service_catalog.hide') return 'Hidden from apps';
  if (action === 'service_catalog.archive') return 'Archived';
  if (action === 'service_catalog.draft_saved') return 'Draft saved';
  return 'Service catalog action';
}

function HealthFact({
  detail,
  label,
  priority = 'secondary',
  tone = 'neutral',
  value,
  valueKind = 'metric',
}: {
  readonly detail: string;
  readonly label: string;
  readonly priority?: 'primary' | 'secondary';
  readonly tone?: 'neutral' | 'success' | 'warning' | 'danger';
  readonly value: number | string;
  readonly valueKind?: 'metric' | 'evidence';
}) {
  return (
    <div className={`service-catalog-health-fact is-${priority} is-${tone} is-value-${valueKind}`}>
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
