'use client';

import { useActionState, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, Search, Send, Smartphone, UsersRound, X } from 'lucide-react';

import {
  AdminFormControlButton,
  AdminFormInput,
  AdminFormSelect,
  AdminFormTextarea,
} from '../../../components/admin-form-controls';
import { AdminDisclosure } from '../../../components/admin-surface';
import type { AdminPushCampaignPreview } from '../../../lib/admin-api';
import type { PushComposerBrowserFixture } from './push-send-browser-fixtures';
import {
  INITIAL_PUSH_ACCOUNT_SEARCH_STATE,
  INITIAL_PUSH_CONFIRM_STATE,
  INITIAL_PUSH_PREVIEW_STATE,
  confirmPushCampaign,
  previewPushCampaign,
  searchPushAccounts,
  type PushAccountCandidate,
} from './actions';

type Role = 'CUSTOMER' | 'PROVIDER';

const CUSTOMER_SEGMENTS = [
  ['all', 'All eligible customers'],
  ['customer_completed_last_7_days', 'Completed booking in last 7 days'],
  ['customer_completed_inactive_30_days', 'Completed before, inactive 30 days'],
  ['customer_never_booked', 'Never booked'],
  ['customer_active_last_3_days_no_booking', 'Active in last 3 days, no booking'],
  ['customer_referral_parents', 'Referral parent customers'],
] as const;

const PARTNER_SEGMENTS = [
  ['all', 'All eligible Partners'],
  ['provider_completed_booking', 'Partners with completed bookings'],
  ['provider_referral_parents', 'Referral parent Partners'],
  ['provider_inactive_last_7_days', 'Partners inactive for 7 days'],
] as const;

const CUSTOMER_DESTINATIONS = [
  ['notificationCenter', 'Notification center'],
  ['booking', 'Bookings list'],
] as const;

const PARTNER_DESTINATIONS = [
  ['notificationCenter', 'Notification center'],
  ['booking', 'Booking requests'],
  ['jobs', 'Jobs list'],
  ['earnings', 'Earnings'],
  ['profile', 'Profile'],
] as const;

const LOCALES = [
  ['en', 'English'],
  ['vi', 'Vietnamese'],
  ['ko', 'Korean'],
  ['ja', 'Japanese'],
  ['zh', 'Chinese'],
] as const;

