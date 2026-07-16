import { Edit3, Plus, Save, X } from 'lucide-react';
import type { ReactNode } from 'react';

import {
  AdminDrawerActionFooter,
  AdminDrawerFormGrid,
  AdminFormCheckbox,
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormInput,
  AdminFormTextarea,
} from '../../components/admin-form-controls';
import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminCard, AdminCardGrid, AdminCardHeader, AdminDrawerSurface, AdminSection } from '../../components/admin-surface';
import { MoneyText } from '../../components/money-text';
import { StatusBadge } from '../../components/status-badge';
import type { AdminServiceCatalogItem } from '../../lib/admin-api';
import { serviceBasePayoutRule } from '../../lib/service-base-payout-rule';
import type { ServiceCatalogGroup } from '../../lib/service-catalog-filters';
import { createServiceDurationSet, saveServiceDurationMenu } from './actions';

type ServiceCatalogManagerSectionProps = {
  readonly activeOptionCount: number;
  readonly dialogMode: 'new' | 'edit' | null;
  readonly editGroup: ServiceCatalogGroup | null;
  readonly groups: readonly ServiceCatalogGroup[];
  readonly payoutRuleCount: number;
  readonly totalGroupCount: number;
};

const SERVICE_DURATIONS = [60, 90, 120] as const;
const SERVICE_TRANSLATION_FIELDS = [
  { key: 'en', label: 'English', name: 'nameEn', placeholder: 'Aroma Massage' },
  { key: 'vi', label: 'Vietnamese', name: 'nameVi', placeholder: 'Vietnamese service name' },
  { key: 'ko', label: 'Korean', name: 'nameKo', placeholder: 'Korean service name' },
  { key: 'ja', label: 'Japanese', name: 'nameJa', placeholder: 'Japanese service name' },
  { key: 'zh', label: 'Chinese', name: 'nameZh', placeholder: 'Chinese service name' },
] as const;

export function ServiceCatalogManagerSection({
  activeOptionCount,
  dialogMode,
  editGroup,
  groups,
  payoutRuleCount,
  totalGroupCount,
}: ServiceCatalogManagerSectionProps) {
  return (
    <>
      <AdminSection
        actions={
          <>
            <StatusBadge tone="info">{totalGroupCount} service type(s)</StatusBadge>
            <StatusBadge tone="success">{activeOptionCount} active option(s)</StatusBadge>
            <StatusBadge tone="neutral">{payoutRuleCount} payout rule(s)</StatusBadge>
            <AdminFormControlLink className="button-primary" href={serviceDialogHref('new', null)}>
              <Plus aria-hidden="true" size={16} />
              Add service
            </AdminFormControlLink>
          </>
        }
        className="service-catalog-manager-card"
        description="Register the service menu that Partners can opt into. Customer app partner details only show services selected by that Partner."
        title="Service catalog"
      >

        <div className="service-catalog-toolbar">
          <p className="muted">
            Showing {groups.length} of {totalGroupCount} service type(s). Prices use 100,000 VND steps.
          </p>
        </div>

        <AdminCardGrid ariaLabel="Service menu cards" className="service-menu-card-grid">
          {groups.length ? (
            groups.map((group) => <ServiceCatalogCard group={group} key={group.key} />)
          ) : (
            <AdminEmptyState
              className="service-menu-empty-state"
              framed
              message="Add a new service menu item to make it available for Partners."
              title="No service menu items are registered."
            />
          )}
        </AdminCardGrid>
      </AdminSection>

      {dialogMode === 'new' ? <NewServiceDialog /> : null}
      {dialogMode === 'edit' && editGroup ? <EditServiceDialog group={editGroup} /> : null}
    </>
  );
}

