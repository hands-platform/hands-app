'use client';

import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import { Archive, EyeOff, Save, Send, ShieldCheck } from 'lucide-react';

import { AdminDrawerBackdropButton } from '../../components/admin-drawer-backdrop-button';
import { AdminReauthenticateOperatorForm } from '../../components/admin-reauthenticate-operator-form';
import {
  AdminDrawerActionFooter,
  AdminDrawerFormGrid,
  AdminFormCheckbox,
  AdminFormControlButton,
  AdminFormInput,
  AdminFormTextarea,
} from '../../components/admin-form-controls';
import { AdminInlineNotice } from '../../components/admin-inline-notice';
import { AdminDialogCard, AdminNoticeCard } from '../../components/admin-surface';
import { useAdminModalFocus } from '../../components/use-admin-modal-focus';
import type { AdminServiceCatalogDraftPayload, AdminServiceCatalogImpact } from '../../lib/admin-api';
import { serviceBasePayoutRule } from '../../lib/service-base-payout-rule';
import type { ServiceCatalogGroup } from '../../lib/service-catalog-filters';
import { saveServiceCatalogGroup } from './actions';
import { initialServiceCatalogActionState } from './service-catalog-action-state';
import {
  readVndEditorValue,
  SERVICE_CATALOG_DURATIONS,
  serviceCatalogPublishBlockers,
  serviceCatalogReviewChangeSet,
  slugifyServiceGroupKey,
  type ServiceCatalogReviewChangeSet,
} from './service-catalog-editor-model';
import { useServiceCatalogDrawer } from './service-catalog-drawer-shell';

const PRIMARY_TRANSLATION_FIELDS = [
  { key: 'en', label: 'English', name: 'nameEn', placeholder: 'Aroma Massage' },
  { key: 'vi', label: 'Vietnamese', name: 'nameVi', placeholder: 'Massage thu gian' },
] as const;
const ADDITIONAL_TRANSLATION_FIELDS = [
  {
    key: 'ko',
    label: 'Korean',
    name: 'nameKo',
    placeholder: '\uC544\uB85C\uB9C8 \uB9C8\uC0AC\uC9C0',
  },
  { key: 'ja', label: 'Japanese', name: 'nameJa', placeholder: 'アロママッサージ' },
  { key: 'zh', label: 'Chinese', name: 'nameZh', placeholder: '芳香按摩' },
] as const;

type CatalogIntent = 'PUBLISH' | 'HIDE' | 'ARCHIVE';
type DurationEditorValue = {
  readonly basePrice: string;
  readonly displayOrder: number;
  readonly enabled: boolean;
  readonly providerPayoutAmount: string;
};
type DurationEditorValues = Record<(typeof SERVICE_CATALOG_DURATIONS)[number], DurationEditorValue>;

