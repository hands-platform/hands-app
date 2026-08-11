'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  AdminFormCheckbox,
  AdminFormControlButton,
  AdminFormInput,
  AdminFormSelect,
  AdminFormShell,
  AdminFormTextarea,
} from '../../../components/admin-form-controls';
import { AdminCard, AdminNotePanel } from '../../../components/admin-surface';
import { StatusBadge } from '../../../components/status-badge';
import type { AdminNotificationTemplate } from '../../../lib/admin-api';
import { updateNotificationTemplate } from './actions';

const TEMPLATE_LOCALES = [
  { value: 'en', label: 'English' },
  { value: 'vi', label: 'Vietnamese' },
  { value: 'ko', label: 'Korean' },
  { value: 'ja', label: 'Japanese' },
  { value: 'zh', label: 'Chinese' },
] as const;

type TemplateLocale = (typeof TEMPLATE_LOCALES)[number]['value'];
type TranslationDraft = Record<TemplateLocale, { body: string; title: string }>;

const VARIABLE_EXAMPLES: Record<string, string> = {
  bookingId: 'BK-2026-0142',
  campaignId: 'CAMPAIGN-24',
  chatRoomId: 'CHAT-142',
  customerProfileId: 'CUSTOMER-142',
  distanceKm: '1.8',
  partnerName: 'Linh Nguyen',
  payoutBatchId: 'PAYOUT-0826',
  paymentId: 'PAY-142',
  providerProfileId: 'PARTNER-142',
};