export function PushCampaignComposer({ fixture }: { fixture?: PushComposerBrowserFixture }) {
  const [role, setRole] = useState<Role>(fixture?.role ?? 'CUSTOMER');
  const [segment, setSegment] = useState(fixture?.segment ?? 'all');
  const [locale, setLocale] = useState(fixture?.locale ?? 'vi');
  const [destination, setDestination] = useState(fixture?.destination ?? 'notificationCenter');
  const [title, setTitle] = useState(fixture?.title ?? '');
  const [body, setBody] = useState(fixture?.body ?? '');
  const [selectedAccount, setSelectedAccount] = useState<PushAccountCandidate | null>(fixture?.selectedAccount ?? null);
  const [draftVersion, setDraftVersion] = useState(0);
  const [searchState, searchAction, searchPending] = useActionState(
    searchPushAccounts,
    INITIAL_PUSH_ACCOUNT_SEARCH_STATE,
  );
  const [previewState, previewAction, previewPending] = useActionState(
    previewPushCampaign,
    fixture?.previewState ?? INITIAL_PUSH_PREVIEW_STATE,
  );
  const [confirmState, confirmAction, confirmPending] = useActionState(
    confirmPushCampaign,
    fixture?.confirmState ?? INITIAL_PUSH_CONFIRM_STATE,
  );
  const segments = role === 'PROVIDER' ? PARTNER_SEGMENTS : CUSTOMER_SEGMENTS;
  const destinations = role === 'PROVIDER' ? PARTNER_DESTINATIONS : CUSTOMER_DESTINATIONS;
  const activePreview = previewState.status === 'success' &&
    previewState.draftRevision === String(draftVersion)
      ? previewState.preview
      : undefined;
  const mutateDraft = (callback: () => void) => {
    callback();
    setDraftVersion((version) => version + 1);
  };

  const changeRole = (nextRole: Role) => mutateDraft(() => {
    setRole(nextRole);
    setSegment('all');
    setDestination('notificationCenter');
    setLocale('vi');
    setSelectedAccount(null);
  });

  return (
    <section aria-labelledby="push-composer-title" className="notification-push-composer">
      <header className="notification-push-composer-header">
        <div>
          <p className="admin-kicker">Elevated-risk operation</p>
          <h2 id="push-composer-title">Create a manual push campaign</h2>
          <p>Preview a server snapshot before one campaign job can be queued. Queueing is not delivery.</p>
        </div>
        <span className="notification-push-safety-chip"><Clock3 aria-hidden="true" size={16} /> 15-minute receipt</span>
      </header>

      <div className="notification-push-steps" aria-label="Push campaign steps">
        <ComposerStep active={!activePreview} number="1" title="Choose audience">
          <fieldset className="notification-push-fieldset" disabled={previewPending || confirmPending}>
            <legend>Account role</legend>
            <div className="notification-push-role-control">
              <AdminFormControlButton aria-pressed={role === 'CUSTOMER'} className="button-secondary" onClick={() => changeRole('CUSTOMER')} type="button">Customers</AdminFormControlButton>
              <AdminFormControlButton aria-pressed={role === 'PROVIDER'} className="button-secondary" onClick={() => changeRole('PROVIDER')} type="button">Partners</AdminFormControlButton>
            </div>
            <div className="notification-push-field-grid">
              <div>
                <AdminFormSelect label="Audience segment" labelVisibility="visible" name="audienceSegment" onChange={(event) => mutateDraft(() => setSegment(event.target.value))} options={segments.map(([value, label]) => ({ label, value }))} value={segment} />
                <small>{segmentDescription(segment, role)}</small>
              </div>
              <div>
                {role === 'PROVIDER' ? (
                  <div className="notification-push-static-control"><span>Language</span><strong>Vietnamese</strong><small>Partner app supports Vietnamese manual push only.</small></div>
                ) : (
                  <AdminFormSelect label="Language" labelVisibility="visible" name="messageLocale" onChange={(event) => mutateDraft(() => setLocale(event.target.value))} options={LOCALES.map(([value, label]) => ({ label, value }))} value={locale} />
                )}
              </div>
              <div>
                <AdminFormSelect label="App destination" labelVisibility="visible" name="messageDestination" onChange={(event) => mutateDraft(() => setDestination(event.target.value))} options={destinations.map(([value, label]) => ({ label, value }))} value={destination} />
                <small>Only ID-less list destinations verified by the selected app are available.</small>
              </div>
            </div>
          </fieldset>

          <form action={searchAction} className="notification-push-account-search">
            <input name="targetRole" type="hidden" value={role} />
            <div>
              <AdminFormInput label="Narrow to one account (optional)" labelVisibility="visible" minLength={2} name="accountSearch" placeholder="Name or phone" type="search" />
              <AdminFormControlButton disabled={searchPending} type="submit"><Search aria-hidden="true" size={16} />{searchPending ? 'Searching…' : 'Search'}</AdminFormControlButton>
            </div>
            <small>A selected account is evaluated alone; the segment is not fanned out.</small>
          </form>
          <AccountSearchResult
            role={role}
            selected={selectedAccount}
            setSelected={(candidate) => mutateDraft(() => setSelectedAccount(candidate))}
            state={searchState}
          />
        </ComposerStep>

        <ComposerStep active={!activePreview} number="2" title="Write and preview">
          <form
            action={(formData) => {
              if (selectedAccount) formData.set('targetUserId', selectedAccount.selectionId);
              previewAction(formData);
            }}
            className="notification-push-message-layout"
          >
            <input name="targetRole" type="hidden" value={role} />
            <input name="targetSegment" type="hidden" value={segment} />
            <input name="locale" type="hidden" value={role === 'PROVIDER' ? 'vi' : locale} />
            <input name="appDestination" type="hidden" value={destination} />
            <input name="draftRevision" type="hidden" value={String(draftVersion)} />
            <fieldset disabled={previewPending || confirmPending}>
              <div className="notification-push-counted-control">
                <AdminFormInput ariaInvalid={Boolean(previewState.fieldErrors?.title)} label="Push title" labelVisibility="visible" maxLength={120} name="title" onChange={(event) => mutateDraft(() => setTitle(event.target.value))} required value={title} />
                <output>{title.length} / 120</output>
              </div>
              <div className="notification-push-counted-control">
                <AdminFormTextarea ariaInvalid={Boolean(previewState.fieldErrors?.body)} label="Push body" labelVisibility="visible" maxLength={500} name="body" onChange={(event) => mutateDraft(() => setBody(event.target.value))} required rows={4} value={body} />
                <output>{body.length} / 500</output>
              </div>
              <AdminFormControlButton disabled={previewPending || !title.trim() || !body.trim()} type="submit">
                <UsersRound aria-hidden="true" size={17} />{previewPending ? 'Verifying audience…' : 'Preview audience'}
              </AdminFormControlButton>
            </fieldset>
            <PushVisualPreview body={body} destination={destinationLabel(destination, role)} locale={role === 'PROVIDER' ? 'vi' : locale} title={title} />
          </form>
          <ActionMessage error={previewState.error} />
        </ComposerStep>

        <ComposerStep active={Boolean(activePreview)} number="3" title="Confirm and queue">
          {activePreview ? (
            <ReceiptPanel
              confirmAction={confirmAction}
              confirmError={confirmState.error}
              confirmFieldErrors={confirmState.fieldErrors}
              confirmPending={confirmPending}
              confirmSuccess={confirmState.status === 'success'}
              idempotencyKey={previewState.idempotencyKey ?? ''}
              preview={activePreview}
              selectedAccount={selectedAccount}
              title={title}
              body={body}
            />
          ) : (
            <div className="notification-push-awaiting-receipt">
              <Smartphone aria-hidden="true" size={22} />
              <div><strong>Server receipt required</strong><p>Create a preview to unlock final confirmation.</p></div>
            </div>
          )}
        </ComposerStep>
      </div>
    </section>
  );
}

