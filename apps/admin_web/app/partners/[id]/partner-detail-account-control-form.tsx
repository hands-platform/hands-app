'use client';

import { useRouter } from 'next/navigation';
import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';

import { ConfirmDialog } from '../../../components/confirm-dialog';
import { AdminFormGrid } from '../../../components/admin-form-controls';
import {
  createProviderSanctionWithState,
  type PartnerControlRestrictionActionState,
} from '../../partner-controls/actions';

type PartnerAccountControlReportOption = {
  readonly label: string;
  readonly value: string;
};

type PartnerDetailAccountControlFormProps = {
  readonly children: ReactNode;
  readonly className?: string;
  readonly confirmLabel: string;
  readonly partnerId: string;
  readonly partnerName: string;
  readonly reportOptions?: readonly PartnerAccountControlReportOption[];
};

export type PartnerAccountControlDraft = {
  readonly expiresAt: string;
  readonly noExpiry: boolean;
  readonly partnerId: string;
  readonly reason: string;
  readonly reportId: string;
  readonly reportLabel: string;
  readonly type: PartnerAccountControlType;
};

type PartnerAccountControlType = (typeof partnerAccountControlTypes)[number];

export function PartnerDetailAccountControlForm({
  children,
  className,
  confirmLabel,
  partnerId,
  partnerName,
  reportOptions = [],
}: PartnerDetailAccountControlFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createProviderSanctionWithState, null);
  const [draft, setDraft] = useState<PartnerAccountControlDraft | null>(null);
  const [stateVisible, setStateVisible] = useState(true);
  const [validationError, setValidationError] = useState('');
  const formContainerRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement>(null);
  const submissionLocked = useRef(false);

  useEffect(() => {
    if (pending) return;
    submissionLocked.current = false;
  }, [pending]);

  function requestConfirmation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = buildPartnerAccountControlDraft(
      new FormData(event.currentTarget),
      partnerId,
      reportOptions,
    );
    if (!result.ok) {
      setValidationError(result.message);
      return;
    }

    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    if (submitter instanceof HTMLElement) {
      returnFocusRef.current = submitter;
    }
    setValidationError('');
    setStateVisible(false);
    setDraft(result.draft);
  }

  function cancelConfirmation() {
    if (pending) return;
    if (state?.status === 'success') {
      formContainerRef.current?.querySelector('form')?.reset();
      router.refresh();
    }
    setDraft(null);
  }

  function guardConfirmationSubmit(event: FormEvent<HTMLFormElement>) {
    if (pending || submissionLocked.current) {
      event.preventDefault();
      return;
    }
    submissionLocked.current = true;
    setStateVisible(true);
  }

  return (
    <>
      <div ref={formContainerRef}>
        <AdminFormGrid
          aria-busy={pending}
          className={className}
          method="post"
          onSubmit={requestConfirmation}
        >
          {children}
          {validationError ? <PartnerAccountControlResult message={validationError} status="error" /> : null}
          {stateVisible && state && !draft ? (
            <PartnerAccountControlResult message={state.message} status={state.status} />
          ) : null}
        </AdminFormGrid>
      </div>
      {draft ? (
        <ConfirmDialog
          action={formAction}
          cancelHref={`/partners/${encodeURIComponent(partnerId)}?section=access&access=controls`}
          cancelLabel={state?.status === 'success' ? 'Close' : 'Cancel'}
          confirmLabel={confirmLabel}
          description={
            <PartnerAccountControlConfirmationSummary
              draft={draft}
              partnerName={partnerName}
              result={stateVisible ? state : null}
            />
          }
          disabled={stateVisible && state?.status === 'success'}
          hiddenInputs={partnerAccountControlHiddenInputs(draft)}
          id={`partner-account-control-confirmation-${partnerId}`}
          loading={pending}
          loadingLabel="Applying control..."
          onCancel={cancelConfirmation}
          onSubmit={guardConfirmationSubmit}
          returnFocusRef={returnFocusRef}
          title={`Apply ${partnerAccountControlTypeLabel(draft.type)} to ${partnerName}?`}
          tone={draft.type === 'WARNING' ? 'warning' : 'danger'}
        />
      ) : null}
    </>
  );
}

