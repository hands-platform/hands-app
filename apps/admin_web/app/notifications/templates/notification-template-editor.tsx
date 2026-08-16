'use client';

import { useActionState, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Copy } from 'lucide-react';

import {
  AdminFormCheckbox,
  AdminFormControlButton,
  AdminFormInput,
  AdminFormSearch,
  AdminFormSelect,
  AdminFormShell,
  AdminFormTextarea,
} from '../../../components/admin-form-controls';
import { AdminNotePanel } from '../../../components/admin-surface';
import { StatusBadge } from '../../../components/status-badge';
import type {
  AdminNotificationTemplate,
  AdminNotificationTemplateCatalog,
  AdminNotificationTemplateTranslation,
} from '../../../lib/admin-api';
import {
  updateNotificationTemplate,
  updateNotificationTemplateBrowserFixture,
} from './actions';
import {
  INITIAL_NOTIFICATION_TEMPLATE_ACTION_STATE,
  type NotificationTemplateActionState,
} from './notification-template-action-state';

const TEMPLATE_LOCALES = [
  { value: 'en', label: 'English', shortLabel: 'EN' },
  { value: 'vi', label: 'Vietnamese', shortLabel: 'VI' },
  { value: 'ko', label: 'Korean', shortLabel: 'KO' },
  { value: 'ja', label: 'Japanese', shortLabel: 'JA' },
  { value: 'zh', label: 'Chinese', shortLabel: 'ZH' },
] as const;

const TRANSLATION_LOCALES = TEMPLATE_LOCALES.filter((locale) => locale.value !== 'en');

type TemplateLocale = (typeof TEMPLATE_LOCALES)[number]['value'];
type TranslationStatus = AdminNotificationTemplateTranslation['status'];
export type TranslationDraft = Record<TemplateLocale, {
  body: string;
  confirmIdenticalTranslation: boolean;
  reviewedAndReady: boolean;
  title: string;
}>;
export type TemplateFilters = {
  audience: string;
  channel: string;
  language: 'all' | Exclude<TemplateLocale, 'en'>;
  managed: string;
  readiness: 'all' | 'SOURCE_COPIED' | 'NEEDS_REVIEW' | 'READY';
  search: string;
};

const DEFAULT_FILTERS: TemplateFilters = {
  audience: 'all',
  channel: 'all',
  language: 'all',
  managed: 'all',
  readiness: 'all',
  search: '',
};

const VARIABLE_EXAMPLES: Record<string, string> = {
  partnerName: 'Linh Nguyen',
};