function ComposerStep({ active, children, number, title }: { active: boolean; children: React.ReactNode; number: string; title: string }) {
  return (
    <section className="notification-push-step" data-active={active ? 'true' : undefined}>
      <header><span>{number}</span><h3>{title}</h3></header>
      <div>{children}</div>
    </section>
  );
}

function AccountSearchResult({ role, selected, setSelected, state }: {
  role: Role;
  selected: PushAccountCandidate | null;
  setSelected: (candidate: PushAccountCandidate | null) => void;
  state: Awaited<ReturnType<typeof searchPushAccounts>>;
}) {
  if (selected) return (
    <div className="notification-push-selected-account" role="status">
      <CheckCircle2 aria-hidden="true" size={18} />
      <div><strong>{selected.displayLabel}</strong><span>{selected.maskedPhone || 'Phone unavailable'} · {selected.accountStatus}</span></div>
      <AdminFormControlButton aria-label="Clear selected account" className="button-secondary" onClick={() => setSelected(null)} type="button"><X aria-hidden="true" size={17} /></AdminFormControlButton>
    </div>
  );
  if (state.status === 'error' && state.role === role) return <ActionMessage error={state.error} />;
  if (state.status !== 'success' || state.role !== role) return null;
  if (!state.candidates?.length) return <p className="notification-push-inline-state" role="status">No matching accounts.</p>;
  return (
    <div aria-label="Account search results" className="notification-push-account-results" role="list">
      {state.candidates.map((candidate) => (
        <div key={candidate.selectionId} role="listitem">
          <AdminFormControlButton className="button-secondary" onClick={() => setSelected(candidate)} type="button">
            <span><strong>{candidate.displayLabel}</strong><small>{candidate.maskedPhone || 'Phone unavailable'} · {candidate.accountStatus}</small></span>
            <span>Select</span>
          </AdminFormControlButton>
        </div>
      ))}
    </div>
  );
}