export function buildPartnerAccountControlDraft(
  formData: FormData,
  partnerId: string,
  reportOptions: readonly PartnerAccountControlReportOption[] = [],
): { readonly draft: PartnerAccountControlDraft; readonly ok: true } | { readonly message: string; readonly ok: false } {
  const submittedPartnerId = readFormValue(formData, 'providerProfileId');
  const type = readFormValue(formData, 'type');
  const reason = readFormValue(formData, 'reason').replace(/\s+/g, ' ');
  const expiresAt = readFormValue(formData, 'expiresAt');
  const noExpiry = readFormValue(formData, 'noExpiry') === 'true';
  const reportId = readFormValue(formData, 'reportId');

  if (submittedPartnerId !== partnerId) {
    return { message: 'The Partner target changed. Refresh this page before applying a control.', ok: false };
  }
  if (!isPartnerAccountControlType(type)) {
    return { message: 'Choose a supported account control type.', ok: false };
  }
  if (reason.length < 12) {
    return { message: 'Enter a reason of at least 12 characters before review.', ok: false };
  }
  if (reason.length > 500) {
    return { message: 'Enter a reason no longer than 500 characters before review.', ok: false };
  }
  if (noExpiry === Boolean(expiresAt)) {
    return { message: 'Choose either an expiry or No expiry before review.', ok: false };
  }
  if (expiresAt) {
    const expiry = new Date(expiresAt);
    if (!Number.isFinite(expiry.getTime()) || expiry.getTime() <= Date.now()) {
      return { message: 'Choose a future expiry before review.', ok: false };
    }
  }
  if (reportOptions.length && !reportOptions.some((option) => option.value === reportId)) {
    return { message: 'Choose a loaded report before applying a linked control.', ok: false };
  }

  return {
    draft: {
      expiresAt,
      noExpiry,
      partnerId,
      reason,
      reportId,
      reportLabel: reportOptions.find((option) => option.value === reportId)?.label ?? 'Not linked',
      type,
    },
    ok: true,
  };
}

export function partnerAccountControlHiddenInputs(draft: PartnerAccountControlDraft) {
  return [
    { name: 'providerProfileId', value: draft.partnerId },
    { name: 'type', value: draft.type },
    { name: 'reason', value: draft.reason },
    ...(draft.expiresAt ? [{ name: 'expiresAt', value: draft.expiresAt }] : []),
    ...(draft.noExpiry ? [{ name: 'noExpiry', value: 'true' }] : []),
    ...(draft.reportId ? [{ name: 'reportId', value: draft.reportId }] : []),
    { name: 'confirmation', value: 'confirmed' },
  ];
}

export function partnerAccountControlImpact(type: PartnerAccountControlType) {
  switch (type) {
    case 'ACCOUNT_BLOCK':
      return 'Blocks Partner visibility, invitations, booking acceptance, service start, payout, and withdrawal.';
    case 'PAYOUT_HOLD':
      return 'Blocks payout creation and release while other Partner access remains unchanged.';
    case 'TRUST_BADGE_REMOVAL':
      return 'Removes the public profile trust indicator without blocking other operating access.';
    case 'WARNING':
      return 'Records an operator warning without automatically blocking Partner operations.';
  }
}

function PartnerAccountControlConfirmationSummary({
  draft,
  partnerName,
  result,
}: {
  readonly draft: PartnerAccountControlDraft;
  readonly partnerName: string;
  readonly result: PartnerControlRestrictionActionState | null;
}) {
  return (
    <div className="review-confirmation-summary">
      <p>Confirm only after the target, evidence, duration, and operating impact match the intended control.</p>
      <dl>
        <div><dt>Partner</dt><dd>{partnerName}</dd></div>
        <div><dt>Control type</dt><dd>{partnerAccountControlTypeLabel(draft.type)}</dd></div>
        <div><dt>Reason</dt><dd>{draft.reason}</dd></div>
        <div><dt>Expiry</dt><dd>{partnerAccountControlExpiryLabel(draft)}</dd></div>
        <div><dt>Linked report</dt><dd>{draft.reportLabel}</dd></div>
        <div><dt>Operating impact</dt><dd>{partnerAccountControlImpact(draft.type)}</dd></div>
      </dl>
      {result ? <PartnerAccountControlResult message={result.message} status={result.status} /> : null}
    </div>
  );
}

function PartnerAccountControlResult({
  message,
  status,
}: {
  readonly message: string;
  readonly status: PartnerControlRestrictionActionState['status'];
}) {
  return (
    <div
      aria-live="polite"
      className={`admin-grid-span-2 partner-control-form-result ${
        status === 'error' ? 'text-danger' : 'text-success'
      }`}
      role={status === 'error' ? 'alert' : 'status'}
    >
      {message}
    </div>
  );
}

function partnerAccountControlExpiryLabel(draft: PartnerAccountControlDraft) {
  return draft.noExpiry
    ? 'No expiry — active until an operator lifts it'
    : `${draft.expiresAt.replace('T', ' ')} Asia/Ho_Chi_Minh`;
}

function partnerAccountControlTypeLabel(type: PartnerAccountControlType) {
  return partnerAccountControlTypeLabels[type];
}

function isPartnerAccountControlType(value: string): value is PartnerAccountControlType {
  return partnerAccountControlTypes.some((type) => type === value);
}

function readFormValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

const partnerAccountControlTypes = [
  'WARNING',
  'PAYOUT_HOLD',
  'ACCOUNT_BLOCK',
  'TRUST_BADGE_REMOVAL',
] as const;

const partnerAccountControlTypeLabels: Record<PartnerAccountControlType, string> = {
  ACCOUNT_BLOCK: 'Account block',
  PAYOUT_HOLD: 'Payout hold',
  TRUST_BADGE_REMOVAL: 'Profile review hold',
  WARNING: 'Warning',
};
