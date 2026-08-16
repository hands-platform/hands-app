'use client';

import Link from 'next/link';
import { useActionState, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import {
  AdminFormControlButton,
  AdminFormGrid,
} from '../../components/admin-form-controls';
import { AdminNoticeCard } from '../../components/admin-surface';
import { DateTimeText } from '../../components/date-time-text';
import { MoneyText } from '../../components/money-text';
import {
  upsertMarketingSpendDaily,
  type MarketingSpendActionState,
} from './actions';

const initialMarketingSpendActionState: MarketingSpendActionState = { status: 'idle' };

export function MarketingSpendActionForm({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className?: string;
}) {
  const [state, formAction] = useActionState(
    upsertMarketingSpendDaily,
    initialMarketingSpendActionState,
  );

  return (
    <AdminFormGrid action={formAction} className={className}>
      {children}
      {state.status !== 'idle' ? <MarketingSpendActionResult state={state} /> : null}
    </AdminFormGrid>
  );
}

export function MarketingSpendSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <AdminFormControlButton
      className="marketing-analytics-apply-button marketing-spend-submit"
      disabled={pending}
      type="submit"
    >
      {pending ? 'Saving spend...' : 'Save spend'}
    </AdminFormControlButton>
  );
}

function MarketingSpendActionResult({ state }: { readonly state: MarketingSpendActionState }) {
  const success = state.status === 'success';
  const warning = state.status === 'invalid' || state.status === 'conflict' || state.status === 'throttled';

  return (
    <AdminNoticeCard
      className="admin-grid-span-2 marketing-spend-action-result"
      role={success ? 'status' : 'alert'}
      tone={success ? 'success' : warning ? 'warning' : 'danger'}
    >
      <strong>{state.message}</strong>
      {state.fieldErrors ? (
        <ul>
          {Object.entries(state.fieldErrors).map(([field, message]) => (
            <li key={field}>{message}</li>
          ))}
        </ul>
      ) : null}
      {state.saved ? (
        <div className="marketing-spend-saved-evidence">
          <span>
            <strong>Result</strong>
            {state.saved.outcome === 'NO_CHANGE' ? 'No change' : 'Saved'}
          </span>
          <span>
            <strong>Saved value</strong>
            <MoneyText amount={state.saved.spendAmount} />
          </span>
          <span>
            <strong>Spend date</strong>
            {state.saved.spendDate}
          </span>
          {state.saved.updatedAt ? (
            <span>
              <strong>Saved at</strong>
              <DateTimeText value={state.saved.updatedAt} />
            </span>
          ) : null}
          <span>
            <strong>Reason</strong>
            {state.saved.reason}
          </span>
          {state.saved.canonicalTarget ? (
            <span>
              <strong>Canonical target</strong>
              {state.saved.canonicalTarget}
            </span>
          ) : null}
          {state.saved.auditId ? (
            <Link
              className="text-link"
              href={`/audit-log?q=${encodeURIComponent(state.saved.auditId)}`}
              prefetch={false}
            >
              Open audit event {state.saved.auditId}
            </Link>
          ) : (
            <span>
              <strong>Audit event</strong>
              Not created because no value changed
            </span>
          )}
        </div>
      ) : null}
    </AdminNoticeCard>
  );
}