export function NotificationTemplateEditor({
  catalog,
  initialActionState = INITIAL_NOTIFICATION_TEMPLATE_ACTION_STATE,
  browserSaveFixture,
  initialLocale,
  initialTemplateKey,
}: {
  readonly catalog: AdminNotificationTemplateCatalog;
  readonly initialActionState?: NotificationTemplateActionState;
  readonly browserSaveFixture?: 'save-failure' | 'save-success' | 'slow-save';
  readonly initialLocale?: string;
  readonly initialTemplateKey?: string;
}) {
  const [templates, setTemplates] = useState(catalog.templates);
  const defaultTemplate = actionNeededTemplate(templates) ?? templates[0];
  const [selectedKey, setSelectedKey] = useState(
    templates.some((template) => template.key === initialTemplateKey)
      ? (initialTemplateKey ?? '')
      : (defaultTemplate?.key ?? ''),
  );
  const selectedTemplate = templates.find((template) => template.key === selectedKey) ?? defaultTemplate;
  const [activeLocale, setActiveLocale] = useState<TemplateLocale>(isTemplateLocale(initialLocale) ? initialLocale : 'en');
  const [draft, setDraft] = useState<TranslationDraft>(() => templateDraft(selectedTemplate));
  const [enabled, setEnabled] = useState(selectedTemplate?.enabled ?? false);
  const [reason, setReason] = useState('');
  const [filters, setFilters] = useState<TemplateFilters>(DEFAULT_FILTERS);
  const [previewChannel, setPreviewChannel] = useState<'push' | 'in-app'>(() => selectedTemplate?.channel === 'IN_APP' ? 'in-app' : 'push');
  const selectedKeyRef = useRef(selectedKey);
  const activeLocaleRef = useRef(activeLocale);
  const filteredTemplatesRef = useRef<AdminNotificationTemplate[]>(templates);

  const [state, formAction, pending] = useActionState(async (
    previousState: NotificationTemplateActionState,
    formData: FormData,
  ) => {
    const nextState = browserSaveFixture
      ? await updateNotificationTemplateBrowserFixture(browserSaveFixture, previousState, formData)
      : await updateNotificationTemplate(previousState, formData);
    const saved = nextState.saved;
    if (!saved) return nextState;

    setTemplates((current) => current.map((template) => template.key === saved.key ? saved : template));
    if (!shouldApplySavedTemplateResponse(selectedKeyRef.current, saved.key)) return nextState;

    setDraft(templateDraft(saved));
    setEnabled(saved.enabled);
    setReason('');
    if (formData.get('intent') !== 'save-next') return nextState;

    const locale = activeLocaleRef.current;
    const queue = filteredTemplatesRef.current.map((template) => template.key === saved.key ? saved : template);
    const nextTemplate = nextIncompleteTemplate(queue, saved.key, locale);
    if (!nextTemplate) return nextState;

    selectedKeyRef.current = nextTemplate.key;
    setSelectedKey(nextTemplate.key);
    setDraft(templateDraft(nextTemplate));
    setEnabled(nextTemplate.enabled);
    setPreviewChannel(nextTemplate.channel === 'IN_APP' ? 'in-app' : 'push');
    updateUrl(nextTemplate.key, locale);
    return nextState;
  }, initialActionState);

  const baseline = useMemo(() => templateDraft(selectedTemplate), [selectedTemplate]);
  const changedLocales = TEMPLATE_LOCALES.filter(({ value }) => !sameTranslationDraft(draft[value], baseline[value])).map(({ value }) => value);
  const enabledChanged = Boolean(selectedTemplate && enabled !== selectedTemplate.enabled);
  const dirty = changedLocales.length > 0 || enabledChanged;
  const allowedVariables = notificationTemplateVariables(selectedTemplate?.variables);
  const requiredVariables = notificationTemplateVariables(selectedTemplate?.requiredVariables);
  const validationErrors = notificationTemplateValidationErrors(
    selectedTemplate,
    draft,
    changedLocales,
    allowedVariables,
    requiredVariables,
  );
  const activeDraft = draft[activeLocale];
  const filteredTemplates = useMemo(
    () => templates.filter((template) => templateMatchesFilters(template, filters)),
    [filters, templates],
  );
  const groupedTemplates = groupNotificationTemplates(filteredTemplates);
  const selectedIsVisible = Boolean(selectedTemplate && filteredTemplates.some((template) => template.key === selectedTemplate.key));

  useEffect(() => {
    selectedKeyRef.current = selectedKey;
  }, [selectedKey]);

  useEffect(() => {
    activeLocaleRef.current = activeLocale;
  }, [activeLocale]);

  useEffect(() => {
    filteredTemplatesRef.current = filteredTemplates;
  }, [filteredTemplates]);

  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      if (!dirty && !pending) return;
      event.preventDefault();
      event.returnValue = '';
    }
    function guardNavigation(event: MouseEvent) {
      if ((!dirty && !pending) || !(event.target instanceof Element)) return;
      const link = event.target.closest('a[href]');
      if (!link || link.getAttribute('href')?.startsWith('#')) return;
      const message = pending
        ? 'This template is still saving. Stay here until the save finishes?'
        : 'Discard unsaved notification template changes?';
      if (!window.confirm(message)) event.preventDefault();
    }
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', guardNavigation);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('click', guardNavigation);
    };
  }, [dirty, pending]);

  useEffect(() => {
    function restoreUrlSelection() {
      if (pending) {
        window.history.forward();
        return;
      }
      const url = new URL(window.location.href);
      const nextTemplate = templates.find((template) => template.key === url.searchParams.get('template'));
      const nextLocale = url.searchParams.get('locale');
      if (!nextTemplate || !isTemplateLocale(nextLocale ?? undefined)) return;
      if (dirty && !window.confirm('Discard unsaved notification template changes?')) {
        window.history.forward();
        return;
      }
      selectedKeyRef.current = nextTemplate.key;
      setSelectedKey(nextTemplate.key);
      setDraft(templateDraft(nextTemplate));
      setEnabled(nextTemplate.enabled);
      setPreviewChannel(nextTemplate.channel === 'IN_APP' ? 'in-app' : 'push');
      setReason('');
      setActiveLocale(nextLocale as TemplateLocale);
    }
    window.addEventListener('popstate', restoreUrlSelection);
    return () => window.removeEventListener('popstate', restoreUrlSelection);
  }, [dirty, pending, templates]);

  if (!selectedTemplate) {
    return <p className="muted">No managed notification copy is configured.</p>;
  }

  function selectTemplate(nextTemplate: AdminNotificationTemplate, locale: TemplateLocale = filters.language === 'all' ? 'en' : filters.language) {
    if (pending) return;
    if (dirty && !window.confirm('Discard unsaved notification template changes?')) return;
    selectedKeyRef.current = nextTemplate.key;
    setSelectedKey(nextTemplate.key);
    setDraft(templateDraft(nextTemplate));
    setEnabled(nextTemplate.enabled);
    setPreviewChannel(nextTemplate.channel === 'IN_APP' ? 'in-app' : 'push');
    setReason('');
    setActiveLocale(locale);
    updateUrl(nextTemplate.key, locale);
  }

  function replaceWithLatest(nextTemplate: AdminNotificationTemplate) {
    setTemplates((current) => current.map((template) => template.key === nextTemplate.key ? nextTemplate : template));
    selectedKeyRef.current = nextTemplate.key;
    setSelectedKey(nextTemplate.key);
    setDraft(templateDraft(nextTemplate));
    setEnabled(nextTemplate.enabled);
    setPreviewChannel(nextTemplate.channel === 'IN_APP' ? 'in-app' : 'push');
    setReason('');
  }

  function selectLocale(locale: TemplateLocale) {
    if (pending) return;
    setActiveLocale(locale);
    updateUrl(selectedTemplate!.key, locale);
  }

  function updateTranslation(locale: TemplateLocale, patch: Partial<TranslationDraft[TemplateLocale]>) {
    setDraft((current) => ({ ...current, [locale]: { ...current[locale], ...patch } }));
  }

  function changeFilter<K extends keyof TemplateFilters>(key: K, value: TemplateFilters[K]) {
    if (pending) return;
    const nextFilters = { ...filters, [key]: value };
    const hidesSelection = !templateMatchesFilters(selectedTemplate!, nextFilters);
    if (hidesSelection && dirty && !window.confirm('This filter hides the current template. Discard its unsaved changes?')) return;
    if (hidesSelection && dirty) {
      setDraft(templateDraft(selectedTemplate));
      setEnabled(selectedTemplate!.enabled);
      setReason('');
    }
    setFilters(nextFilters);
    if (key === 'language' && value !== 'all') setActiveLocale(value as TemplateLocale);
  }

  function resetFilters() {
    setFilters(DEFAULT_FILTERS);
  }

  function insertVariable(variable: string) {
    const textarea = document.querySelector<HTMLTextAreaElement>(`textarea[name="body_${activeLocale}"]`);
    const start = textarea?.selectionStart ?? activeDraft.body.length;
    const end = textarea?.selectionEnd ?? start;
    const token = `{${variable}}`;
    updateTranslation(activeLocale, { body: `${activeDraft.body.slice(0, start)}${token}${activeDraft.body.slice(end)}` });
    window.requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  async function copyDraftAndReload() {
    await navigator.clipboard.writeText(JSON.stringify({ draft, enabled, reason, templateKey: selectedTemplate!.key }, null, 2));
    window.location.reload();
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (pending) return;
    const last = TEMPLATE_LOCALES.length - 1;
    const nextIndex = event.key === 'ArrowRight' ? (index === last ? 0 : index + 1)
      : event.key === 'ArrowLeft' ? (index === 0 ? last : index - 1)
        : event.key === 'Home' ? 0 : event.key === 'End' ? last : null;
    if (nextIndex === null) return;
    event.preventDefault();
    const locale = TEMPLATE_LOCALES[nextIndex].value;
    selectLocale(locale);
    window.requestAnimationFrame(() => {
      document.getElementById(`notification-copy-tab-${locale}`)?.focus();
    });
  }

  const previewTitle = renderNotificationPreview(activeDraft.title);
  const previewBody = renderNotificationPreview(activeDraft.body);
  const translationPayload = changedLocales.map((locale) => ({
    body: draft[locale].body,
    confirmIdenticalTranslation: draft[locale].confirmIdenticalTranslation,
    locale,
    reviewedAndReady: locale === 'en' || draft[locale].reviewedAndReady,
    title: draft[locale].title,
  }));
  const destination = selectedTemplate.openBehavior?.summary ?? 'No deep link';
  const counts = readinessCounts(templates);
  const visibleActionState = state.status !== 'idle' && state.message && state.templateKey === selectedTemplate.key
    ? state
    : INITIAL_NOTIFICATION_TEMPLATE_ACTION_STATE;
  const sourceCopiedIdentical = activeLocale !== 'en' && isSourceCopiedIdentical(selectedTemplate, draft, activeLocale);
  const languageCounts = incompleteLanguageCounts(templates);
  const hasNextIncomplete = Boolean(nextIncompleteTemplate(filteredTemplates, selectedTemplate.key, activeLocale));
  const contractIssues = selectedTemplate.contractIssues ?? [];
  const canSave = dirty && reason.trim().length >= 5 && validationErrors.length === 0 && contractIssues.length === 0 && !pending;

  return (
    <div className="notification-template-workspace">
      <div className="notification-template-readiness" aria-label="Catalog readiness">
        <ReadinessItem label="Language versions needing translation" value={counts.needsTranslation + counts.needsReview} tone={counts.needsTranslation + counts.needsReview ? 'warning' : 'success'} />
        <ReadinessItem label="Needs review" value={counts.needsReview} tone={counts.needsReview ? 'warning' : 'success'} />
        <ReadinessItem label="Contract issues" value={catalog.health.contractIssues?.length ?? catalog.health.missingKeys.length + catalog.health.unexpectedKeys.length} tone={catalog.health.complete ? 'success' : 'danger'} />
        <ReadinessItem label="Managed copy off" value={templates.filter((template) => !template.enabled).length} tone="neutral" />
        <div className="notification-template-last-change">
          <span>Translation queue</span>
          <strong>{TRANSLATION_LOCALES.map((locale) => `${locale.shortLabel} ${languageCounts[locale.value]}`).join(' · ')}</strong>
          <small>{catalog.lastChange ? `Last change ${formatTimestamp(catalog.lastChange.changedAt)}` : 'No audit event'}</small>
        </div>
      </div>

      <div className="notification-template-layout">
        <aside className="notification-template-catalog" aria-label="Notification template catalog">
          <AdminFormSearch className="notification-template-search" label="Search templates" onChange={(event) => changeFilter('search', event.target.value)} placeholder="Search copy or event key" value={filters.search} />
          <div className="notification-template-catalog-filters">
            <AdminFormSelect disabled={pending} label="Language" labelVisibility="hidden" name="languageFilter" onChange={(event) => changeFilter('language', event.target.value as TemplateFilters['language'])} options={[{ label: 'All languages', value: 'all' }, ...TRANSLATION_LOCALES.map((locale) => ({ label: locale.label, value: locale.value }))]} value={filters.language} />
            <AdminFormSelect disabled={pending} label="Status" labelVisibility="hidden" name="readinessFilter" onChange={(event) => changeFilter('readiness', event.target.value as TemplateFilters['readiness'])} options={[{ label: 'All statuses', value: 'all' }, { label: 'Source copied', value: 'SOURCE_COPIED' }, { label: 'Needs review', value: 'NEEDS_REVIEW' }, { label: 'Ready', value: 'READY' }]} value={filters.readiness} />
            <AdminFormSelect disabled={pending} label="Audience" labelVisibility="hidden" name="audienceFilter" onChange={(event) => changeFilter('audience', event.target.value)} options={[{ label: 'All audiences', value: 'all' }, { label: 'Customer', value: 'CUSTOMER' }, { label: 'Partner', value: 'PROVIDER' }]} value={filters.audience} />
            <AdminFormSelect disabled={pending} label="Channel" labelVisibility="hidden" name="channelFilter" onChange={(event) => changeFilter('channel', event.target.value)} options={[{ label: 'All channels', value: 'all' }, { label: 'Push + in-app', value: 'BOTH' }, { label: 'Push only', value: 'PUSH' }, { label: 'In-app only', value: 'IN_APP' }]} value={filters.channel} />
            <AdminFormSelect disabled={pending} label="Managed copy" labelVisibility="hidden" name="managedFilter" onChange={(event) => changeFilter('managed', event.target.value)} options={[{ label: 'All managed states', value: 'all' }, { label: 'Managed copy on', value: 'on' }, { label: 'Managed copy off', value: 'off' }]} value={filters.managed} />
          </div>
          <div className="notification-template-result-count" aria-live="polite">{filteredTemplates.length} of {templates.length} templates</div>
          <div className="notification-template-catalog-list">
            {groupedTemplates.map(([group, rows]) => (
              <div className="notification-template-catalog-group" key={group}>
                <h4>{group}</h4>
                {rows.map((template) => {
                  const selectedLanguageStatus = filters.language === 'all' ? null : translationStatus(template, filters.language);
                  return (
                    <AdminFormControlButton aria-current={template.key === selectedTemplate.key ? 'true' : undefined} className={`button-secondary${template.key === selectedTemplate.key ? ' is-active' : ''}`} disabled={pending} key={template.key} onClick={() => selectTemplate(template)} type="button">
                      <span><strong>{notificationTemplateName(template)}</strong><small>{template.audience === 'PROVIDER' ? 'Partner' : 'Customer'} · {channelLabel(template.channel)}</small></span>
                      <StatusBadge tone={selectedLanguageStatus === 'READY' || (!selectedLanguageStatus && templateReadiness(template) === 'ready') ? 'success' : 'warning'}>{selectedLanguageStatus ? statusLabel(selectedLanguageStatus) : `${readyLanguageCount(template)}/5`}</StatusBadge>
                    </AdminFormControlButton>
                  );
                })}
              </div>
            ))}
            {filteredTemplates.length === 0 ? <div className="notification-template-empty-result"><strong>No templates match these filters.</strong><AdminFormControlButton className="button-secondary" onClick={resetFilters} type="button">Reset filters</AdminFormControlButton></div> : null}
          </div>
        </aside>

        {!selectedIsVisible ? (
          <section className="notification-template-editor notification-template-editor-empty" aria-label="No matching template">
            <strong>No templates match these filters.</strong>
            <p className="muted">Reset the filters to continue editing managed notification copy.</p>
            <AdminFormControlButton className="button-secondary" onClick={resetFilters} type="button">Reset filters</AdminFormControlButton>
          </section>
        ) : (
          <section className="notification-template-editor" aria-labelledby="notification-template-editor-title">
            <header className="notification-template-editor-header">
              <div>
                <p className="eyebrow">{selectedTemplate.audience === 'PROVIDER' ? 'PARTNER' : 'CUSTOMER'} · {channelLabel(selectedTemplate.channel)}</p>
                <h3 id="notification-template-editor-title">{notificationTemplateName(selectedTemplate)}</h3>
                <p className="muted">{selectedTemplate.description}</p>
              </div>
              <StatusBadge tone={enabled ? 'success' : 'neutral'}>{enabled ? 'Managed copy on' : 'Managed copy off'}</StatusBadge>
            </header>

            <div className="notification-template-route-row">
              <span><small>Runtime event</small><strong>{runtimeRouteLabel(selectedTemplate)}</strong></span>
              <span><small>Opens</small><strong>{destination}</strong><small>{selectedTemplate.openBehavior?.variesByPayload ? 'This destination varies with the notification payload.' : `Payload keys: ${selectedTemplate.openBehavior?.payloadKeys.join(', ') || 'none'}`}</small></span>
              <AdminFormControlButton aria-label="Copy template key" className="button-secondary" onClick={() => navigator.clipboard.writeText(selectedTemplate.key)} title="Copy template key" type="button"><Copy size={16} /></AdminFormControlButton>
            </div>

            <div className="notification-template-delivery-behavior">
              <div><strong>Delivery behavior</strong><p className="muted">Managed copy controls wording only, not notification delivery.</p></div>
              <AdminFormCheckbox checked={enabled} disabled={pending} label="Use managed copy" onChange={(event) => setEnabled(event.target.checked)}><strong>Use managed copy</strong><span>When off, notifications still send using the code fallback copy.</span></AdminFormCheckbox>
            </div>

            <AdminFormShell action={formAction} className="notification-template-session-form">
              <input name="key" type="hidden" value={selectedTemplate.key} />
              <input name="enabled" type="hidden" value={String(enabled)} />
              <input name="expectedUpdatedAt" type="hidden" value={selectedTemplate.updatedAt} />
              <input name="translations" type="hidden" value={JSON.stringify(translationPayload)} />
              {browserSaveFixture ? <input name="fixtureTemplate" type="hidden" value={JSON.stringify(selectedTemplate)} /> : null}

              <div aria-label="Template languages" className="notification-template-language-tabs" role="tablist">
                {TEMPLATE_LOCALES.map((locale, index) => {
                  const status = translationStatus(selectedTemplate, locale.value);
                  const changed = changedLocales.includes(locale.value);
                  return (
                    <AdminFormControlButton aria-controls={`notification-copy-panel-${locale.value}`} aria-selected={activeLocale === locale.value} className={`button-secondary${activeLocale === locale.value ? ' is-active' : ''}`} disabled={pending} id={`notification-copy-tab-${locale.value}`} key={locale.value} onClick={() => selectLocale(locale.value)} onKeyDown={(event) => onTabKeyDown(event, index)} role="tab" tabIndex={activeLocale === locale.value ? 0 : -1} type="button">
                      <span>{locale.label}</span><small>{changed ? 'Changed' : statusLabel(status)}</small>
                    </AdminFormControlButton>
                  );
                })}
              </div>

              <div aria-labelledby={`notification-copy-tab-${activeLocale}`} className="notification-template-copy-form" id={`notification-copy-panel-${activeLocale}`} role="tabpanel">
                <div className="notification-template-copy-form-header">
                  <div><h4>{TEMPLATE_LOCALES.find((locale) => locale.value === activeLocale)?.label}</h4><p className="muted">{statusLabel(translationStatus(selectedTemplate, activeLocale))}</p></div>
                </div>

                {allowedVariables.length > 0 ? <div className="notification-template-variable-chips" aria-label="Supported variables">{allowedVariables.map((variable) => <AdminFormControlButton className="button-secondary" key={variable} onClick={() => insertVariable(variable)} type="button"><strong>{variableLabel(variable)}</strong><span>{requiredVariables.includes(variable) ? 'Required' : 'Optional'} · {VARIABLE_EXAMPLES[variable] ?? 'Sample value'}</span></AdminFormControlButton>)}</div> : null}
                <AdminFormInput label={`Title · ${activeDraft.title.length}/120`} labelVisibility="visible" maxLength={120} name={`title_${activeLocale}`} onChange={(event) => updateTranslation(activeLocale, { title: event.target.value, ...(activeLocale === 'en' ? {} : { confirmIdenticalTranslation: false, reviewedAndReady: false }) })} required value={activeDraft.title} />
                <AdminFormTextarea label={`Message · ${activeDraft.body.length}/500`} labelVisibility="visible" maxLength={500} name={`body_${activeLocale}`} onChange={(event) => updateTranslation(activeLocale, { body: event.target.value, ...(activeLocale === 'en' ? {} : { confirmIdenticalTranslation: false, reviewedAndReady: false }) })} required rows={5} value={activeDraft.body} />
                {sourceCopiedIdentical ? <AdminNotePanel className="ops-task-warning"><strong>This copy still matches the English source.</strong><p>Translate it before marking it ready, or use the separate identical-language exception below.</p></AdminNotePanel> : null}
                {sourceCopiedIdentical ? <AdminFormCheckbox checked={activeDraft.confirmIdenticalTranslation} label="Confirm this language intentionally matches English" onChange={(event) => updateTranslation(activeLocale, { confirmIdenticalTranslation: event.target.checked, ...(event.target.checked ? {} : { reviewedAndReady: false }) })}><strong>Confirm this language intentionally matches English</strong><span>This exception is recorded with your reason, identity, and review time.</span></AdminFormCheckbox> : null}
                {activeLocale !== 'en' ? <AdminFormCheckbox checked={activeDraft.reviewedAndReady} disabled={sourceCopiedIdentical && !activeDraft.confirmIdenticalTranslation} label="Reviewed and ready" onChange={(event) => updateTranslation(activeLocale, { reviewedAndReady: event.target.checked })}><strong>Reviewed and ready</strong><span>Use this language at runtime after this save.</span></AdminFormCheckbox> : null}
              </div>

              <div className="notification-template-preview">
                <div className="notification-template-preview-tabs"><AdminFormControlButton aria-pressed={previewChannel === 'push'} className="button-secondary" disabled={selectedTemplate.channel === 'IN_APP'} onClick={() => setPreviewChannel('push')} type="button">Push</AdminFormControlButton><AdminFormControlButton aria-pressed={previewChannel === 'in-app'} className="button-secondary" disabled={selectedTemplate.channel === 'PUSH'} onClick={() => setPreviewChannel('in-app')} type="button">In-app</AdminFormControlButton></div>
                <small className="muted">Preview length · title {activeDraft.title.length}/120 · message {activeDraft.body.length}/500</small>
                {previewChannel === 'push' ? <div className="notification-template-push-preview"><span className="notification-template-app-icon">H</span><div><small>HANDS · now</small><strong>{previewTitle || 'Notification title'}</strong><p>{previewBody || 'Notification message'}</p></div></div> : <div className="notification-template-inapp-preview"><span className="notification-template-app-icon">H</span><div><strong>{previewTitle || 'Notification title'}</strong><p>{previewBody || 'Notification message'}</p><small>Opens {destination}</small></div></div>}
              </div>

              {dirty ? <details className="notification-template-change-summary"><summary>Review pending changes</summary><div>{changedLocales.map((locale) => <div className="notification-template-change-item" key={locale}><strong>{TEMPLATE_LOCALES.find((item) => item.value === locale)?.label}</strong><span>Copy</span><p>{copyChanged(draft[locale], baseline[locale]) ? 'Changed' : 'Unchanged'}</p><span>Readiness</span><p>{statusLabel(translationStatus(selectedTemplate, locale))} → {locale === 'en' || draft[locale].reviewedAndReady ? 'Ready' : 'Needs review'}</p></div>)}{enabledChanged ? <div className="notification-template-change-item"><strong>Managed copy</strong><p>{selectedTemplate.enabled ? 'On' : 'Off'} → {enabled ? 'On' : 'Off'}</p></div> : null}</div></details> : null}

              {validationErrors.length > 0 ? <div role="alert"><AdminNotePanel className="ops-task-danger"><strong>Fix notification copy before saving</strong>{validationErrors.map((error) => <p key={error}>{error}</p>)}</AdminNotePanel></div> : null}
              {contractIssues.length > 0 ? <div role="alert"><AdminNotePanel className="ops-task-danger"><strong>This template cannot be saved until its contract is repaired</strong>{contractIssues.map((issue) => <p key={issue}>{issue}</p>)}</AdminNotePanel></div> : null}
              {visibleActionState.status !== 'idle' ? <div aria-live="polite" role="status"><AdminNotePanel className={visibleActionState.status === 'saved' ? 'ops-task-success' : 'ops-task-danger'}><strong>{visibleActionState.status === 'saved' ? 'Saved' : 'Not saved'}</strong><p>{visibleActionState.message}</p>{visibleActionState.status === 'conflict' ? <div className="notification-template-conflict-actions"><AdminFormControlButton className="button-secondary" onClick={() => visibleActionState.latest && replaceWithLatest(visibleActionState.latest)} type="button">Reload latest</AdminFormControlButton><AdminFormControlButton className="button-secondary" onClick={() => navigator.clipboard.writeText(JSON.stringify({ draft, enabled, reason }, null, 2))} type="button">Copy my draft</AdminFormControlButton></div> : ['session-expired', 'source-unavailable', 'server-error'].includes(visibleActionState.status) ? <div className="notification-template-conflict-actions"><AdminFormControlButton className="button-secondary" onClick={copyDraftAndReload} type="button">Copy draft &amp; reload</AdminFormControlButton></div> : null}</AdminNotePanel></div> : null}

              <div className="notification-template-save-row">
                <div><strong>{pending ? 'Saving this template…' : dirty ? `${changedLocales.length} language changes` : 'No unsaved changes'}</strong><p className="muted">{enabledChanged ? `Managed copy: ${selectedTemplate.enabled ? 'On' : 'Off'} → ${enabled ? 'On' : 'Off'}` : 'All changed languages save atomically.'}</p></div>
                <AdminFormInput label="Change reason" labelVisibility="visible" minLength={5} name="reason" onChange={(event) => setReason(event.target.value)} placeholder="Why is this copy changing?" required value={reason} />
                <div className="notification-template-save-actions">
                  <AdminFormControlButton disabled={!canSave} name="intent" value="save">{pending ? 'Saving this template…' : 'Save changes'}</AdminFormControlButton>
                  {activeLocale !== 'en' && hasNextIncomplete ? <AdminFormControlButton className="button-secondary" disabled={!canSave} name="intent" value="save-next">Save &amp; next {TEMPLATE_LOCALES.find((locale) => locale.value === activeLocale)?.label} item</AdminFormControlButton> : null}
                </div>
              </div>
            </AdminFormShell>

            <details className="notification-template-technical-details">
              <summary>Technical details</summary>
              <code>{selectedTemplate.key}</code>
            </details>
          </section>
        )}
      </div>
    </div>
  );
}