export function NotificationTemplateEditor({
  initialLocale,
  initialTemplateKey,
  templates,
}: {
  readonly initialLocale?: string;
  readonly initialTemplateKey?: string;
  readonly templates: readonly AdminNotificationTemplate[];
}) {
  const [selectedKey, setSelectedKey] = useState(
    templates.some((template) => template.key === initialTemplateKey)
      ? (initialTemplateKey ?? '')
      : (templates[0]?.key ?? ''),
  );
  const selectedTemplate = templates.find((template) => template.key === selectedKey) ?? templates[0];
  const [activeLocale, setActiveLocale] = useState<TemplateLocale>(
    isTemplateLocale(initialLocale) ? initialLocale : 'en',
  );
  const [draft, setDraft] = useState<TranslationDraft>(() => templateDraft(selectedTemplate));
  const [enabled, setEnabled] = useState(selectedTemplate?.enabled ?? false);
  const baseline = useMemo(() => templateDraft(selectedTemplate), [selectedTemplate]);
  const changedLocales = TEMPLATE_LOCALES.filter(
    ({ value }) => draft[value].title !== baseline[value].title || draft[value].body !== baseline[value].body,
  ).map(({ value }) => value);
  const enabledChanged = Boolean(selectedTemplate && enabled !== selectedTemplate.enabled);
  const dirty = changedLocales.length > 0 || enabledChanged;
  const allowedVariables = notificationTemplateVariables(selectedTemplate?.variables);
  const requiredVariables = notificationTemplateVariables(selectedTemplate?.requiredVariables);
  const validationErrors = notificationTemplateValidationErrors(
    draft,
    changedLocales,
    allowedVariables,
    requiredVariables,
  );
  const activeDraft = draft[activeLocale];

  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    }

    function guardNavigation(event: MouseEvent) {
      if (!dirty || !(event.target instanceof Element)) return;
      const link = event.target.closest('a[href]');
      if (!link || link.getAttribute('href')?.startsWith('#')) return;
      if (!window.confirm('Discard unsaved notification template changes?')) {
        event.preventDefault();
      }
    }

    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', guardNavigation);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('click', guardNavigation);
    };
  }, [dirty]);

  if (!selectedTemplate) {
    return <p className="muted">No notification templates are available.</p>;
  }

  function selectTemplate(nextKey: string) {
    if (dirty && !window.confirm('Discard unsaved notification template changes?')) return;
    const nextTemplate = templates.find((template) => template.key === nextKey);
    if (!nextTemplate) return;
    setSelectedKey(nextTemplate.key);
    setDraft(templateDraft(nextTemplate));
    setEnabled(nextTemplate.enabled);
    setActiveLocale('en');
  }

  function updateTranslation(locale: TemplateLocale, field: 'body' | 'title', value: string) {
    setDraft((current) => ({
      ...current,
      [locale]: { ...current[locale], [field]: value },
    }));
  }

  const previewTitle = renderNotificationPreview(activeDraft.title);
  const previewBody = renderNotificationPreview(activeDraft.body);
  const translationPayload = changedLocales.map((locale) => ({
    body: draft[locale].body,
    locale,
    title: draft[locale].title,
  }));
  const sampleVariables = Object.fromEntries(
    allowedVariables.map((variable) => [variable, VARIABLE_EXAMPLES[variable] ?? `Sample ${variable}`]),
  );

  return (
    <div className="notification-template-editor">
      <AdminFormSelect
        className="notification-template-selector"
        label="Template"
        name="templateSelector"
        onChange={(event) => selectTemplate(event.target.value)}
        options={templates.map((template) => ({
          label: `${notificationTemplateName(template)} / ${template.audience === 'PROVIDER' ? 'Partner' : 'Customer'}`,
          value: template.key,
        }))}
        value={selectedTemplate.key}
      />

      <AdminCard className="notification-template-card notification-template-editor-card">
        <div className="ops-row">
          <div>
            <h3>{notificationTemplateName(selectedTemplate)}</h3>
            <p className="muted">{selectedTemplate.description}</p>
          </div>
          <div className="participant-list">
            <StatusBadge tone={enabled ? 'success' : 'neutral'}>{enabled ? 'Enabled' : 'Paused'}</StatusBadge>
            <StatusBadge tone={selectedTemplate.audience === 'PROVIDER' ? 'info' : 'warning'}>
              {selectedTemplate.audience === 'PROVIDER' ? 'Partner' : 'Customer'}
            </StatusBadge>
            <StatusBadge tone="neutral">{selectedTemplate.channel}</StatusBadge>
          </div>
        </div>

        <details className="notification-template-technical-details">
          <summary>Technical details</summary>
          <div className="notification-template-variable-row">
            <span className="muted">Event key</span>
            <code>{selectedTemplate.key}</code>
          </div>
          <div className="notification-template-variable-row">
            <span className="muted">Supported variables</span>
            <code>{JSON.stringify(allowedVariables)}</code>
          </div>
          <div className="notification-template-variable-row">
            <span className="muted">Preview sample data</span>
            <code>{JSON.stringify(sampleVariables)}</code>
          </div>
        </details>

        <AdminFormShell action={updateNotificationTemplate} className="notification-template-session-form">
          <input name="key" type="hidden" value={selectedTemplate.key} />
          <input name="activeLocale" type="hidden" value={activeLocale} />
          <input name="enabled" type="hidden" value={String(enabled)} />
          <input name="translations" type="hidden" value={JSON.stringify(translationPayload)} />

          <div aria-label="Template languages" className="notification-template-language-tabs" role="tablist">
            {TEMPLATE_LOCALES.map((locale) => {
              const changed = changedLocales.includes(locale.value);
              const complete = Boolean(draft[locale.value].title.trim() && draft[locale.value].body.trim());
              return (
                <AdminFormControlButton
                  aria-selected={activeLocale === locale.value}
                  className={activeLocale === locale.value ? 'is-active' : undefined}
                  key={locale.value}
                  onClick={() => setActiveLocale(locale.value)}
                  role="tab"
                  type="button"
                >
                  <span>{locale.label}</span>
                  <small>{changed ? 'Changed' : complete ? 'Complete' : 'Incomplete'}</small>
                </AdminFormControlButton>
              );
            })}
          </div>

          <div
            aria-label={`${activeLocale} notification copy`}
            className="notification-template-copy-form"
            role="tabpanel"
          >
            <div className="notification-template-copy-form-header">
              <h4>{TEMPLATE_LOCALES.find((locale) => locale.value === activeLocale)?.label}</h4>
              <AdminFormCheckbox
                checked={enabled}
                label="Notification template enabled"
                onChange={(event) => setEnabled(event.target.checked)}
              >
                <span>Enabled for every language</span>
              </AdminFormCheckbox>
            </div>
            <AdminFormInput
              label="Title"
              maxLength={120}
              name={`title_${activeLocale}`}
              onChange={(event) => updateTranslation(activeLocale, 'title', event.target.value)}
              required
              value={activeDraft.title}
            />
            <AdminFormTextarea
              label="Message"
              maxLength={500}
              name={`body_${activeLocale}`}
              onChange={(event) => updateTranslation(activeLocale, 'body', event.target.value)}
              required
              rows={4}
              value={activeDraft.body}
            />
          </div>

          <AdminNotePanel className="ops-task-info notification-template-message-preview">
            <span className="muted">Message preview / {activeLocale.toUpperCase()}</span>
            <strong>{previewTitle || 'Title preview'}</strong>
            <p>{previewBody || 'Message preview'}</p>
          </AdminNotePanel>

          {validationErrors.length > 0 ? (
            <div role="alert">
              <AdminNotePanel className="ops-task-danger">
                <strong>Fix placeholder errors before saving</strong>
                {validationErrors.map((error) => (
                  <p className="muted" key={error}>
                    {error}
                  </p>
                ))}
              </AdminNotePanel>
            </div>
          ) : null}

          <div className="notification-template-change-summary">
            <div>
              <strong>Changes in this editing session</strong>
              <p className="muted">
                {dirty
                  ? [
                      changedLocales.length > 0
                        ? `Languages: ${changedLocales.join(', ').toUpperCase()}`
                        : '',
                      enabledChanged ? `Availability: ${enabled ? 'Enabled' : 'Paused'}` : '',
                    ]
                      .filter(Boolean)
                      .join(' / ')
                  : 'No unsaved changes.'}
              </p>
            </div>
            <AdminFormControlButton disabled={!dirty || validationErrors.length > 0}>
              Save all changed languages
            </AdminFormControlButton>
          </div>
        </AdminFormShell>
      </AdminCard>
    </div>
  );
}

function templateDraft(template: AdminNotificationTemplate | undefined): TranslationDraft {
  return Object.fromEntries(
    TEMPLATE_LOCALES.map(({ value }) => {
      const translation = template?.translations.find((item) => item.locale === value);
      return [value, { body: translation?.body ?? '', title: translation?.title ?? '' }];
    }),
  ) as TranslationDraft;
}

function notificationTemplateName(template: AdminNotificationTemplate) {
  return (
    template.translations.find((translation) => translation.locale === 'en')?.title ||
    template.key
      .split(/[._-]+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  );
}

function notificationTemplateVariables(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function notificationTemplateValidationErrors(
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
  }
  return errors;
}

function notificationPlaceholders(value: string) {
  return Array.from(value.matchAll(/\{([^{}]+)\}/g), (match) => match[1].trim());
}

function renderNotificationPreview(value: string) {
  return value.replace(
    /\{([^{}]+)\}/g,
    (_match, variable: string) => VARIABLE_EXAMPLES[variable] ?? `{${variable}}`,
  );
}

function isTemplateLocale(value: string | undefined): value is TemplateLocale {
  return TEMPLATE_LOCALES.some((locale) => locale.value === value);
}
