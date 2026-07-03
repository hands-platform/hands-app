import { Edit3, Plus, Save, X } from 'lucide-react';
import type { ReactNode } from 'react';

import {
  AdminFormCheckbox,
  AdminFormControlButton,
  AdminFormInput,
  AdminFormTextarea,
} from '../../components/admin-form-controls';
import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminSection } from '../../components/admin-surface';
import type { AdminServiceCatalogItem } from '../../lib/admin-api';
import { formatMoney } from '../../lib/admin-format';
import { serviceBasePayoutRule } from '../../lib/service-base-payout-rule';
import type { ServiceCatalogGroup } from '../../lib/service-catalog-filters';
import { createServiceDurationSet, saveServiceDurationMenu } from './actions';

type ServiceCatalogManagerSectionProps = {
  readonly dialogMode: 'new' | 'edit' | null;
  readonly editGroup: ServiceCatalogGroup | null;
  readonly groups: readonly ServiceCatalogGroup[];
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
  dialogMode,
  editGroup,
  groups,
  totalGroupCount,
}: ServiceCatalogManagerSectionProps) {
  return (
    <>
      <AdminSection
        actions={
          <a className="button button-primary" href={serviceDialogHref('new', null)}>
            <Plus aria-hidden="true" size={16} />
            Add service
          </a>
        }
        className="service-catalog-manager-card"
        description="Register the service menu that Partners can opt into. Customer app partner details only show services selected by that Partner."
        title="Service catalog"
      >

        <div className="admin-filter-panel-body service-catalog-toolbar">
          <p className="muted">
            Showing {groups.length} of {totalGroupCount} service type(s). Prices use 100,000 VND steps.
          </p>
        </div>

        <div className="admin-filter-panel-body service-menu-card-grid">
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
        </div>
      </AdminSection>

      {dialogMode === 'new' ? <NewServiceDialog /> : null}
      {dialogMode === 'edit' && editGroup ? <EditServiceDialog group={editGroup} /> : null}
    </>
  );
}