function ReceiptPanel({ body, confirmAction, confirmError, confirmFieldErrors, confirmPending, confirmSuccess, idempotencyKey, preview, selectedAccount, title }: {
  body: string;
  confirmAction: (payload: FormData) => void;
  confirmError?: string;
  confirmFieldErrors?: Readonly<Record<string, string>>;
  confirmPending: boolean;
  confirmSuccess: boolean;
  idempotencyKey: string;
  preview: AdminPushCampaignPreview;
  selectedAccount: PushAccountCandidate | null;
  title: string;
}) {
  const ready = preview.state === 'READY';
  const receiptBlocked = isReceiptBlockingError(confirmError);
  const [reason, setReason] = useState('');
  const [confirmationPhrase, setConfirmationPhrase] = useState('');
  const confirmationReady = reason.trim().length >= 12 && confirmationPhrase.trim() === `SEND ${preview.eligibleUsers}`;
  return (
    <div className="notification-push-receipt">
      <div className="notification-push-receipt-status" data-state={preview.state}>
        {ready ? <CheckCircle2 aria-hidden="true" size={19} /> : <AlertTriangle aria-hidden="true" size={19} />}
        <div>
          <strong>{previewStateTitle(preview)}</strong>
          <span>{ready ? 'No delivery has started. Review every value below.' : previewStateDetail(preview)}</span>
        </div>
      </div>
      <dl className="notification-push-receipt-grid">
        <div><dt>Target</dt><dd>{preview.targetRole === 'PROVIDER' ? 'Partners' : 'Customers'} · {preview.targetSegment}</dd></div>
        <div><dt>Specific account</dt><dd>{selectedAccount?.displayLabel ?? 'All matched users'}</dd></div>
        <div><dt>Language</dt><dd>{localeLabel(preview.locale)}</dd></div>
        <div><dt>App target</dt><dd>{preview.destination.targetSummary}</dd></div>
        <div><dt>Eligible users</dt><dd>{preview.eligibleUsers}</dd></div>
        <div><dt>Eligible device attempts</dt><dd>{preview.eligibleDevices}</dd></div>
        <div><dt>Excluded users</dt><dd>{preview.excludedUsers}</dd></div>
        <div><dt>Excluded devices</dt><dd>{preview.excludedDevices}</dd></div>
        <div><dt>Manual user limit</dt><dd>{preview.manualUserLimit}</dd></div>
        <div><dt>Receipt expires</dt><dd>{new Date(preview.expiresAt).toLocaleString('en-GB', { timeZone: 'Asia/Ho_Chi_Minh' })} ICT</dd></div>
      </dl>
      {preview.exclusions.length ? (
        <div className="notification-push-exclusions">
          <strong>Exclusion reasons</strong>
          <ul>{preview.exclusions.map((item) => <li key={item.code}><span>{item.label}</span><strong>{item.count}</strong></li>)}</ul>
        </div>
      ) : null}
      <div className="notification-push-final-copy">
        <span>Exact message</span><strong>{title}</strong><p>{body}</p><small>Opens {preview.destination.label}</small>
      </div>
      {preview.sampleRecipients.length ? (
        <AdminDisclosure ariaLabel="Masked recipient sample" className="notification-push-samples">
          <summary>Masked recipient sample ({preview.sampleRecipients.length})</summary>
          <ul>{preview.sampleRecipients.map((recipient, index) => (
            <li key={`${recipient.displayLabel}-${index}`}><strong>{recipient.displayLabel}</strong><span>{recipient.maskedPhone || 'Phone unavailable'} · {recipient.platform || 'Platform unavailable'}</span></li>
          ))}</ul>
        </AdminDisclosure>
      ) : null}
      {ready ? (
        <form action={confirmAction} className="notification-push-confirm-form">
          <input name="previewId" type="hidden" value={preview.previewId} />
          <input name="idempotencyKey" type="hidden" value={idempotencyKey} />
          <AdminFormTextarea ariaInvalid={Boolean(confirmFieldErrors?.reason)} disabled={receiptBlocked || confirmSuccess} label="Operator reason" labelVisibility="visible" maxLength={500} minLength={12} name="reason" onChange={(event) => setReason(event.target.value)} required rows={3} value={reason} />
          <AdminFormInput ariaInvalid={Boolean(confirmFieldErrors?.confirmationPhrase)} autoComplete="off" disabled={receiptBlocked || confirmSuccess} label={`Type SEND ${preview.eligibleUsers} to confirm`} labelVisibility="visible" name="confirmationPhrase" onChange={(event) => setConfirmationPhrase(event.target.value)} required value={confirmationPhrase} />
          <ActionMessage error={confirmError} success={confirmSuccess ? 'Campaign queued. Delivery has not completed yet.' : undefined} />
          <AdminFormControlButton className="button-danger" disabled={confirmPending || confirmSuccess || receiptBlocked || !confirmationReady} type="submit">
            <Send aria-hidden="true" size={17} />{confirmPending ? 'Queueing once…' : `Queue push campaign for ${preview.eligibleUsers} users`}
          </AdminFormControlButton>
        </form>
      ) : null}
    </div>
  );
}