export function shouldApplySavedTemplateResponse(currentSelectedKey: string, savedTemplateKey: string) {
  return currentSelectedKey === savedTemplateKey;
}

export function isSourceCopiedIdentical(
  template: AdminNotificationTemplate,
  draft: TranslationDraft,
  locale: TemplateLocale,
) {
  return locale !== 'en'
    && translationStatus(template, locale) === 'SOURCE_COPIED'
    && normalizedCopy(draft[locale].title) === normalizedCopy(draft.en.title)
    && normalizedCopy(draft[locale].body) === normalizedCopy(draft.en.body);
}

function ReadinessItem({ label, tone, value }: { label: string; tone: 'danger' | 'neutral' | 'success' | 'warning'; value: number }) {
  return <div><span>{label}</span><strong>{value}</strong><StatusBadge tone={tone}>{value === 0 ? 'Clear' : 'Review'}</StatusBadge></div>;
}

function templateDraft(template: AdminNotificationTemplate | undefined): TranslationDraft {
  return Object.fromEntries(TEMPLATE_LOCALES.map(({ value }) => {
    const translation = template?.translations.find((item) => item.locale === value);
    return [value, {
      body: translation?.body ?? '',
      confirmIdenticalTranslation: false,
      reviewedAndReady: translation?.status === 'READY',
      title: translation?.title ?? '',
    }];
  })) as TranslationDraft;
}