function ServiceCatalogCard({ group }: { readonly group: ServiceCatalogGroup }) {
  const activeCount = group.items.filter((service) => service.active).length;
  const durationSet = new Set(group.items.map((service) => service.durationMin));
  const translations = readableTranslations(group.nameTranslations);

  return (
    <article className="service-menu-card">
      <div className="service-menu-card-header">
        <div className="service-menu-title-cell">
          <span className="calendar-drawer-eyebrow">Service</span>
          <h3>{group.label}</h3>
          {translations.length ? (
            <div className="service-menu-language-list">
              {translations.map((translation) => (
                <span key={translation.key}>
                  <strong>{translation.label}</strong>
                  {translation.value}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <a
          className="button button-secondary service-table-action"
          href={serviceDialogHref('edit', group.key)}
        >
          <Edit3 aria-hidden="true" size={15} />
          Edit
        </a>
      </div>

      <div className="service-menu-inline-pills">
        <span className="pill pill-info">{group.items.length} option(s)</span>
        <span className={activeCount ? 'pill pill-success' : 'pill pill-neutral'}>
          {activeCount ? `${activeCount} active` : 'Inactive'}
        </span>
        <span className="pill pill-neutral">
          Missing {SERVICE_DURATIONS.filter((duration) => !durationSet.has(duration)).join(', ') || 'none'}
        </span>
      </div>

      <div className="service-menu-duration-grid">
        {SERVICE_DURATIONS.map((duration) => (
          <ServiceDurationPanel
            duration={duration}
            key={`${group.key}-${duration}`}
            service={group.items.find((item) => item.durationMin === duration)}
          />
        ))}
      </div>
    </article>
  );
}

function ServiceDurationPanel({
  duration,
  service,
}: {
  readonly duration: (typeof SERVICE_DURATIONS)[number];
  readonly service?: AdminServiceCatalogItem;
}) {
  if (!service) {
    return (
      <div className="card admin-card service-menu-duration-panel is-empty">
        <strong>{duration} min</strong>
        <span className="pill pill-neutral">Not set</span>
      </div>
    );
  }

  const payoutRule = serviceBasePayoutRule(service);

  return (
    <div className="card admin-card service-menu-duration-panel">
      <div>
        <strong>{duration} min</strong>
        <span className={service.active ? 'pill pill-success' : 'pill pill-neutral'}>
          {service.active ? 'Active' : 'Off'}
        </span>
      </div>
      <dl>
        <div>
          <dt>Base</dt>
          <dd>{formatMoney(service.basePrice)}</dd>
        </div>
        <div>
          <dt>Partner</dt>
          <dd>{formatMoney(payoutRule?.providerPayoutAmount)}</dd>
        </div>
      </dl>
    </div>
  );
}

function NewServiceDialog() {
  return (
    <ServiceDialogFrame eyebrow="Service setup" returnHref={servicesReturnHref()} title="Add service menu">
      <form action={createServiceDurationSet} className="calendar-form-grid service-menu-dialog-form">
        <ServiceIdentityFields />
        {SERVICE_DURATIONS.map((duration) => (
          <DurationInputRow duration={duration} key={duration} />
        ))}
        <input name="priceStep" type="hidden" value="100000" />
        <input name="displayOrder" type="hidden" value="100" />
        <input name="vatBps" type="hidden" value="0" />
        <input name="otherCostAmount" type="hidden" value="0" />
        <div className="calendar-drawer-footer service-menu-dialog-footer">
          <AdminFormControlButton className="button button-primary" type="submit">
            <Save aria-hidden="true" size={16} />
            Save service
          </AdminFormControlButton>
          <a className="button button-secondary" href={servicesReturnHref()}>
            Cancel
          </a>
        </div>
      </form>
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
      <form action={saveServiceDurationMenu} className="calendar-form-grid service-menu-dialog-form">
        <ServiceIdentityFields group={group} />
        {SERVICE_DURATIONS.map((duration) => {
          const service = group.items.find((item) => item.durationMin === duration);
          return <DurationInputRow duration={duration} key={duration} service={service} />;
        })}
        <div className="calendar-drawer-footer service-menu-dialog-footer">
          <AdminFormControlButton className="button button-primary" type="submit">
            <Save aria-hidden="true" size={16} />
            Save changes
          </AdminFormControlButton>
          <a className="button button-secondary" href={servicesReturnHref()}>
            Cancel
          </a>
        </div>
      </form>
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
      <aside
        aria-label={title}
        aria-modal="true"
        className="calendar-drawer service-menu-dialog"
        role="dialog"
      >
        <div className="calendar-drawer-header">
          <div>
            <span className="calendar-drawer-eyebrow">{eyebrow}</span>
            <h2>{title}</h2>
          </div>
          <a aria-label="Close service dialog" className="calendar-icon-button" href={returnHref}>
            <X aria-hidden="true" size={16} />
          </a>
        </div>
        <div className="calendar-drawer-body">{children}</div>
      </aside>
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
          <div className="calendar-field" key={field.key}>
            <span>{field.label}</span>
            <AdminFormInput
              defaultValue={translations[field.key] ?? (field.key === 'en' ? group?.label : '')}
              label={field.label}
              name={field.name}
              placeholder={field.placeholder}
              required={field.key === 'en'}
            />
          </div>
        ))}
      </div>
      <div className="calendar-field calendar-field-wide">
        <span>Description</span>
        <AdminFormTextarea
          defaultValue={firstService?.description ?? ''}
          label="Description"
          name="description"
          placeholder="Short copy shown in mobile service selection"
          rows={3}
        />
      </div>
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
      <div className="calendar-field">
        <span>Base price</span>
        <AdminFormInput
          defaultValue={service?.basePrice ?? ''}
          label={`${duration} min base price`}
          min="100000"
          name={`basePrice${duration}`}
          placeholder="500000"
          step="100000"
          type="number"
        />
      </div>
      <div className="calendar-field">
        <span>Partner payout</span>
        <AdminFormInput
          defaultValue={payoutRule?.providerPayoutAmount ?? ''}
          label={`${duration} min partner payout`}
          min="0"
          name={`providerPayoutAmount${duration}`}
          placeholder="350000"
          step="100000"
          type="number"
        />
      </div>
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

function readableTranslations(translations: Record<string, string> | null | undefined) {
  if (!translations) {
    return [];
  }
  return SERVICE_TRANSLATION_FIELDS.map((field) => ({
    key: field.key,
    label: field.key.toUpperCase(),
    value: translations[field.key],
  })).filter((translation) => translation.value);
}