function isReceiptBlockingError(error?: string) {
  return Boolean(error && (
    error.startsWith('Preview expired.') ||
    error.startsWith('Audience or preview state changed.') ||
    error.startsWith('This preview was already used.')
  ));
}

function PushVisualPreview({ body, destination, locale, title }: { body: string; destination: string; locale: string; title: string }) {
  return (
    <aside aria-label="Push notification visual preview" className="notification-push-device-preview">
      <div className="notification-push-device-top"><span>HANDS</span><span>{localeLabel(locale)}</span></div>
      <div className="notification-push-os-card"><Smartphone aria-hidden="true" size={20} /><div><strong>{title || 'Push title'}</strong><p>{body || 'Your message preview appears here.'}</p><small>Opens {destination}</small></div><time>now</time></div>
    </aside>
  );
}

function ActionMessage({ error, success }: { error?: string; success?: string }) {
  if (error) return <p className="notification-push-action-message" data-tone="danger" role="alert"><AlertTriangle aria-hidden="true" size={16} />{error}</p>;
  if (success) return <p className="notification-push-action-message" data-tone="success" role="status"><CheckCircle2 aria-hidden="true" size={16} />{success}</p>;
  return null;
}

function previewStateTitle(preview: AdminPushCampaignPreview) {
  if (preview.state === 'OVER_LIMIT') return `Audience too large · ${preview.eligibleUsers} eligible users`;
  if (preview.state === 'ZERO_RECIPIENTS') return 'No eligible recipients';
  if (preview.state === 'INVALID_DESTINATION') return 'Destination is not allowed for this app';
  return `Server-verified receipt · ${preview.eligibleUsers} users`;
}

function previewStateDetail(preview: AdminPushCampaignPreview) {
  if (preview.state === 'OVER_LIMIT') return `Manual send limit · ${preview.manualUserLimit} users. Narrow the audience. No one has been queued.`;
  if (preview.state === 'INVALID_DESTINATION') return 'Choose a destination from the selected app contract and create a new preview. No one has been queued.';
  return 'Change the audience, language, or destination and preview again. No one has been queued.';
}

function destinationLabel(value: string, role: Role) {
  const options = role === 'PROVIDER' ? PARTNER_DESTINATIONS : CUSTOMER_DESTINATIONS;
  return options.find(([option]) => option === value)?.[1] ?? 'Notification center';
}

function localeLabel(locale: string) {
  return LOCALES.find(([value]) => value === locale)?.[1] ?? locale.toUpperCase();
}

function segmentDescription(value: string, role: Role) {
  if (value === 'all') return role === 'PROVIDER'
    ? 'Active Partner accounts with an enabled Vietnamese Partner-app device.'
    : 'Customer accounts with an enabled device in the selected language.';
  if (value.includes('last_7_days')) return 'Evaluated from authoritative booking or activity timestamps in the last 7 days.';
  if (value.includes('inactive_30_days')) return 'Completed before and no qualifying activity in the last 30 days.';
  return 'Only accounts matching this server-side segment and an eligible device are included.';
}