function sameTranslationDraft(left: TranslationDraft[TemplateLocale], right: TranslationDraft[TemplateLocale]) {
  return left.title === right.title
    && left.body === right.body
    && left.reviewedAndReady === right.reviewedAndReady
    && left.confirmIdenticalTranslation === right.confirmIdenticalTranslation;
}

function copyChanged(left: TranslationDraft[TemplateLocale], right: TranslationDraft[TemplateLocale]) {
  return left.title !== right.title || left.body !== right.body;
}

function notificationTemplateValidationErrors(
  template: AdminNotificationTemplate,
  draft: TranslationDraft,
  changedLocales: readonly TemplateLocale[],
  allowedVariables: readonly string[],
  requiredVariables: readonly string[],
) {
  const allowed = new Set(allowedVariables);
  const errors: string[] = [];
  for (const { label, value } of TEMPLATE_LOCALES.filter((locale) => changedLocales.includes(locale.value))) {
    if (!draft[value].title.trim() || !draft[value].body.trim()) {
      errors.push(`${label}: title and message are required`);
      continue;
    }
    const placeholders = notificationPlaceholders(`${draft[value].title} ${draft[value].body}`);
    const unknown = placeholders.filter((placeholder) => !allowed.has(placeholder));
    const missing = requiredVariables.filter((placeholder) => !placeholders.includes(placeholder));
    if (unknown.length > 0) errors.push(`${label}: unknown ${unknown.join(', ')}`);
    if (missing.length > 0) errors.push(`${label}: missing ${missing.join(', ')}`);
    if (draft[value].confirmIdenticalTranslation && !draft[value].reviewedAndReady) {
      errors.push(`${label}: identical-language confirmation is only valid with Reviewed and ready`);
    }
    if (draft[value].reviewedAndReady && isSourceCopiedIdentical(template, draft, value) && !draft[value].confirmIdenticalTranslation) {
      errors.push(`${label}: this copy still matches the English source`);
    }
  }
  return errors;
}