export function ServiceCatalogEditorForm({
  group,
  impact,
  impactAvailable = true,
}: {
  readonly group?: ServiceCatalogGroup;
  readonly impact?: AdminServiceCatalogImpact | null;
  readonly impactAvailable?: boolean;
}) {
  const [state, action, pending] = useActionState(saveServiceCatalogGroup, initialServiceCatalogActionState);
  const { requestClose, setChildModalOpen } = useServiceCatalogDrawer();
  const [dirty, setDirty] = useState(false);
  const [confirmation, setConfirmation] = useState<CatalogIntent | null>(null);
  const [reauthDismissed, setReauthDismissed] = useState(false);
  const [reauthConfirmed, setReauthConfirmed] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  const mutationKeyRef = useRef<HTMLInputElement>(null);
  const mutationIntentRef = useRef<HTMLInputElement>(null);
  const confirmationTriggerRef = useRef<HTMLElement>(null);
  const draft = group?.draft?.payload;
  const translations = draft?.nameTranslations ?? group?.nameTranslations ?? {};
  const [translationValues, setTranslationValues] = useState<Record<string, string>>(() => ({
    en: translations.en ?? group?.label ?? '',
    vi: translations.vi ?? '',
    ko: translations.ko ?? '',
    ja: translations.ja ?? '',
    zh: translations.zh ?? '',
  }));
  const [serviceGroupKey, setServiceGroupKey] = useState(
    group?.key ?? slugifyServiceGroupKey(translations.en ?? translations.vi ?? ''),
  );
  const [keyManuallyEdited, setKeyManuallyEdited] = useState(Boolean(group));
  const [description, setDescription] = useState(draft?.description ?? group?.items[0]?.description ?? '');
  const [reason, setReason] = useState(draft?.reason ?? '');
  const [displayOrder, setDisplayOrder] = useState(String(draft?.displayOrder ?? group?.items[0]?.displayOrder ?? 100));
  const [durationValues, setDurationValues] = useState<DurationEditorValues>(() =>
    initialDurationValues(group, draft),
  );
  const pricingConflict = SERVICE_CATALOG_DURATIONS.some((duration) => {
    const row = durationValues[duration];
    const customerPrice = readVndEditorValue(row.basePrice);
    const payout = readVndEditorValue(row.providerPayoutAmount);
    return customerPrice !== null && payout !== null && payout > customerPrice;
  });
  const boundedImpactAvailable = !group || (impactAvailable && Boolean(impact));
  const publishBlockers = serviceCatalogPublishBlockers({
    impactAvailable: boundedImpactAvailable,
    nameTranslations: translationValues,
    reason,
    durations: durationValues,
  });
  const currentLiveOptionCount = group?.items.filter(
    (item) =>
      item.active && item.publicationStatus === 'PUBLISHED' && Boolean(serviceBasePayoutRule(item)),
  ).length ?? 0;
  const proposedLiveOptionCount = SERVICE_CATALOG_DURATIONS.filter(
    (duration) => durationValues[duration].enabled,
  ).length;
  const expectedVersion = Math.max(
    group?.draft?.version ?? 0,
    ...(group?.items.map((item) => item.catalogVersion ?? 0) ?? [0]),
  );
  const reviewChangeSet = serviceCatalogReviewChangeSet({
    description,
    displayOrder,
    durations: durationValues,
    group,
    nameTranslations: translationValues,
  });

  const resetMutationKey = useCallback(() => {
    if (mutationKeyRef.current) mutationKeyRef.current.value = '';
    if (mutationIntentRef.current) mutationIntentRef.current.value = '';
  }, []);

  const markChanged = useCallback(() => {
    setDirty(true);
    resetMutationKey();
  }, [resetMutationKey]);

  const prepareMutation = useCallback((intent: CatalogIntent | 'SAVE_DRAFT') => {
    if (!mutationKeyRef.current || !mutationIntentRef.current) return;
    if (!mutationKeyRef.current.value || mutationIntentRef.current.value !== intent) {
      mutationKeyRef.current.value = crypto.randomUUID();
      mutationIntentRef.current.value = intent;
    }
  }, []);

  useEffect(() => {
    formRef.current?.querySelector<HTMLInputElement>('input[name="nameEn"]')?.focus();
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const confirmUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', confirmUnload);
    return () => window.removeEventListener('beforeunload', confirmUnload);
  }, [dirty]);

  useEffect(() => {
    return () => setChildModalOpen(false);
  }, [setChildModalOpen]);

  function updateTranslation(key: string, value: string) {
    markChanged();
    setTranslationValues((current) => ({ ...current, [key]: value }));
    if (!group && key === 'en' && !keyManuallyEdited) {
      setServiceGroupKey(slugifyServiceGroupKey(value));
    }
  }

  function reviewPublish(trigger: HTMLElement) {
    if (publishBlockers.length) {
      focusEditorField(formRef.current, publishBlockers[0]?.field);
      return;
    }
    openConfirmation('PUBLISH', trigger);
  }

  function reviewRemoval(intent: 'HIDE' | 'ARCHIVE', trigger: HTMLElement) {
    if (reason.trim().length < 12) {
      focusEditorField(formRef.current, 'reason');
      return;
    }
    if (!boundedImpactAvailable) {
      focusEditorField(formRef.current, 'impact');
      return;
    }
    openConfirmation(intent, trigger);
  }

  function openConfirmation(intent: CatalogIntent, trigger: HTMLElement) {
    confirmationTriggerRef.current = trigger;
    setReauthConfirmed(false);
    setReauthDismissed(false);
    setChildModalOpen(true);
    setConfirmation(intent);
  }

  function closeConfirmation() {
    const trigger = confirmationTriggerRef.current;
    const triggerIntent = confirmation;
    setReauthConfirmed(false);
    setReauthDismissed(false);
    setConfirmation(null);
    setChildModalOpen(false);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const currentTrigger = triggerIntent
          ? document.querySelector<HTMLElement>(
              `[data-service-catalog-review-intent="${triggerIntent}"]`,
            )
          : trigger;
        if (currentTrigger?.isConnected) currentTrigger.focus({ preventScroll: true });
      });
    });
  }

  return (
    <div className="service-editor-form-shell" ref={formRef}>
      <AdminDrawerFormGrid action={action} className="service-menu-dialog-form" onInput={markChanged}>
        <input name="expectedVersion" type="hidden" value={expectedVersion} />
        <input name="priceStep" type="hidden" value={draft?.priceStep ?? group?.items[0]?.priceStep ?? 100000} />
        <input name="mutationKey" ref={mutationKeyRef} type="hidden" />
        <input name="mutationIntent" ref={mutationIntentRef} type="hidden" />
        {group ? <input name="serviceGroupKey" type="hidden" value={serviceGroupKey} /> : null}

        <section aria-labelledby="service-identity-heading" className="service-editor-section">
          <div className="service-editor-section-heading">
            <h3 id="service-identity-heading">Identity and app copy</h3>
            <p>English and Vietnamese names appear in customer and Partner app selection.</p>
          </div>
          <div className="service-menu-name-grid">
            {PRIMARY_TRANSLATION_FIELDS.map((field) => (
              <TranslationInput
                errors={state.fieldErrors}
                field={field}
                key={field.key}
                onChange={updateTranslation}
                value={translationValues[field.key] ?? ''}
              />
            ))}
          </div>
          <div className="service-editor-key-row">
            <span>
              <small>Internal service key</small>
              <code>{serviceGroupKey}</code>
            </span>
            {group ? (
              <small>Existing keys are immutable to protect booking and payout references.</small>
            ) : (
              <details>
                <summary>Advanced: edit generated key</summary>
                <div>
                  <AdminFormInput
                    ariaDescribedBy={fieldErrorId('serviceGroupKey', state.fieldErrors)}
                    ariaInvalid={Boolean(state.fieldErrors?.serviceGroupKey)}
                    className="admin-form-control-fluid"
                    label="Internal group key"
                    labelVisibility="visible"
                    name="serviceGroupKey"
                    onChange={(event) => {
                      markChanged();
                      setKeyManuallyEdited(true);
                      setServiceGroupKey(event.target.value);
                    }}
                    pattern="[a-z0-9_]{2,80}"
                    required
                    value={serviceGroupKey}
                  />
                  <FieldError field="serviceGroupKey" errors={state.fieldErrors} />
                </div>
              </details>
            )}
          </div>
          <details className="service-editor-language-disclosure">
            <summary>Additional app languages</summary>
            <div className="service-menu-name-grid">
              {ADDITIONAL_TRANSLATION_FIELDS.map((field) => (
                <TranslationInput
                  errors={state.fieldErrors}
                  field={field}
                  key={field.key}
                  onChange={updateTranslation}
                  value={translationValues[field.key] ?? ''}
                />
              ))}
            </div>
          </details>
          <div aria-label="Localized app preview" className="service-editor-app-preview">
            <div>
              <small>Customer app · English</small>
              <strong>{localizedPreviewName(translationValues, 'en', group?.label)}</strong>
            </div>
            <div>
              <small>Partner app · Vietnamese</small>
              <strong>{localizedPreviewName(translationValues, 'vi', group?.label)}</strong>
            </div>
          </div>
          <AdminFormTextarea
            className="admin-form-control-fluid"
            label="Customer-facing description"
            labelVisibility="visible"
            maxLength={500}
            name="description"
            onChange={(event) => {
              markChanged();
              setDescription(event.target.value);
            }}
            placeholder="Short, factual copy shown during service selection"
            rows={3}
            value={description}
          />
          <small className="service-editor-character-count">{description.length} / 500 characters</small>
          <AdminFormInput
            className="admin-form-control-fluid service-editor-display-order"
            label="Display order"
            labelVisibility="visible"
            min="0"
            name="displayOrder"
            onChange={(event) => {
              markChanged();
              setDisplayOrder(event.target.value);
            }}
            step="1"
            type="number"
            value={displayOrder}
          />
        </section>

        <section aria-labelledby="service-pricing-heading" className="service-editor-section">
          <div className="service-editor-section-heading">
            <h3 id="service-pricing-heading">Duration, price, and payout</h3>
            <p>Each switch controls whether that duration is offered in both apps after publish.</p>
          </div>
          <FieldError field="durations" errors={state.fieldErrors} />
          <div className="service-menu-duration-editor">
            {SERVICE_CATALOG_DURATIONS.map((duration) => (
              <DurationInputRow
                duration={duration}
                errors={state.fieldErrors}
                group={group}
                key={duration}
                onChange={(nextValue) => {
                  markChanged();
                  setDurationValues((current) => ({ ...current, [duration]: nextValue }));
                }}
                value={durationValues[duration]}
              />
            ))}
          </div>
          {pricingConflict ? (
            <AdminNoticeCard aria-live="assertive" className="service-editor-error" role="alert" tone="danger">
              Partner payout cannot exceed customer price. Correct the payout before saving or publishing.
            </AdminNoticeCard>
          ) : null}
        </section>

        <section aria-labelledby="service-publish-heading" className="service-editor-section">
          <div className="service-editor-section-heading">
            <h3 id="service-publish-heading">Impact and release readiness</h3>
            <p>Drafts do not change either app. Publish replaces the live duration set atomically.</p>
          </div>
          <div className="service-editor-impact-change" id="service-editor-impact" tabIndex={-1}>
            <ImpactChangeFact label="App-visible options" value={`${currentLiveOptionCount} → ${proposedLiveOptionCount}`} />
            <ImpactChangeFact label="Base-price Partners" value={impact ? Math.max(0, impact.activePartnerCount - impact.customPricePartnerCount) : group ? 'Unavailable' : '0'} />
            <ImpactChangeFact label="Custom-price Partners" value={impact?.customPricePartnerCount ?? (group ? 'Unavailable' : '0')} />
            <ImpactChangeFact label="Open booking lines" value={impact?.openBookingLineCount ?? (group ? 'Unavailable' : '0')} />
          </div>
          {group && !boundedImpactAvailable ? (
            <AdminNoticeCard role="alert" tone="danger">
              Partner and open booking impact could not be loaded. Save draft remains available; publish, hide, and archive are blocked until refresh.
            </AdminNoticeCard>
          ) : null}
          <AdminFormTextarea
            ariaDescribedBy={fieldErrorId('reason', state.fieldErrors)}
            ariaInvalid={Boolean(state.fieldErrors?.reason)}
            className="admin-form-control-fluid"
            label="Change reason"
            labelVisibility="visible"
            maxLength={500}
            name="reason"
            onChange={(event) => {
              markChanged();
              setReason(event.target.value);
            }}
            placeholder="Explain the customer, Partner, pricing, or payout impact."
            rows={3}
            value={reason}
          />
          <FieldError field="reason" errors={state.fieldErrors} />
          <div className="service-editor-readiness">
            <div>
              <ShieldCheck aria-hidden="true" size={18} />
              <strong>{publishBlockers.length ? `${publishBlockers.length} publish blocker(s)` : 'Ready for publish review'}</strong>
            </div>
            {publishBlockers.length ? (
              <ul>
                {publishBlockers.map((blocker) => (
                  <li key={`${blocker.field}-${blocker.label}`}>
                    <AdminFormControlButton
                      className="text-link"
                      onClick={() => focusEditorField(formRef.current, blocker.field)}
                      type="button"
                    >
                      {blocker.label}
                    </AdminFormControlButton>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          {state.status === 'error' ? (
            <AdminNoticeCard aria-live="assertive" className="service-editor-error" role="alert" tone="danger">
              {state.message}
            </AdminNoticeCard>
          ) : null}
        </section>

        <AdminDrawerActionFooter className="service-menu-dialog-footer">
          <AdminFormControlButton
            className="button-secondary"
            disabled={pending || pricingConflict}
            name="intent"
            onClick={() => prepareMutation('SAVE_DRAFT')}
            type="submit"
            value="SAVE_DRAFT"
          >
            <Save aria-hidden="true" size={16} />
            {pending ? 'Saving...' : 'Save draft'}
          </AdminFormControlButton>
          <AdminFormControlButton
            className="button-primary"
            data-service-catalog-review-intent="PUBLISH"
            disabled={pending || publishBlockers.length > 0}
            onClick={(event) => reviewPublish(event.currentTarget)}
            type="button"
          >
            <Send aria-hidden="true" size={16} />
            {publishBlockers.length ? `Review publish · ${publishBlockers.length} blocked` : `Review publish · ${proposedLiveOptionCount} options`}
          </AdminFormControlButton>
          <AdminFormControlButton className="button-secondary" disabled={pending} onClick={requestClose} type="button">
            Cancel
          </AdminFormControlButton>
          {group?.items.length ? (
            <details className="service-editor-danger-actions">
              <summary>More actions</summary>
              <div>
                {group.items.some((item) => item.publicationStatus === 'PUBLISHED') ? (
                  <AdminFormControlButton className="button-secondary" data-service-catalog-review-intent="HIDE" disabled={pending || pricingConflict || !boundedImpactAvailable} onClick={(event) => reviewRemoval('HIDE', event.currentTarget)} type="button">
                    <EyeOff aria-hidden="true" size={16} />
                    Review hide from apps
                  </AdminFormControlButton>
                ) : null}
                <AdminFormControlButton className="button-danger" data-service-catalog-review-intent="ARCHIVE" disabled={pending || pricingConflict || !boundedImpactAvailable} onClick={(event) => reviewRemoval('ARCHIVE', event.currentTarget)} type="button">
                  <Archive aria-hidden="true" size={16} />
                  Review archive
                </AdminFormControlButton>
              </div>
            </details>
          ) : null}
        </AdminDrawerActionFooter>

        {confirmation && (!state.reauthRequired || reauthDismissed) ? (
          <CatalogConfirmationDialog
            actionError={state.status === 'error' ? state.message : undefined}
            currentLiveOptionCount={currentLiveOptionCount}
            groupKey={serviceGroupKey}
            impact={impact}
            intent={confirmation}
            onCancel={closeConfirmation}
            onConfirmIdentity={() => setReauthDismissed(false)}
            pending={pending}
            prepareMutation={prepareMutation}
            proposedLiveOptionCount={proposedLiveOptionCount}
            reason={reason}
            reauthConfirmed={reauthConfirmed}
            reauthRequired={Boolean(state.reauthRequired)}
            returnFocusRef={confirmationTriggerRef}
            reviewChangeSet={reviewChangeSet}
          />
        ) : null}
      </AdminDrawerFormGrid>
      {confirmation && state.reauthRequired && !reauthDismissed ? (
        <CatalogReauthenticationDialog
          onBack={() => setReauthDismissed(true)}
          onSuccess={() => {
            setReauthConfirmed(true);
            setReauthDismissed(true);
          }}
        />
      ) : null}
    </div>
  );
}

function CatalogConfirmationDialog({
  actionError,
  currentLiveOptionCount,
  groupKey,
  impact,
  intent,
  onCancel,
  onConfirmIdentity,
  pending,
  prepareMutation,
  proposedLiveOptionCount,
  reason,
  reauthConfirmed,
  reauthRequired,
  returnFocusRef,
  reviewChangeSet,
}: {
  readonly actionError?: string;
  readonly currentLiveOptionCount: number;
  readonly groupKey: string;
  readonly impact?: AdminServiceCatalogImpact | null;
  readonly intent: CatalogIntent;
  readonly onCancel: () => void;
  readonly onConfirmIdentity: () => void;
  readonly pending: boolean;
  readonly prepareMutation: (intent: CatalogIntent) => void;
  readonly proposedLiveOptionCount: number;
  readonly reason: string;
  readonly reauthConfirmed: boolean;
  readonly reauthRequired: boolean;
  readonly returnFocusRef: RefObject<HTMLElement | null>;
  readonly reviewChangeSet: ServiceCatalogReviewChangeSet;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const [archiveAcknowledged, setArchiveAcknowledged] = useState(false);
  useAdminModalFocus(dialogRef, onCancel, returnFocusRef);
  const isArchive = intent === 'ARCHIVE';
  const title = intent === 'PUBLISH' ? 'Publish service group?' : intent === 'HIDE' ? 'Hide service group from apps?' : 'Archive service group?';
  const submitLabel = intent === 'PUBLISH' ? `Publish ${proposedLiveOptionCount} app-visible options` : intent === 'HIDE' ? 'Hide from Customer & Partner apps' : 'Archive service group';
  const consequenceCopy = intent === 'PUBLISH'
    ? 'This changes future bookings only. Existing bookings keep their stored customer price and Partner payout snapshots.'
    : intent === 'HIDE'
      ? `${currentLiveOptionCount} live option(s) disappear from both apps immediately. Existing booking snapshots stay unchanged. Review the retained draft and publish again to restore availability.`
      : 'Live options are removed while historical services and booking snapshots stay retained. The retained draft can be reviewed and published again later.';

  function stopParentEscape(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') event.stopPropagation();
  }

  return (
    <div className="service-catalog-confirmation-layer" onKeyDown={stopParentEscape}>
      <AdminDrawerBackdropButton aria-label="Cancel service catalog confirmation" className="confirm-dialog-backdrop" onClick={onCancel} />
      <AdminDialogCard
        ariaDescribedBy="service-catalog-confirmation-description"
        ariaLabelledBy="service-catalog-confirmation-title"
        ariaModal
        className="admin-dialog-card service-catalog-confirmation"
        loading={pending}
        surfaceRef={dialogRef}
        tabIndex={-1}
      >
        <div className="service-catalog-confirmation-heading">
          <h3 id="service-catalog-confirmation-title">{title}</h3>
          <p id="service-catalog-confirmation-description">
            Review the live app and bounded operational impact before applying this command.
          </p>
        </div>
        <dl className="service-catalog-confirmation-facts">
          <ImpactChangeFact label="Service key" value={groupKey} />
          <ImpactChangeFact label="App-visible options" value={`${currentLiveOptionCount} → ${intent === 'PUBLISH' ? proposedLiveOptionCount : 0}`} />
          <ImpactChangeFact label="Active Partners" value={impact?.activePartnerCount ?? 0} />
          <ImpactChangeFact label="Open booking lines" value={impact?.openBookingLineCount ?? 0} />
        </dl>
        {intent === 'PUBLISH' ? <CatalogPublishChangeSet changeSet={reviewChangeSet} /> : null}
        <p className="service-catalog-confirmation-consequence">
          {consequenceCopy} A service-group audit change set will record this command and its reason.
        </p>
        {reauthConfirmed ? (
          <AdminNoticeCard role="status" tone="success">
            Identity confirmed for this Admin session. Review the command again, then submit it explicitly.
          </AdminNoticeCard>
        ) : actionError ? (
          <AdminNoticeCard role="alert" tone="danger">
            {actionError}
            {reauthRequired ? (
              <AdminFormControlButton className="button-secondary" onClick={onConfirmIdentity} type="button">
                Confirm identity
              </AdminFormControlButton>
            ) : null}
          </AdminNoticeCard>
        ) : null}
        <div className="service-catalog-confirmation-reason">
          <small>Recorded reason</small>
          <p>{reason}</p>
        </div>
        {isArchive ? (
          <AdminFormCheckbox
            checked={archiveAcknowledged}
            label="Acknowledge archive recovery"
            onChange={(event) => setArchiveAcknowledged(event.target.checked)}
          >
            I understand that archive removes all live options. The retained draft can be reviewed and published again later.
          </AdminFormCheckbox>
        ) : null}
        <div className="service-catalog-confirmation-actions">
          <AdminFormControlButton className="button-secondary" disabled={pending} onClick={onCancel} type="button">
            Back to editor
          </AdminFormControlButton>
          <AdminFormControlButton
            className={isArchive ? 'button-danger' : 'button-primary'}
            disabled={pending || (isArchive && !archiveAcknowledged)}
            name="intent"
            onClick={() => prepareMutation(intent)}
            type="submit"
            value={intent}
          >
            {pending ? 'Applying...' : submitLabel}
          </AdminFormControlButton>
        </div>
      </AdminDialogCard>
    </div>
  );
}

function CatalogPublishChangeSet({ changeSet }: { readonly changeSet: ServiceCatalogReviewChangeSet }) {
  return (
    <section aria-labelledby="service-catalog-change-set-title" className="service-catalog-change-set">
      <div className="service-catalog-change-set-heading">
        <h4 id="service-catalog-change-set-title">Catalog changes</h4>
        {!changeSet.hasMonetaryChange ? <span>No monetary change</span> : null}
      </div>
      {changeSet.durationChanges.length ? (
        <div className="service-catalog-duration-changes">
          {changeSet.durationChanges.map((change) => (
            <div className="service-catalog-duration-change" key={change.durationMin}>
              <strong>{change.durationMin} minutes</strong>
              <dl>
                <ReviewDelta
                  after={change.after.offered ? 'Offered' : 'Not offered'}
                  before={change.before.offered ? 'Offered' : 'Not offered'}
                  label="Offered"
                />
                <ReviewDelta
                  after={formatVnd(change.after.customerPrice)}
                  before={formatVnd(change.before.customerPrice)}
                  label="Customer price"
                />
                <ReviewDelta
                  after={formatVnd(change.after.partnerPayout)}
                  before={formatVnd(change.before.partnerPayout)}
                  label="Partner payout"
                />
                <ReviewDelta
                  after={formatVnd(change.after.grossHandsFee)}
                  before={formatVnd(change.before.grossHandsFee)}
                  label="Gross HANDS fee"
                />
              </dl>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted service-catalog-no-field-change">No duration changes</p>
      )}
      {changeSet.configChanges.length ? (
        <dl className="service-catalog-config-changes">
          {changeSet.configChanges.map((change) => (
            <ReviewDelta
              after={change.after}
              before={change.before}
              key={change.label}
              label={change.label}
            />
          ))}
        </dl>
      ) : null}
    </section>
  );
}

function ReviewDelta({
  after,
  before,
  label,
}: {
  readonly after: string;
  readonly before: string;
  readonly label: string;
}) {
  return (
    <div className="service-catalog-review-delta">
      <dt>{label}</dt>
      <dd>
        <span>{before}</span>
        <span aria-hidden="true">→</span>
        <span>{after}</span>
      </dd>
    </div>
  );
}

function CatalogReauthenticationDialog({
  onBack,
  onSuccess,
}: {
  readonly onBack: () => void;
  readonly onSuccess: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  useAdminModalFocus(dialogRef, onBack);
  return (
    <div className="service-catalog-confirmation-layer">
      <AdminDrawerBackdropButton
        aria-label="Back to service catalog review"
        className="confirm-dialog-backdrop"
        onClick={onBack}
      />
      <AdminDialogCard
        ariaDescribedBy="service-catalog-reauthentication-description"
        ariaLabelledBy="service-catalog-reauthentication-title"
        ariaModal
        className="admin-dialog-card service-catalog-confirmation"
        surfaceRef={dialogRef}
        tabIndex={-1}
      >
        <div className="service-catalog-confirmation-heading">
          <h3 id="service-catalog-reauthentication-title">Confirm identity to continue</h3>
          <p id="service-catalog-reauthentication-description">
            Live catalog changes require recent password and MFA confirmation for this Admin session.
          </p>
        </div>
        <AdminReauthenticateOperatorForm onSuccess={onSuccess} />
        <div className="service-catalog-confirmation-actions">
          <AdminFormControlButton className="button-secondary" onClick={onBack} type="button">
            Back to review
          </AdminFormControlButton>
        </div>
      </AdminDialogCard>
    </div>
  );
}

function TranslationInput({ errors, field, onChange, value }: {
  readonly errors?: Readonly<Record<string, string>>;
  readonly field: { readonly key: string; readonly label: string; readonly name: string; readonly placeholder: string };
  readonly onChange: (key: string, value: string) => void;
  readonly value: string;
}) {
  return (
    <div>
      <AdminFormInput
        ariaDescribedBy={fieldErrorId(field.name, errors)}
        ariaInvalid={Boolean(errors?.[field.name])}
        className="admin-form-control-fluid"
        label={field.label}
        labelVisibility="visible"
        name={field.name}
        onChange={(event) => onChange(field.key, event.target.value)}
        placeholder={field.placeholder}
        value={value}
      />
      <FieldError field={field.name} errors={errors} />
    </div>
  );
}

function ImpactChangeFact({ label, value }: { readonly label: string; readonly value: number | string }) {
  return <div><dt>{label}</dt><dd>{typeof value === 'number' ? value.toLocaleString('en-US') : value}</dd></div>;
}

function DurationInputRow({ duration, errors, group, onChange, value }: {
  readonly duration: (typeof SERVICE_CATALOG_DURATIONS)[number];
  readonly errors?: Readonly<Record<string, string>>;
  readonly group?: ServiceCatalogGroup;
  readonly onChange: (value: DurationEditorValue) => void;
  readonly value: DurationEditorValue;
}) {
  const service = group?.items.find((item) => item.durationMin === duration);
  const payoutRule = service ? serviceBasePayoutRule(service) : null;
  const baseError = `duration${duration}.basePrice`;
  const payoutError = `duration${duration}.providerPayoutAmount`;
  const customerPrice = readVndEditorValue(value.basePrice);
  const payout = readVndEditorValue(value.providerPayoutAmount);
  const clientPayoutError = customerPrice !== null && payout !== null && payout > customerPrice
    ? 'Partner payout cannot exceed customer price.'
    : null;
  return (
    <fieldset className="service-menu-duration-form-row">
      <legend>{duration} minutes</legend>
      <input name={`displayOrder${duration}`} type="hidden" value={value.displayOrder} />
      <div>
        <AdminFormInput
          ariaDescribedBy={fieldErrorId(baseError, errors)}
          ariaInvalid={Boolean(errors?.[baseError])}
          className="admin-form-control-fluid"
          label="Customer price"
          labelVisibility="visible"
          min="100000"
          name={`basePrice${duration}`}
          onChange={(event) => onChange({ ...value, basePrice: event.target.value })}
          placeholder="500000"
          step="100000"
          type="number"
          value={value.basePrice}
        />
        <FieldError field={baseError} errors={errors} />
        <small className="service-editor-vnd-preview">{vndPreview(customerPrice)}</small>
      </div>
      <div>
        <AdminFormInput
          ariaDescribedBy={clientPayoutError ? `service-client-error-${duration}` : fieldErrorId(payoutError, errors)}
          ariaInvalid={Boolean(clientPayoutError || errors?.[payoutError])}
          className="admin-form-control-fluid"
          label="Partner payout"
          labelVisibility="visible"
          min="0"
          name={`providerPayoutAmount${duration}`}
          onChange={(event) => onChange({ ...value, providerPayoutAmount: event.target.value })}
          placeholder="350000"
          step="1"
          type="number"
          value={value.providerPayoutAmount}
        />
        <FieldError field={payoutError} errors={errors} />
        {clientPayoutError ? <AdminInlineNotice id={`service-client-error-${duration}`} role="alert" tone="danger">{clientPayoutError}</AdminInlineNotice> : null}
        <small className="service-editor-vnd-preview">{vndPreview(payout)}</small>
      </div>
      <AdminFormCheckbox
        checked={value.enabled}
        className="service-menu-enabled-toggle"
        label={`Offered in Customer and Partner apps for ${duration} minutes`}
        name={`active${duration}`}
        onChange={(event) => onChange({ ...value, enabled: event.target.checked })}
      >
        <span><strong>Offered in Customer &amp; Partner apps</strong><small>{value.enabled ? 'On' : 'Off'}</small></span>
      </AdminFormCheckbox>
      <div className="service-editor-row-impact">
        <small>Live</small>
        <span>{service ? `${formatVnd(service.basePrice)} customer · ${formatVnd(payoutRule?.providerPayoutAmount)} Partner` : 'Not configured'}</span>
        <small>Draft gross HANDS fee</small>
        <strong>{customerPrice !== null && payout !== null && payout <= customerPrice ? formatVnd(customerPrice - payout) : 'Unavailable'}</strong>
        {service?.payoutRules?.length ? (
          <details>
            <summary>Payout rule history · {service.payoutRules.length}</summary>
            <ul>
              {service.payoutRules.map((rule) => (
                <li key={rule.id}>{rule.active ? 'Current' : 'Historical'} · {formatVnd(rule.providerPayoutAmount)} at {formatVnd(rule.customerPrice)}</li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </fieldset>
  );
}

function FieldError({ errors, field }: { readonly errors?: Readonly<Record<string, string>>; readonly field: string }) {
  const error = errors?.[field];
  return error ? <AdminInlineNotice id={`service-field-error-${field.replace(/[^a-z0-9]/gi, '-')}`} role="alert" tone="danger">{error}</AdminInlineNotice> : null;
}

function fieldErrorId(field: string, errors?: Readonly<Record<string, string>>) {
  return errors?.[field] ? `service-field-error-${field.replace(/[^a-z0-9]/gi, '-')}` : undefined;
}

function focusEditorField(container: HTMLElement | null, field: string | undefined) {
  if (!container || !field) return;
  const selector = field === 'impact'
    ? '#service-editor-impact'
    : `[name="${field.replace(/^duration(\d+)\.(basePrice|providerPayoutAmount)$/u, (_, duration, kind) => `${kind}${duration}`)}"]`;
  const element = container.querySelector<HTMLElement>(selector);
  element?.focus();
  element?.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

function initialDurationValues(group: ServiceCatalogGroup | undefined, draft: AdminServiceCatalogDraftPayload | undefined): DurationEditorValues {
  return Object.fromEntries(SERVICE_CATALOG_DURATIONS.map((duration) => {
    const service = group?.items.find((item) => item.durationMin === duration);
    const draftRow = draft?.durations.find((row) => row.durationMin === duration);
    const payoutRule = service ? serviceBasePayoutRule(service) : null;
    return [duration, {
      basePrice: String(draftRow?.basePrice ?? service?.basePrice ?? ''),
      displayOrder: draftRow?.displayOrder ?? service?.displayOrder ?? 100 + duration,
      enabled: draftRow?.enabled ?? service?.active ?? false,
      providerPayoutAmount: String(draftRow?.providerPayoutAmount ?? payoutRule?.providerPayoutAmount ?? ''),
    }];
  })) as DurationEditorValues;
}

function localizedPreviewName(translations: Readonly<Record<string, string>>, requestedLocale: string, legacyName: string | undefined) {
  for (const locale of [requestedLocale, 'vi', 'en']) {
    const translated = translations[locale]?.trim();
    if (translated) return translated;
  }
  return legacyName?.trim() || 'Service unavailable';
}

function vndPreview(amount: number | null) {
  return amount === null ? 'Enter a VND amount' : formatVnd(amount);
}

function formatVnd(amount: number | null | undefined) {
  return amount === null || amount === undefined ? 'Unavailable' : `${amount.toLocaleString('en-US')} VND`;
}