function ServiceCatalogCard({ group }: { readonly group: ServiceCatalogGroup }) {
  const activeCount = group.items.filter((service) => service.active).length;
  const durationSet = new Set(group.items.map((service) => service.durationMin));

  return (
    <AdminCard className="service-menu-card">
      <AdminCardHeader
        actions={
          <AdminFormControlLink
            className="button-secondary service-table-action"
            href={serviceDialogHref('edit', group.key)}
          >
            <Edit3 aria-hidden="true" size={15} />
            Edit
          </AdminFormControlLink>
        }
        title={group.label}
      />

      <div className="service-menu-inline-pills">
        <p className="muted">
          {group.items.length} option(s); Missing{' '}
          {SERVICE_DURATIONS.filter((duration) => !durationSet.has(duration)).join(', ') || 'none'}
        </p>
        <StatusBadge tone={activeCount === group.items.length ? 'success' : activeCount ? 'warning' : 'neutral'}>
          {activeCount ? `${activeCount}/${group.items.length} active` : 'Inactive'}
        </StatusBadge>
      </div>

      <div className="service-menu-duration-grid">
        {group.items.map((service) => (
          <ServiceDurationPanel
            key={service.id}
            service={service}
          />
        ))}
      </div>
    </AdminCard>
  );
}

function ServiceDurationPanel({
  service,
}: {
  readonly service: AdminServiceCatalogItem;
}) {
  const payoutRule = serviceBasePayoutRule(service);

  return (
    <div className="service-menu-duration-row">
      <strong>{service.durationMin} min</strong>
      <span>
        <small>Base</small>
        <MoneyText amount={service.basePrice} />
      </span>
      <span>
        <small>Partner</small>
        <MoneyText amount={payoutRule?.providerPayoutAmount} />
      </span>
    </div>
  );
}

function NewServiceDialog() {
  return (
    <ServiceDialogFrame eyebrow="Service setup" returnHref={servicesReturnHref()} title="Add service menu">
      <AdminDrawerFormGrid action={createServiceDurationSet} className="service-menu-dialog-form">
        <ServiceIdentityFields />
        {SERVICE_DURATIONS.map((duration) => (
          <DurationInputRow duration={duration} key={duration} />
        ))}
        <input name="priceStep" type="hidden" value="100000" />
        <input name="displayOrder" type="hidden" value="100" />
        <input name="vatBps" type="hidden" value="0" />
        <input name="otherCostAmount" type="hidden" value="0" />
        <AdminDrawerActionFooter className="service-menu-dialog-footer">
          <AdminFormControlButton className="button-primary" type="submit">
            <Save aria-hidden="true" size={16} />
            Save service
          </AdminFormControlButton>
          <AdminFormControlLink className="button-secondary" href={servicesReturnHref()}>
            Cancel
          </AdminFormControlLink>
        </AdminDrawerActionFooter>
      </AdminDrawerFormGrid>
    </ServiceDialogFrame>
  );
}

function EditServiceDialog({ group }: { readonly group: ServiceCatalogGroup }) {
  return (
    <ServiceDialogFrame
      eyebrow="Service setup"
      returnHref={servicesReturnHref()}
      title={`Edit ${group.label}`}
    >
      <AdminDrawerFormGrid action={saveServiceDurationMenu} className="service-menu-dialog-form">
        <ServiceIdentityFields group={group} />
        {SERVICE_DURATIONS.map((duration) => {
          const service = group.items.find((item) => item.durationMin === duration);
          return <DurationInputRow duration={duration} key={duration} service={service} />;
        })}
        <AdminDrawerActionFooter className="service-menu-dialog-footer">
          <AdminFormControlButton className="button-primary" type="submit">
            <Save aria-hidden="true" size={16} />
            Save changes
          </AdminFormControlButton>
          <AdminFormControlLink className="button-secondary" href={servicesReturnHref()}>
            Cancel
          </AdminFormControlLink>
        </AdminDrawerActionFooter>
      </AdminDrawerFormGrid>
    </ServiceDialogFrame>
  );
}