export function templateMatchesFilters(template: AdminNotificationTemplate, filters: TemplateFilters) {
  const name = notificationTemplateName(template).toLowerCase();
  const matchesSearch = `${name} ${template.key} ${template.description ?? ''}`.toLowerCase().includes(filters.search.toLowerCase());
  const matchesAudience = filters.audience === 'all' || template.audience === filters.audience;
  const matchesChannel = filters.channel === 'all' || template.channel === filters.channel;
  const matchesManaged = filters.managed === 'all' || (filters.managed === 'on' ? template.enabled : !template.enabled);
  const statuses = filters.language === 'all'
    ? TRANSLATION_LOCALES.map((locale) => translationStatus(template, locale.value))
    : [translationStatus(template, filters.language)];
  const matchesReadiness = filters.readiness === 'all' || statuses.includes(filters.readiness);
  return matchesSearch && matchesAudience && matchesChannel && matchesManaged && matchesReadiness;
}

export function nextIncompleteTemplate(
  templates: readonly AdminNotificationTemplate[],
  currentKey: string,
  locale: TemplateLocale,
) {
  if (locale === 'en' || templates.length === 0) return undefined;
  const currentIndex = Math.max(0, templates.findIndex((template) => template.key === currentKey));
  const ordered = [...templates.slice(currentIndex + 1), ...templates.slice(0, currentIndex + 1)];
  return ordered.find((template) => template.key !== currentKey && translationStatus(template, locale) !== 'READY');
}

function incompleteLanguageCounts(templates: readonly AdminNotificationTemplate[]) {
  return Object.fromEntries(TRANSLATION_LOCALES.map((locale) => [
    locale.value,
    templates.filter((template) => translationStatus(template, locale.value) !== 'READY').length,
  ])) as Record<Exclude<TemplateLocale, 'en'>, number>;
}

function notificationTemplateName(template: AdminNotificationTemplate) {
  return template.translations.find((translation) => translation.locale === 'en')?.title || template.key.split(/[._-]+/).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function notificationTemplateVariables(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []; }
function notificationPlaceholders(value: string) { return Array.from(value.matchAll(/\{([^{}]+)\}/g), (match) => match[1].trim()); }
function renderNotificationPreview(value: string) { return value.replace(/\{([^{}]+)\}/g, (_match, variable: string) => VARIABLE_EXAMPLES[variable] ?? `Sample ${variable}`); }
function normalizedCopy(value: string) { return value.replace(/\r\n?/g, '\n').trim(); }
function isTemplateLocale(value: string | undefined): value is TemplateLocale { return TEMPLATE_LOCALES.some((locale) => locale.value === value); }
function translationStatus(template: AdminNotificationTemplate, locale: TemplateLocale): TranslationStatus { return template.translations.find((item) => item.locale === locale)?.status ?? 'NEEDS_TRANSLATION'; }
function statusLabel(status: TranslationStatus) { return ({ SOURCE_COPIED: 'Source copied', NEEDS_TRANSLATION: 'Needs translation', NEEDS_REVIEW: 'Needs review', READY: 'Ready' } as const)[status]; }
function readyLanguageCount(template: AdminNotificationTemplate) { return template.translations.filter((translation) => translation.status === 'READY').length; }
function templateReadiness(template: AdminNotificationTemplate) { return readyLanguageCount(template) === TEMPLATE_LOCALES.length ? 'ready' : 'action'; }
function actionNeededTemplate(templates: readonly AdminNotificationTemplate[]) { return templates.find((template) => templateReadiness(template) === 'action' || !template.enabled); }
function readinessCounts(templates: readonly AdminNotificationTemplate[]) { const translations = templates.flatMap((template) => template.translations).filter((item) => item.locale !== 'en'); return { needsReview: translations.filter((item) => item.status === 'NEEDS_REVIEW').length, needsTranslation: translations.filter((item) => item.status === 'NEEDS_TRANSLATION' || item.status === 'SOURCE_COPIED').length }; }
function variableLabel(variable: string) { return variable.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (letter) => letter.toUpperCase()); }
function channelLabel(channel: string) { return ({ BOTH: 'Push + in-app', IN_APP: 'In-app', PUSH: 'Push' } as Record<string, string>)[channel] ?? channel; }
function groupNotificationTemplates(templates: readonly AdminNotificationTemplate[]) { const groups = new Map<string, AdminNotificationTemplate[]>(); for (const template of templates) { const group = notificationTemplateGroup(template.key); groups.set(group, [...(groups.get(group) ?? []), template]); } return [...groups.entries()]; }
function notificationTemplateGroup(key: string) { if (key.startsWith('booking.') || key.startsWith('provider.joined') || key.startsWith('provider.accepted') || key.startsWith('provider.rejected')) return 'Booking'; if (key.startsWith('service.')) return 'Service'; if (key.startsWith('chat.')) return 'Chat'; if (key.startsWith('payment.') || key.startsWith('earning.')) return 'Payment'; return 'Admin & Partner'; }
function runtimeRouteLabel(template: AdminNotificationTemplate) { const routes = template.runtimeRoutes ?? []; return routes.length > 0 ? routes.map((route) => `${route.type} → ${route.targetRole === 'PROVIDER' ? 'Partner' : 'Customer'}`).join(' · ') : 'Not connected'; }
function updateUrl(template: string, locale: string) { const url = new URL(window.location.href); url.searchParams.set('template', template); url.searchParams.set('locale', locale); if (url.href !== window.location.href) window.history.pushState(null, '', url); }
function formatTimestamp(value: string) { return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value)); }