function ServiceDialogFrame({
  children,
  eyebrow,
  returnHref,
  title,
}: {
  readonly children: ReactNode;
  readonly eyebrow: string;
  readonly returnHref: string;
  readonly title: string;
}) {
  return (
    <>
      <a aria-label="Close service dialog" className="calendar-drawer-backdrop" href={returnHref} />
      <AdminDrawerSurface
        ariaLabel={title}
        ariaModal
        className="calendar-drawer service-menu-dialog"
        role="dialog"
      >
        <div className="calendar-drawer-header">
          <div>
            <span className="calendar-drawer-eyebrow">{eyebrow}</span>
            <h2>{title}</h2>
          </div>
          <AdminFormControlLink
            aria-label="Close service dialog"
            className="button-secondary calendar-icon-button"
            href={returnHref}
          >
            <X aria-hidden="true" size={16} />
          </AdminFormControlLink>
        </div>
        <div className="calendar-drawer-body">{children}</div>
      </AdminDrawerSurface>
    </>
  );
}

function ServiceIdentityFields({ group }: { readonly group?: ServiceCatalogGroup }) {
  const firstService = group?.items[0];
  const translations = group?.nameTranslations ?? {};

  return (
    <>
      {group ? <input name="serviceGroupKey" type="hidden" value={group.key} /> : null}
      <div className="service-menu-name-grid">
        {SERVICE_TRANSLATION_FIELDS.map((field) => (
          <AdminFormInput
            className="admin-form-control-fluid"
            defaultValue={translations[field.key] ?? (field.key === 'en' ? group?.label : '')}
            key={field.key}
            label={field.label}
            labelVisibility="visible"
            name={field.name}
            placeholder={field.placeholder}
            required={field.key === 'en'}
          />
        ))}
      </div>
      <AdminFormTextarea
        className="admin-form-control-fluid admin-grid-span-2"
        defaultValue={firstService?.description ?? ''}
        label="Description"
        labelVisibility="visible"
        name="description"
        placeholder="Short copy shown in mobile service selection"
        rows={3}
      />
    </>
  );
}

function DurationInputRow({
  duration,
  service,
}: {
  readonly duration: (typeof SERVICE_DURATIONS)[number];
  readonly service?: AdminServiceCatalogItem;
}) {
  const payoutRule = service ? serviceBasePayoutRule(service) : null;

  return (
    <fieldset className="service-menu-duration-form-row">
      <legend className="sr-only">{duration} min option</legend>
      <input name={`serviceId${duration}`} type="hidden" value={service?.id ?? ''} />
      <input name={`ruleId${duration}`} type="hidden" value={payoutRule?.id ?? ''} />
      <input name={`displayOrder${duration}`} type="hidden" value={service?.displayOrder ?? 100 + duration} />
      <div aria-hidden="true" className="service-menu-duration-option-cell">
        {duration} min option
      </div>
      <AdminFormInput
        className="admin-form-control-fluid"
        defaultValue={service?.basePrice ?? ''}
        label="Base price"
        labelVisibility="visible"
        min="100000"
        name={`basePrice${duration}`}
        placeholder="500000"
        step="100000"
        type="number"
      />
      <AdminFormInput
        className="admin-form-control-fluid"
        defaultValue={payoutRule?.providerPayoutAmount ?? ''}
        label="Partner payout"
        labelVisibility="visible"
        min="0"
        name={`providerPayoutAmount${duration}`}
        placeholder="350000"
        step="100000"
        type="number"
      />
      <AdminFormCheckbox
        className="service-menu-enabled-toggle"
        defaultChecked={service?.active ?? Boolean(service)}
        label={`${duration} min option enabled`}
        name={`active${duration}`}
      />
    </fieldset>
  );
}

function serviceDialogHref(mode: 'new' | 'edit', groupKey: string | null) {
  const params = new URLSearchParams();
  params.set('dialog', mode);
  if (groupKey) {
    params.set('group', groupKey);
  }
  return `/services?${params.toString()}`;
}

function servicesReturnHref() {
  return '/services';
}
